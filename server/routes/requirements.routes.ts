import { Router } from "express";
import { requirementsService } from "../services/requirements.service";
import { artifactService } from "../services/artifact.service";
import type { GenerateRequirementsRequest } from "@shared/types/requirements";

const router = Router();

// List available ideas for requirements generation
router.get("/ideas", async (_req, res) => {
  try {
    const artifacts = await artifactService.list("ideas");

    const ideas = artifacts.map((a) => ({
      id: a.id,
      title: a.title.replace("Ideas Reference: ", ""),
      version: a.version,
      createdAt: a.createdAt,
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

// Generate requirements from an idea
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

    const requirements = await requirementsService.generateRequirements(
      request.ideaArtifactId
    );

    res.json({
      success: true,
      data: {
        requirements,
        artifactPath: `requirements/${requirements.artifactId}`,
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

export default router;
