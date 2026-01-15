import { Router, Request, Response } from "express";
import { z } from "zod";
import { promptsService } from "../services/prompts.service";
import { artifactService } from "../services/artifact.service";
import { requireProjectContext, requirePermission } from "../middleware/project-context";
import { billingService } from "../services/billing.service";

const router = Router();

// Validation schema for prompt generation
const generatePromptsSchema = z.object({
  requirementsArtifactId: z.string().uuid("Invalid requirements artifact ID"),
  ide: z.enum(["replit", "cursor", "lovable", "antigravity", "warp", "other"]),
});

/**
 * GET /api/prompts/requirements
 * List only LOCKED requirements artifacts for prompt generation
 * Requires project context to enforce isolation
 */
router.get("/requirements", requireProjectContext, async (req: Request, res: Response) => {
  try {
    // ADVERSARIAL FIX: Only list requirements from the current project
    const artifacts = await artifactService.listByProject(req.projectId!, "requirements");
    
    // Only return requirements with LOCKED_REQUIREMENTS stage
    const lockedRequirements = artifacts.filter((a) => a.stage === "LOCKED_REQUIREMENTS");
    
    res.json({
      success: true,
      data: lockedRequirements.map((a) => ({
        id: a.id,
        title: a.title,
        version: a.version,
        createdAt: a.createdAt,
        stage: a.stage,
      })),
    });
  } catch (error) {
    console.error("Error listing requirements:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list requirements",
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
  async (req: Request, res: Response) => {
    try {
      const validation = generatePromptsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid request",
          details: validation.error.flatten(),
        });
      }

      const { requirementsArtifactId, ide } = validation.data;

      // Validate that the requirements artifact exists and is in LOCKED_REQUIREMENTS stage
      const requirementsArtifact = await artifactService.getById(requirementsArtifactId);
      if (!requirementsArtifact) {
        return res.status(404).json({
          success: false,
          error: "Requirements artifact not found",
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

      if (requirementsArtifact.metadata.stage !== "LOCKED_REQUIREMENTS") {
        const currentStage = requirementsArtifact.metadata.stage;
        const hint = currentStage
          ? `Current stage: ${currentStage}. Complete the Requirements Module first.`
          : "Stage metadata missing. These requirements may have been created before stage tracking. Please regenerate requirements from a validated idea.";
        return res.status(400).json({
          success: false,
          error: {
            code: "PIPELINE_VIOLATION",
            message: "Build prompts require locked, up-to-date requirements.",
            hint,
          },
        });
      }

      // Check if this requirements artifact is outdated (source idea has newer version)
      const isOutdated = await artifactService.isArtifactOutdated(requirementsArtifactId);
      if (isOutdated.outdated) {
        return res.status(400).json({
          success: false,
          error: {
            code: "PIPELINE_VIOLATION",
            message: "Build prompts require locked, up-to-date requirements.",
            hint: isOutdated.reason,
            sourceArtifactId: requirementsArtifact.metadata.sourceArtifactId,
          },
        });
      }

      const prompts = await promptsService.generatePrompts(
        requirementsArtifactId,
        ide
      );

      // Record generation to billing service (prompts are template-based, estimate ~500 tokens)
      if (req.userId) {
        billingService.recordGeneration(req.userId, 500);
      }

      res.json({
        success: true,
        data: prompts,
      });
    } catch (error) {
      console.error("Error generating prompts:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate prompts",
      });
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
      error: "Failed to list prompt artifacts",
    });
  }
});

export default router;
