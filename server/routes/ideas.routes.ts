import { Router } from "express";
import { ideasService } from "../services/ideas.service";
import type { AnalyzeIdeaRequest } from "@shared/types/ideas";

const router = Router();

// Analyze an idea
router.post("/analyze", async (req, res) => {
  try {
    const request: AnalyzeIdeaRequest = req.body;

    if (!request.idea?.title || !request.idea?.description) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: idea.title and idea.description",
        },
      });
    }

    const analysis = await ideasService.analyzeIdea(request.idea);

    res.json({
      success: true,
      data: {
        analysis,
        artifactPath: `ideas/${analysis.artifactId}`,
      },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ANALYSIS_ERROR",
        message: error instanceof Error ? error.message : "Failed to analyze idea",
      },
    });
  }
});

export default router;
