import { Router } from "express";
import { ideasService } from "../services/ideas.service";
import type { AnalyzeIdeaRequest, IdeaAnalysis } from "@shared/types/ideas";

const router = Router();

// Analyze an idea (does NOT save - just returns analysis for review)
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

// Accept a validated idea (saves as artifact - conscious decision point)
router.post("/accept", async (req, res) => {
  try {
    const { analysis } = req.body as { analysis: IdeaAnalysis };

    if (!analysis?.id || !analysis?.input) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required analysis data",
        },
      });
    }

    const acceptedAnalysis = await ideasService.acceptIdea(analysis);

    res.json({
      success: true,
      data: {
        analysis: acceptedAnalysis,
        artifactPath: `ideas/${acceptedAnalysis.artifactId}`,
      },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ACCEPT_ERROR",
        message: error instanceof Error ? error.message : "Failed to accept idea",
      },
    });
  }
});

export default router;
