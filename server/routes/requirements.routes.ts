import { Router } from "express";
import { requirementsService } from "../services/requirements.service";
import { artifactService } from "../services/artifact.service";
import type { GenerateRequirementsRequest, RequirementsDocument } from "@shared/types/requirements";

const router = Router();

// List available VALIDATED ideas for requirements generation
router.get("/ideas", async (_req, res) => {
  try {
    const artifacts = await artifactService.list("ideas");

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
router.post("/generate", async (req, res) => {
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

    if (ideaArtifact.metadata.stage !== "VALIDATED_IDEA") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STAGE",
          message: "Only validated ideas can be used to generate requirements. The idea must be in VALIDATED_IDEA stage.",
        },
      });
    }

    const requirements = await requirementsService.generateRequirements(
      request.ideaArtifactId
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
});

// Accept requirements (saves as artifact - commitment point)
router.post("/accept", async (req, res) => {
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

    const acceptedRequirements = await requirementsService.acceptRequirements(requirements);

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
});

export default router;
