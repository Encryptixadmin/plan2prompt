import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireProjectContext } from "../middleware/project-context";
import { artifactService } from "../services/artifact.service";
import { createHash } from "crypto";

const router = Router();

const createSessionSchema = z.object({
  promptArtifactId: z.string().uuid(),
  totalSteps: z.number().int().min(1),
});

router.post(
  "/sessions",
  requireProjectContext,
  async (req: Request, res: Response) => {
    try {
      const validation = createSessionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", details: validation.error.flatten() },
        });
      }

      const { promptArtifactId, totalSteps } = validation.data;
      const projectId = req.projectId!;

      const artifact = await artifactService.getById(promptArtifactId);
      if (!artifact) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Prompt artifact not found" },
        });
      }

      const existing = await storage.getActiveSessionForArtifact(projectId, promptArtifactId);
      if (existing) {
        const steps = await storage.listExecutionSteps(existing.id);
        return res.json({
          success: true,
          data: { session: existing, steps, resumed: true },
        });
      }

      const session = await storage.createExecutionSession({
        projectId,
        promptArtifactId,
        promptArtifactVersion: artifact.metadata.version || 1,
        status: "active",
      });

      const steps = [];
      for (let i = 1; i <= totalSteps; i++) {
        const step = await storage.createExecutionStep({
          sessionId: session.id,
          stepNumber: i,
          status: "not_started",
          attempts: 0,
          escalationLevel: 0,
        });
        steps.push(step);
      }

      res.json({
        success: true,
        data: { session, steps, resumed: false },
      });
    } catch (error) {
      console.error("Error creating execution session:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create execution session" },
      });
    }
  }
);

router.get(
  "/sessions/:sessionId",
  requireProjectContext,
  async (req: Request, res: Response) => {
    try {
      const session = await storage.getExecutionSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Session not found" },
        });
      }

      if (session.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: { code: "PROJECT_ISOLATION_VIOLATION", message: "Session belongs to a different project" },
        });
      }

      const steps = await storage.listExecutionSteps(session.id);

      let upstreamChanged = false;
      try {
        const artifact = await artifactService.getById(session.promptArtifactId);
        if (artifact && (artifact.metadata.version || 1) !== session.promptArtifactVersion) {
          upstreamChanged = true;
          if (session.status === "active") {
            await storage.updateExecutionSessionStatus(session.id, "blocked");
            session.status = "blocked";
          }
        }
      } catch {}

      res.json({
        success: true,
        data: { session, steps, upstreamChanged },
      });
    } catch (error) {
      console.error("Error fetching execution session:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch session" },
      });
    }
  }
);

router.get(
  "/sessions/artifact/:artifactId",
  requireProjectContext,
  async (req: Request, res: Response) => {
    try {
      const session = await storage.getActiveSessionForArtifact(
        req.projectId!,
        req.params.artifactId
      );

      if (!session) {
        return res.json({ success: true, data: null });
      }

      const steps = await storage.listExecutionSteps(session.id);
      res.json({
        success: true,
        data: { session, steps },
      });
    } catch (error) {
      console.error("Error fetching session by artifact:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch session" },
      });
    }
  }
);

const updateStepSchema = z.object({
  status: z.enum(["in_progress", "completed", "failed"]),
  failureOutput: z.string().optional(),
});

router.patch(
  "/sessions/:sessionId/steps/:stepNumber",
  requireProjectContext,
  async (req: Request, res: Response) => {
    try {
      const validation = updateStepSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", details: validation.error.flatten() },
        });
      }

      const { status, failureOutput } = validation.data;
      const stepNumber = parseInt(req.params.stepNumber, 10);
      const sessionId = req.params.sessionId;

      const session = await storage.getExecutionSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Session not found" },
        });
      }

      if (session.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: { code: "PROJECT_ISOLATION_VIOLATION", message: "Session belongs to a different project" },
        });
      }

      if (session.status === "blocked") {
        return res.status(409).json({
          success: false,
          error: {
            code: "SESSION_BLOCKED",
            message: "Session is blocked. The upstream artifact has changed. Start a new session.",
          },
        });
      }

      if (session.status === "completed") {
        return res.status(409).json({
          success: false,
          error: { code: "SESSION_COMPLETED", message: "Session is already completed" },
        });
      }

      const steps = await storage.listExecutionSteps(sessionId);
      const currentStep = steps.find(s => s.stepNumber === stepNumber);
      if (!currentStep) {
        return res.status(404).json({
          success: false,
          error: { code: "STEP_NOT_FOUND", message: `Step ${stepNumber} not found` },
        });
      }

      if (stepNumber > 1) {
        const previousStep = steps.find(s => s.stepNumber === stepNumber - 1);
        if (!previousStep || previousStep.status !== "completed") {
          return res.status(409).json({
            success: false,
            error: {
              code: "STEP_SEQUENCE_VIOLATION",
              message: `Cannot execute step ${stepNumber}. Step ${stepNumber - 1} must be completed first.`,
            },
          });
        }
      }

      let updatedStep = currentStep;
      let escalated = false;

      if (status === "failed") {
        const failureHash = createHash("sha256")
          .update(failureOutput || "unknown")
          .digest("hex")
          .substring(0, 16);

        updatedStep = (await storage.incrementStepAttempts(currentStep.id, failureHash))!;

        if (updatedStep.lastFailureHash === failureHash && updatedStep.attempts >= 3) {
          const mod = updatedStep.attempts % 3;
          if (mod === 0) {
            updatedStep = (await storage.incrementStepEscalation(currentStep.id))!;
            escalated = true;
          }
        }
      } else if (status === "completed") {
        updatedStep = (await storage.updateExecutionStepStatus(currentStep.id, "completed"))!;

        const allCompleted = steps.every(s =>
          s.stepNumber === stepNumber ? true : s.status === "completed"
        );
        if (allCompleted) {
          await storage.updateExecutionSessionStatus(sessionId, "completed");
        }
      } else if (status === "in_progress") {
        updatedStep = (await storage.updateExecutionStepStatus(currentStep.id, "in_progress"))!;
      }

      const updatedSteps = await storage.listExecutionSteps(sessionId);

      res.json({
        success: true,
        data: {
          step: updatedStep,
          steps: updatedSteps,
          escalated,
        },
      });
    } catch (error) {
      console.error("Error updating execution step:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update step" },
      });
    }
  }
);

export default router;
