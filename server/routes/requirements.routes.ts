import { Router } from "express";
import { requirementsService } from "../services/requirements.service";
import { artifactService } from "../services/artifact.service";
import type { GenerateRequirementsRequest, RequirementsDocument } from "@shared/types/requirements";
import { requireProjectContext, requirePermission } from "../middleware/project-context";
import { validateRequirementsGenerationStage } from "../validation/pipeline.validation";

const router = Router();

// List available VALIDATED ideas for requirements generation
// Requires project context to enforce isolation
router.get("/ideas", requireProjectContext, async (req, res) => {
  try {
    // ADVERSARIAL FIX: Only list ideas from the current project
    const artifacts = await artifactService.listByProject(req.projectId!, "ideas");

    // Only return ideas with VALIDATED_IDEA stage
    const validatedIdeas = artifacts.filter((a) => a.stage === "VALIDATED_IDEA");

    const ideas = validatedIdeas.map((a) => ({
      id: a.id,
      title: a.title.replace("Ideas Reference: ", ""),
      version: a.version,
      createdAt: a.createdAt,
      stage: a.stage,
    }));

    res.json({
      success: true,
      data: ideas,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LIST_ERROR",
        message: error instanceof Error ? error.message : "Failed to list ideas",
      },
    });
  }
});

// Get idea artifact preview
router.get("/ideas/:id/preview", async (req, res) => {
  try {
    const artifact = await artifactService.getById(req.params.id);
    
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Idea artifact not found",
        },
      });
    }

    // Extract summary info from artifact
    const title = artifact.metadata.title.replace("Ideas Reference: ", "");
    const summarySection = artifact.sections.find(s => s.heading === "Executive Summary");
    const overviewSection = artifact.sections.find(s => s.heading === "Idea Overview");
    const strengthsSection = artifact.sections.find(s => s.heading === "Strengths");
    
    res.json({
      success: true,
      data: {
        id: artifact.metadata.id,
        title,
        version: artifact.metadata.version,
        createdAt: artifact.metadata.createdAt,
        stage: artifact.metadata.stage,
        summary: summarySection?.content || "",
        overview: overviewSection?.content || "",
        strengths: strengthsSection?.content || "",
      },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PREVIEW_ERROR",
        message: error instanceof Error ? error.message : "Failed to get idea preview",
      },
    });
  }
});

// Generate requirements from an idea (does NOT save - returns for review)
// Requires project context and generate permission
router.post(
  "/generate",
  requireProjectContext,
  requirePermission("canGenerate"),
  async (req, res) => {
    try {
      const request: GenerateRequirementsRequest = req.body;

      if (!request.ideaArtifactId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required field: ideaArtifactId",
          },
        });
      }

      // Validate that the idea artifact exists and is in VALIDATED_IDEA stage
      const ideaArtifact = await artifactService.getById(request.ideaArtifactId);
      if (!ideaArtifact) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Idea artifact not found",
          },
        });
      }

      // ADVERSARIAL CHECK: Verify artifact belongs to current project
      if (ideaArtifact.metadata.projectId && ideaArtifact.metadata.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: {
            code: "PROJECT_ISOLATION_VIOLATION",
            message: "This artifact belongs to a different project. Cross-project access is not allowed.",
          },
        });
      }

      const stageValidation = validateRequirementsGenerationStage(ideaArtifact.metadata.stage);
      if (!stageValidation.valid) {
        return res.status(400).json({
          success: false,
          error: stageValidation.error,
        });
      }

      const projectId = req.headers["x-project-id"] as string | undefined;
      const userId = req.userId;
      const requirements = await requirementsService.generateRequirements(
        request.ideaArtifactId,
        projectId,
        userId
      );

      res.json({
        success: true,
        data: {
          requirements,
        },
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate requirements";
      const status = message.includes("not found") ? 404 : 500;

      res.status(status).json({
        success: false,
        error: {
          code: status === 404 ? "NOT_FOUND" : "GENERATION_ERROR",
          message,
        },
      });
    }
  }
);

// Accept requirements (saves as artifact - commitment point)
// Requires project context and generate permission
router.post(
  "/accept",
  requireProjectContext,
  requirePermission("canGenerate"),
  async (req, res) => {
    try {
      const { requirements } = req.body as { requirements: RequirementsDocument };

      if (!requirements?.id || !requirements?.ideaArtifactId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required requirements data",
          },
        });
      }

      // Validate that the source idea artifact exists and is in VALIDATED_IDEA stage
      const ideaArtifact = await artifactService.getById(requirements.ideaArtifactId);
      if (!ideaArtifact) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Source idea artifact not found",
          },
        });
      }

      // ADVERSARIAL CHECK: Verify artifact belongs to current project
      if (ideaArtifact.metadata.projectId && ideaArtifact.metadata.projectId !== req.projectId) {
        return res.status(403).json({
          success: false,
          error: {
            code: "PROJECT_ISOLATION_VIOLATION",
            message: "This artifact belongs to a different project. Cross-project access is not allowed.",
          },
        });
      }

      if (ideaArtifact.metadata.stage !== "VALIDATED_IDEA") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STAGE",
            message: "Requirements can only be accepted from validated ideas. The source idea must be in VALIDATED_IDEA stage.",
          },
        });
      }

      // Attach project context to requirements for artifact creation
      const requirementsWithProject = {
        ...requirements,
        projectId: req.projectId,
        authorId: req.userId,
      };

      const acceptedRequirements = await requirementsService.acceptRequirements(requirementsWithProject);

      res.json({
        success: true,
        data: {
          requirements: acceptedRequirements,
          artifactPath: `requirements/${acceptedRequirements.artifactId}`,
        },
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "ACCEPT_ERROR",
          message: error instanceof Error ? error.message : "Failed to accept requirements",
        },
      });
    }
  }
);

export default router;
