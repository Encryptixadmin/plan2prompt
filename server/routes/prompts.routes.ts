import { Router, Request, Response } from "express";
import { z } from "zod";
import { promptsService } from "../services/prompts.service";
import { artifactService } from "../services/artifact.service";
import { requireProjectContext, requirePermission } from "../middleware/project-context";
import { billingService } from "../services/billing.service";
import { aiGenerationRateLimiter } from "../middleware/rate-limit";
import { feedbackService } from "../services/feedback.service";
import { classifierService } from "../services/classifier.service";
import { feedbackMetricsService } from "../services/feedback-metrics.service";
import { clarificationService } from "../services/clarification.service";
import { clarificationDetectionService } from "../services/clarification-detection.service";
import { validatePromptGenerationStage, validateNotOutdated } from "../validation/pipeline.validation";
import { anthropicOpusService } from "../services/ai/anthropic-opus.service";
import { providerValidationService } from "../services/ai/provider-validation.service";
import type { PromptFeedbackRequest, BuildPrompt } from "@shared/types/prompts";
import type { OpusCompilerInput } from "@shared/types/opus-compiler";

const router = Router();

// Validation schema for prompt generation
const generatePromptsSchema = z.object({
  requirementsArtifactId: z.string().uuid("Invalid requirements artifact ID"),
  ide: z.enum(["replit", "cursor", "lovable", "antigravity", "warp", "other"]),
  clarificationContext: z.string().optional(),
});

/**
 * GET /api/prompts/requirements
 * List only LOCKED requirements artifacts for prompt generation
 * Requires project context to enforce isolation
 */
router.get("/requirements", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const artifacts = await artifactService.listByProject(req.projectId!, "requirements");
    
    const lockedRequirements = artifacts.filter((a) => a.stage === "LOCKED_REQUIREMENTS");
    const paginated = lockedRequirements.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: paginated.map((a) => ({
        id: a.id,
        title: a.title,
        version: a.version,
        createdAt: a.createdAt,
        stage: a.stage,
      })),
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error("Error listing requirements:", error);
    res.status(500).json({
      success: false,
      error: { code: "LIST_ERROR", message: "Failed to list requirements" },
    });
  }
});

/**
 * POST /api/prompts/generate
 * Generate IDE-specific build prompts from requirements
 * Requires project context and generate permission
 */
router.post(
  "/generate",
  requireProjectContext,
  requirePermission("canGenerate"),
  aiGenerationRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const validation = generatePromptsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request",
            details: validation.error.flatten(),
          },
        });
      }

      const { requirementsArtifactId, ide } = validation.data;

      // Validate that the requirements artifact exists and is in LOCKED_REQUIREMENTS stage
      const requirementsArtifact = await artifactService.getById(requirementsArtifactId);
      if (!requirementsArtifact) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Requirements artifact not found" },
        });
      }

      // ADVERSARIAL CHECK: Verify artifact belongs to current project
      if (requirementsArtifact.metadata.projectId && requirementsArtifact.metadata.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: {
            code: "PROJECT_ISOLATION_VIOLATION",
            message: "This artifact belongs to a different project. Cross-project access is not allowed.",
          },
        });
      }

      const stageValidation = validatePromptGenerationStage(requirementsArtifact.metadata.stage);
      if (!stageValidation.valid) {
        return res.status(400).json({
          success: false,
          error: stageValidation.error,
        });
      }

      // Check if this requirements artifact is outdated (source idea has newer version)
      const isOutdated = await artifactService.isArtifactOutdated(requirementsArtifactId);
      const outdatedValidation = validateNotOutdated(isOutdated.outdated, isOutdated.reason);
      if (!outdatedValidation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            ...outdatedValidation.error,
            sourceArtifactId: requirementsArtifact.metadata.sourceArtifactId,
          },
        });
      }

      const { clarificationContext } = validation.data;
      const prompts = await promptsService.generatePrompts(
        requirementsArtifactId,
        ide,
        clarificationContext
      );

      if (req.userId) {
        await billingService.recordGeneration(req.userId, 500);
      }

      let clarifications: any[] = [];
      if (req.projectId) {
        try {
          const detectionResult = clarificationDetectionService.detectPromptGaps(
            prompts,
            requirementsArtifactId,
            req.projectId
          );
          if (detectionResult.contracts.length > 0) {
            clarifications = await clarificationService.processDetectionResult(detectionResult);
          }
        } catch (err) {
          console.warn("[Prompts] Clarification detection failed (non-blocking):", err);
        }
      }

      res.json({
        success: true,
        data: { ...prompts, clarifications },
      });
    } catch (error) {
      console.error("Error generating prompts:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "GENERATION_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate prompts",
        },
      });
    }
  }
);

/**
 * POST /api/prompts/generate-stream
 * SSE streaming version of generate (streams progress events)
 */
router.post(
  "/generate-stream",
  requireProjectContext,
  requirePermission("canGenerate"),
  aiGenerationRateLimiter,
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const validation = generatePromptsSchema.safeParse(req.body);
      if (!validation.success) {
        res.write(`event: error\ndata: ${JSON.stringify({ code: "VALIDATION_ERROR", message: "Invalid request", details: validation.error.flatten() })}\n\n`);
        return res.end();
      }

      const { requirementsArtifactId, ide } = validation.data;

      const requirementsArtifact = await artifactService.getById(requirementsArtifactId);
      if (!requirementsArtifact) {
        res.write(`event: error\ndata: ${JSON.stringify({ code: "NOT_FOUND", message: "Requirements artifact not found" })}\n\n`);
        return res.end();
      }

      if (requirementsArtifact.metadata.projectId && requirementsArtifact.metadata.projectId !== req.projectId) {
        res.write(`event: error\ndata: ${JSON.stringify({ code: "PROJECT_ISOLATION_VIOLATION", message: "This artifact belongs to a different project." })}\n\n`);
        return res.end();
      }

      const stageValidation = validatePromptGenerationStage(requirementsArtifact.metadata.stage);
      if (!stageValidation.valid) {
        res.write(`event: error\ndata: ${JSON.stringify(stageValidation.error)}\n\n`);
        return res.end();
      }

      const isOutdated = await artifactService.isArtifactOutdated(requirementsArtifactId);
      const outdatedValidation = validateNotOutdated(isOutdated.outdated, isOutdated.reason);
      if (!outdatedValidation.valid) {
        res.write(`event: error\ndata: ${JSON.stringify({ ...outdatedValidation.error, sourceArtifactId: requirementsArtifact.metadata.sourceArtifactId })}\n\n`);
        return res.end();
      }

      const onProgress = (stage: string, message: string, percent: number) => {
        res.write(`event: progress\ndata: ${JSON.stringify({ stage, message, percent })}\n\n`);
      };

      const { clarificationContext } = validation.data;
      const prompts = await promptsService.generatePrompts(
        requirementsArtifactId,
        ide,
        clarificationContext,
        onProgress
      );

      if (req.userId) {
        await billingService.recordGeneration(req.userId, 500);
      }

      let clarifications: any[] = [];
      if (req.projectId) {
        try {
          const detectionResult = clarificationDetectionService.detectPromptGaps(
            prompts,
            requirementsArtifactId,
            req.projectId
          );
          if (detectionResult.contracts.length > 0) {
            clarifications = await clarificationService.processDetectionResult(detectionResult);
          }
        } catch (err) {
          console.warn("[Prompts] Clarification detection failed (non-blocking):", err);
        }
      }

      res.write(`event: result\ndata: ${JSON.stringify({ success: true, data: { ...prompts, clarifications } })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error generating prompts (stream):", error);
      res.write(`event: error\ndata: ${JSON.stringify({ code: "GENERATION_ERROR", message: error instanceof Error ? error.message : "Failed to generate prompts" })}\n\n`);
      res.end();
    }
  }
);

/**
 * GET /api/prompts/artifacts
 * List all prompt artifacts
 */
router.get("/artifacts", async (req: Request, res: Response) => {
  try {
    const artifacts = await artifactService.list("prompts");
    res.json({
      success: true,
      data: artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        version: a.version,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error listing prompt artifacts:", error);
    res.status(500).json({
      success: false,
      error: { code: "LIST_ERROR", message: "Failed to list prompt artifacts" },
    });
  }
});

const feedbackSchema = z.object({
  promptDocumentId: z.string().uuid("Invalid prompt document ID"),
  stepNumber: z.number().int().min(1, "Step number must be at least 1"),
  ide: z.enum(["replit", "cursor", "lovable", "antigravity", "warp", "other"]),
  rawIdeOutput: z.string().min(1, "Raw IDE output is required"),
});

/**
 * POST /api/prompts/feedback
 * Submit raw IDE output for deterministic failure classification
 * NO conversational AI behavior - strict pattern matching only
 */
router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const validation = feedbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid feedback request",
          details: validation.error.flatten(),
        },
      });
    }

    const request: PromptFeedbackRequest = validation.data;

    const inputValidation = feedbackService.validateInput(request);
    if (!inputValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: inputValidation.error,
        },
      });
    }

    const artifact = await artifactService.getById(request.promptDocumentId);
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Prompt document not found",
        },
      });
    }

    let stepPrompt: BuildPrompt = promptsService.getDefaultStepPrompt(request.stepNumber);
    
    const promptsSection = artifact.sections.find((s) => s.heading === "Build Prompts");
    if (promptsSection) {
      try {
        const prompts: BuildPrompt[] = JSON.parse(promptsSection.content);
        const found = prompts.find((p) => p.step === request.stepNumber);
        if (found) {
          stepPrompt = found;
        }
      } catch {
      }
    }

    const classificationResult = classifierService.classifyFailure(request.rawIdeOutput);

    const userId = req.userId || "anonymous";
    const projectId = artifact.metadata.projectId || "unknown";

    void feedbackMetricsService.recordEvent({
      userId,
      projectId,
      promptArtifactId: request.promptDocumentId,
      promptStepNumber: request.stepNumber,
      ide: request.ide,
      classification: classificationResult.pattern.category === "unknown" ? "unknown_failure" : "known_failure",
      failurePatternId: classificationResult.pattern.id,
      instructionType: classificationResult.instructionType,
      rawOutput: request.rawIdeOutput,
    });

    feedbackService.logFeedbackAttempt(
      request,
      classificationResult.response.classification,
      classificationResult.response.classification === "KNOWN_FAILURE" ? classificationResult.response.failurePatternName : undefined
    );

    let executionClarification = null;
    if (projectId && projectId !== "unknown") {
      try {
        const recentEntries = feedbackService.getRecentAuditEntries(50);
        const sameStepSamePattern = recentEntries.filter(
          e => e.promptDocumentId === request.promptDocumentId &&
               e.stepNumber === request.stepNumber &&
               e.failurePatternName === (classificationResult.response.classification === "KNOWN_FAILURE" ? classificationResult.response.failurePatternName : "unknown")
        );
        if (sameStepSamePattern.length >= 3) {
          const escalation = clarificationDetectionService.detectExecutionEscalation(
            classificationResult.pattern.id,
            sameStepSamePattern.length,
            request.stepNumber,
            request.promptDocumentId,
            projectId
          );
          if (escalation) {
            executionClarification = await clarificationService.createOrIncrementContract(escalation);
          }
        }
      } catch (err) {
        console.warn("[Prompts/Feedback] Execution escalation failed (non-blocking):", err);
      }
    }

    res.json({
      success: true,
      data: {
        ...classificationResult.response,
        executionClarification,
      },
    });
  } catch (error) {
    console.error("Error processing feedback:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to process feedback",
      },
    });
  }
});

const compileSchema = z.object({
  promptDocumentId: z.string().uuid("Invalid prompt document ID"),
  stepNumber: z.number().int().min(1, "Step number must be at least 1"),
  ide: z.enum(["replit", "cursor", "lovable", "antigravity", "warp", "other"]),
});

router.post(
  "/compile",
  requireProjectContext,
  requirePermission("canGenerate"),
  async (req: Request, res: Response) => {
    try {
      const validation = compileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid compile request",
            details: validation.error.flatten(),
          },
        });
      }

      const { promptDocumentId, stepNumber, ide } = validation.data;

      const artifact = await artifactService.getById(promptDocumentId);
      if (!artifact) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Prompt document not found" },
        });
      }

      if (artifact.metadata.projectId && artifact.metadata.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: {
            code: "PROJECT_ISOLATION_VIOLATION",
            message: "This artifact belongs to a different project.",
          },
        });
      }

      const promptsSection = artifact.sections.find((s) => s.heading === "Build Prompts");
      if (!promptsSection) {
        return res.status(400).json({
          success: false,
          error: { code: "NO_PROMPTS", message: "No build prompts found in this artifact" },
        });
      }

      let prompts: BuildPrompt[];
      try {
        prompts = JSON.parse(promptsSection.content);
      } catch {
        return res.status(500).json({
          success: false,
          error: { code: "PARSE_ERROR", message: "Failed to parse prompt data" },
        });
      }

      const step = prompts.find((p) => p.step === stepNumber);
      if (!step) {
        return res.status(404).json({
          success: false,
          error: { code: "STEP_NOT_FOUND", message: `Step ${stepNumber} not found in prompt document` },
        });
      }

      const ideNames: Record<string, string> = {
        replit: "Replit",
        cursor: "Cursor",
        lovable: "Lovable",
        antigravity: "Antigravity",
        warp: "Warp",
        other: "Generic IDE",
      };

      const opusValidation = providerValidationService.getResolvedModelId("anthropic-opus");
      if (!opusValidation) {
        return res.status(503).json({
          success: false,
          error: {
            code: "OPUS_UNAVAILABLE",
            message: "Opus compiler is not available. Check provider configuration in Admin console.",
          },
        });
      }

      const previousStepsCompleted = Array.from(
        { length: Math.min(stepNumber - 1, prompts.length) },
        (_, i) => i + 1
      );

      const compilerInput: OpusCompilerInput = {
        stepId: `${promptDocumentId}-step-${stepNumber}`,
        stepNumber,
        objective: step.title,
        promptContent: step.prompt,
        executionContext: {
          ide,
          ideName: ideNames[ide] || "Generic IDE",
          ideaTitle: artifact.metadata.title || "Untitled",
          totalSteps: prompts.length,
          currentStep: stepNumber,
          previousStepsCompleted,
        },
        constraints: [
          `Target IDE: ${ideNames[ide] || ide}`,
          "Do not add features beyond this step's scope",
          "Do not modify files outside this step's scope",
        ],
        expectedOutcome: step.title,
        verificationSteps: [
          "Application compiles without errors",
          `Step objective achieved: ${step.title}`,
        ],
        failureModes: [],
        scopeGuardrails: [
          `This is step ${stepNumber} of ${prompts.length}. Do not implement later steps.`,
          "Do not refactor existing code unless this step requires it.",
        ],
      };

      const result = await anthropicOpusService.executePrompt(compilerInput);

      if (req.userId) {
        const tokensUsed = result.tokenUsage?.totalTokens || 0;
        await billingService.recordGeneration(req.userId, tokensUsed);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error compiling prompt step:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "COMPILATION_ERROR",
          message: error instanceof Error ? error.message : "Failed to compile prompt step",
        },
      });
    }
  }
);

// Edit a specific prompt step (creates new artifact version)
router.patch(
  "/:artifactId/steps/:stepNum",
  requireProjectContext,
  async (req: Request, res: Response) => {
    try {
      const artifactId = req.params.artifactId;
      const stepNum = parseInt(req.params.stepNum, 10);

      if (isNaN(stepNum) || stepNum < 1) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid step number" },
        });
      }

      const { title, objective, prompt: promptText, expectedOutcome, waitInstruction } = req.body as {
        title?: string;
        objective?: string;
        prompt?: string;
        expectedOutcome?: string;
        waitInstruction?: string;
      };

      const existing = await artifactService.getById(artifactId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Prompt artifact not found" },
        });
      }

      if (existing.metadata.projectId && existing.metadata.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: { code: "PROJECT_ISOLATION_VIOLATION", message: "Artifact belongs to a different project" },
        });
      }

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (objective !== undefined) updates.objective = objective;
      if (promptText !== undefined) updates.prompt = promptText;
      if (expectedOutcome !== undefined) updates.expectedOutcome = expectedOutcome;
      if (waitInstruction !== undefined) updates.waitInstruction = waitInstruction;

      const result = await promptsService.updatePromptStep(artifactId, stepNum, updates as any);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Step not found or artifact has no editable JSON metadata" },
        });
      }

      res.json({
        success: true,
        data: { step: result.step },
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "UPDATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to update prompt step",
        },
      });
    }
  }
);

export default router;
