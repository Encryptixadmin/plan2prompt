import { Router } from "express";
import { ideasService } from "../services/ideas.service";
import { workshopService } from "../services/workshop.service";
import { artifactService } from "../services/artifact.service";
import type { AnalyzeIdeaRequest, IdeaAnalysis } from "@shared/types/ideas";
import { requireProjectContext, requirePermission } from "../middleware/project-context";
import { adminService } from "../services/admin.service";
import { computeRiskDeltas, applyDeltasToAnalysis, computeDeltaScoreAdjustment } from "../services/risk-delta.service";
import { aiGenerationRateLimiter } from "../middleware/rate-limit";

const router = Router();

router.get(
  "/",
  requireProjectContext,
  async (req, res) => {
    try {
      const artifacts = await artifactService.listByProject(req.projectId!, "ideas");
      const validated = artifacts.filter((a) => a.stage === "VALIDATED_IDEA");
      const data = validated.map((a) => ({
        id: a.id,
        title: a.title.replace(/^Ideas Reference:\s*/i, ""),
        version: a.version,
        createdAt: a.createdAt,
        stage: a.stage,
      }));
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "LIST_ERROR",
          message: error instanceof Error ? error.message : "Failed to list saved ideas",
        },
      });
    }
  }
);

router.get(
  "/:id",
  requireProjectContext,
  async (req, res) => {
    try {
      const artifact = await artifactService.getById(req.params.id);
      if (!artifact) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Idea not found" },
        });
      }
      if (artifact.metadata.projectId !== req.projectId) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Idea not found" },
        });
      }
      let score: number | null = null;
      const scoreMatch = artifact.rawContent.match(/\*\*Overall Score:\*\*\s*(\d+)\/100/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
      }
      res.json({
        success: true,
        data: {
          id: artifact.metadata.id,
          title: artifact.metadata.title.replace(/^Ideas Reference:\s*/i, ""),
          version: artifact.metadata.version,
          createdAt: artifact.metadata.createdAt,
          stage: artifact.metadata.stage,
          score,
          rawContent: artifact.rawContent,
          sections: artifact.sections,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "GET_ERROR",
          message: error instanceof Error ? error.message : "Failed to get idea",
        },
      });
    }
  }
);

// Analyze an idea (does NOT save - just returns analysis for review)
// Requires project context and generate permission
router.post(
  "/analyze",
  requireProjectContext,
  requirePermission("canGenerate"),
  aiGenerationRateLimiter,
  async (req, res) => {
    try {
      const request = req.body as AnalyzeIdeaRequest & { previousAnalysis?: IdeaAnalysis };

      if (!request.idea?.title || !request.idea?.description) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: idea.title and idea.description",
          },
        });
      }

      const validPurposes = ["commercial", "developer_tool", "internal", "open_source", "learning"];
      if (request.idea.purpose && !validPurposes.includes(request.idea.purpose)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid purpose. Must be one of: ${validPurposes.join(", ")}`,
          },
        });
      }

      const projectId = req.headers["x-project-id"] as string | undefined;
      const userId = req.userId;
      let analysis = await ideasService.analyzeIdea(request.idea, projectId, userId);

      if (request.idea.context?.workshopRefinement && request.previousAnalysis) {
        const deltas = computeRiskDeltas(request.previousAnalysis, analysis);
        if (deltas.length > 0) {
          analysis = applyDeltasToAnalysis(analysis, deltas);
          const scoreBonus = computeDeltaScoreAdjustment(deltas);
          if (scoreBonus > 0) {
            analysis.overallScore = Math.min(100, analysis.overallScore + scoreBonus);
          }
        }
      }

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
      if (analysis.recommendation === "stop" && acknowledgeStopRecommendation !== true) {
        return res.status(400).json({
          success: false,
          error: {
            code: "STOP_RECOMMENDATION_REQUIRED",
            message: "This idea has a STOP recommendation. You must explicitly acknowledge this before proceeding.",
            details: analysis.recommendationRationale,
            hint: "Set acknowledgeStopRecommendation: true in the request body to override.",
          },
        });
      }

      // Attach project context to analysis for artifact creation
      const analysisWithProject = {
        ...analysis,
        projectId: req.projectId,
        authorId: req.userId,
      };

      // Pass STOP acknowledgement flag to service for metadata recording
      const stopAcknowledged = analysis.recommendation === "stop" && acknowledgeStopRecommendation === true;
      const acceptedAnalysis = await ideasService.acceptIdea(analysisWithProject, stopAcknowledged);

      // Log STOP override to admin audit log
      if (stopAcknowledged) {
        await adminService.logAction({
          adminUserId: req.userId || "unknown",
          actionType: "stop_recommendation_override",
          targetType: "idea",
          targetId: acceptedAnalysis.artifactId || acceptedAnalysis.id,
          reason: `User acknowledged STOP recommendation and proceeded with idea: ${analysis.input.title}`,
          previousState: "stop_recommendation",
          newState: "accepted_with_override",
        });
      }

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

router.post(
  "/workshop/next",
  requireProjectContext,
  requirePermission("canGenerate"),
  async (req, res) => {
    try {
      const { analysis, conversationHistory, researchBrief } = req.body as {
        analysis: IdeaAnalysis;
        conversationHistory: { question: string; answer: string; turnNumber: number }[];
        researchBrief?: string;
      };

      if (!analysis?.input?.title || !analysis?.input?.description) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required analysis data",
          },
        });
      }

      const validatedHistory = Array.isArray(conversationHistory)
        ? conversationHistory
            .filter(
              (t: any) =>
                t &&
                typeof t.question === "string" &&
                t.question.trim().length > 0 &&
                typeof t.answer === "string" &&
                t.answer.trim().length > 0 &&
                typeof t.turnNumber === "number" &&
                t.turnNumber > 0
            )
            .map((t: any, idx: number) => ({
              question: t.question.trim(),
              answer: t.answer.trim(),
              turnNumber: idx + 1,
            }))
            .slice(0, 7)
        : [];

      const projectId = req.headers["x-project-id"] as string | undefined;
      const userId = req.userId;

      const result = await workshopService.generateNextQuestion(
        analysis,
        validatedHistory,
        researchBrief,
        projectId,
        userId
      );

      res.json({
        success: true,
        data: result,
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "WORKSHOP_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate workshop question",
        },
      });
    }
  }
);

export default router;
