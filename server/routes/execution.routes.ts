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
          error: { code: "VALIDATION_ERROR", message: "Invalid request", details: validation.error.flatten() },
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
          reexecutionCount: 0,
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
  integrityOverride: z.boolean().optional(),
  isIdempotent: z.boolean().optional(),
  integrityLevel: z.enum(["safe", "caution", "critical"]).optional(),
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
          error: { code: "VALIDATION_ERROR", message: "Invalid request", details: validation.error.flatten() },
        });
      }

      const { status, failureOutput, integrityOverride, isIdempotent, integrityLevel } = validation.data;
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

      if (status === "in_progress" && currentStep.status === "completed") {
        if (isIdempotent === false && integrityLevel === "critical" && !integrityOverride) {
          return res.status(409).json({
            success: false,
            error: {
              code: "INTEGRITY_RERUN_BLOCKED",
              message: "This step is non-idempotent and critical. Re-execution requires explicit confirmation.",
              integrityLevel: "critical",
              isIdempotent: false,
            },
          });
        }

        if (isIdempotent === false && !integrityOverride) {
          return res.status(409).json({
            success: false,
            error: {
              code: "INTEGRITY_RERUN_BLOCKED",
              message: "This step is non-idempotent. Re-execution may cause side effects. Confirm to proceed.",
              integrityLevel: integrityLevel || "caution",
              isIdempotent: false,
            },
          });
        }

        if (integrityOverride) {
          await storage.setIntegrityOverride(currentStep.id);
        }

        await storage.incrementReexecutionCount(currentStep.id);
      }

      let updatedStep = currentStep;
      let escalated = false;
      let duplicateFailure = false;
      let clarificationCreated = false;

      if (status === "failed") {
        const failureHash = createHash("sha256")
          .update(failureOutput || "unknown")
          .digest("hex")
          .substring(0, 16);

        const previousHash = currentStep.lastFailureHash;
        updatedStep = (await storage.incrementStepAttempts(currentStep.id, failureHash))!;

        if (previousHash === failureHash && updatedStep.attempts >= 2) {
          duplicateFailure = true;
          await storage.setDuplicateFailureDetected(currentStep.id);

          const stepIntegrityCtx = JSON.stringify({
            stepNumber,
            integrityLevel: integrityLevel || "caution",
            isIdempotent: isIdempotent ?? false,
            reexecutionCount: updatedStep.reexecutionCount || 0,
            duplicateFailureDetected: true,
          });

          let duplicateSeverity: "advisory" | "blocker" = updatedStep.attempts >= 6 ? "blocker" : "advisory";
          if (integrityLevel === "critical" && duplicateFailure) {
            duplicateSeverity = "blocker";
          }
          if ((updatedStep.reexecutionCount || 0) >= 2 && duplicateSeverity === "advisory") {
            duplicateSeverity = "blocker";
          }

          try {
            const contractHash = createHash("sha256")
              .update(`execution-step-${stepNumber}-${failureHash}-${sessionId}`)
              .digest("hex")
              .substring(0, 16);

            await storage.createClarificationContract({
              projectId: session.projectId,
              contractHash,
              originatingModule: "execution",
              currentArtifactId: session.promptArtifactId,
              currentArtifactVersion: session.promptArtifactVersion,
              upstreamArtifactId: session.promptArtifactId,
              upstreamArtifactVersion: session.promptArtifactVersion,
              category: "execution_failure",
              severity: duplicateSeverity,
              title: `Duplicate failure on Step ${stepNumber}`,
              description: `Step ${stepNumber} has failed ${updatedStep.attempts} times with the same error signature (hash: ${failureHash}). The failure output suggests the prompt may need revision.`,
              requiredClarifications: JSON.stringify([{
                field: "suggested_action",
                question: `Review and revise the prompt for Step ${stepNumber}, or adjust requirements that feed into this step.`,
                expectedAnswerType: "long_text",
              }]),
              resolutionStatus: "pending",
              occurrenceCount: updatedStep.attempts,
              integrityContext: stepIntegrityCtx,
            });
            clarificationCreated = true;
          } catch (e) {
          }
        }

        if (updatedStep.attempts >= 3 && updatedStep.attempts % 3 === 0) {
          updatedStep = (await storage.incrementStepEscalation(currentStep.id))!;
          escalated = true;

          if (updatedStep.escalationLevel >= 2) {
            const escalationIntegrityCtx = JSON.stringify({
              stepNumber,
              integrityLevel: integrityLevel || "caution",
              isIdempotent: isIdempotent ?? false,
              reexecutionCount: updatedStep.reexecutionCount || 0,
              duplicateFailureDetected: updatedStep.duplicateFailureDetected === "true",
            });

            try {
              const blockerHash = createHash("sha256")
                .update(`escalation-blocker-step-${stepNumber}-${sessionId}`)
                .digest("hex")
                .substring(0, 16);

              await storage.createClarificationContract({
                projectId: session.projectId,
                contractHash: blockerHash,
                originatingModule: "execution",
                currentArtifactId: session.promptArtifactId,
                currentArtifactVersion: session.promptArtifactVersion,
                upstreamArtifactId: session.promptArtifactId,
                upstreamArtifactVersion: session.promptArtifactVersion,
                category: "execution_failure",
                severity: "blocker",
                title: `Escalation Level ${updatedStep.escalationLevel}: Step ${stepNumber} blocked`,
                description: `Step ${stepNumber} has reached escalation level ${updatedStep.escalationLevel} after ${updatedStep.attempts} cumulative failures. Forward progression is unsafe without upstream review.`,
                requiredClarifications: JSON.stringify([{
                  field: "upstream_review",
                  question: `Reassess the requirements and prompts feeding Step ${stepNumber}. Consider regenerating prompts from revised requirements.`,
                  expectedAnswerType: "long_text",
                }]),
                resolutionStatus: "pending",
                occurrenceCount: updatedStep.escalationLevel,
                integrityContext: escalationIntegrityCtx,
              });
            } catch (e) {
            }
          }
        }
      } else if (status === "completed") {
        const completionHash = createHash("sha256")
          .update(`step-${stepNumber}-completed-${Date.now()}`)
          .digest("hex")
          .substring(0, 16);

        updatedStep = (await storage.updateExecutionStepStatus(currentStep.id, "completed"))!;
        await storage.setSuccessHash(currentStep.id, completionHash);

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
          duplicateFailure,
          clarificationCreated,
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

router.post(
  "/sessions/:sessionId/steps/:stepNumber/integrity-override",
  requireProjectContext,
  async (req: Request, res: Response) => {
    try {
      const stepNumber = parseInt(req.params.stepNumber, 10);
      const sessionId = req.params.sessionId;

      const session = await storage.getExecutionSession(sessionId);
      if (!session || session.projectId !== req.projectId) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Session not found" },
        });
      }

      const steps = await storage.listExecutionSteps(sessionId);
      const step = steps.find(s => s.stepNumber === stepNumber);
      if (!step) {
        return res.status(404).json({
          success: false,
          error: { code: "STEP_NOT_FOUND", message: `Step ${stepNumber} not found` },
        });
      }

      const updated = await storage.setIntegrityOverride(step.id);

      res.json({
        success: true,
        data: { step: updated },
      });
    } catch (error) {
      console.error("Error setting integrity override:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to set integrity override" },
      });
    }
  }
);

export default router;
