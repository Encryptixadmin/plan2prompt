import { Router } from "express";
import { ideasService } from "../services/ideas.service";
import type { AnalyzeIdeaRequest, IdeaAnalysis } from "@shared/types/ideas";
import { requireProjectContext, requirePermission } from "../middleware/project-context";

const router = Router();

// Analyze an idea (does NOT save - just returns analysis for review)
// Requires project context and generate permission
router.post(
  "/analyze",
  requireProjectContext,
  requirePermission("canGenerate"),
  async (req, res) => {
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

      const projectId = req.headers["x-project-id"] as string | undefined;
      const analysis = await ideasService.analyzeIdea(request.idea, projectId);

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
  }
);

// Accept a validated idea (saves as artifact - conscious decision point)
// Requires project context and generate permission
router.post(
  "/accept",
  requireProjectContext,
  requirePermission("canGenerate"),
  async (req, res) => {
    try {
      const { analysis, acknowledgeStopRecommendation } = req.body as {
        analysis: IdeaAnalysis;
        acknowledgeStopRecommendation?: boolean;
      };

      if (!analysis?.id || !analysis?.input) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required analysis data",
          },
        });
      }

      // ADVERSARIAL CHECK: Block accepting ideas with "stop" recommendation
      // unless user explicitly acknowledges
      if (analysis.recommendation === "stop" && !acknowledgeStopRecommendation) {
        return res.status(400).json({
          success: false,
          error: {
            code: "STOP_RECOMMENDATION",
            message: "This idea has a STOP recommendation. The analysis suggests fundamental viability concerns.",
            details: analysis.recommendationRationale,
            hint: "If you wish to proceed anyway, set acknowledgeStopRecommendation: true in the request body.",
          },
        });
      }

      // Attach project context to analysis for artifact creation
      const analysisWithProject = {
        ...analysis,
        projectId: req.projectId,
        authorId: req.userId,
      };

      const acceptedAnalysis = await ideasService.acceptIdea(analysisWithProject);

      res.json({
        success: true,
        data: {
          analysis: acceptedAnalysis,
          artifactPath: `ideas/${acceptedAnalysis.artifactId}`,
          warning: analysis.recommendation === "stop"
            ? "You accepted an idea with a STOP recommendation. Proceed with extreme caution."
            : analysis.recommendation === "revise"
              ? "This idea has a REVISE recommendation. Consider addressing identified concerns."
              : undefined,
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
  }
);

export default router;
