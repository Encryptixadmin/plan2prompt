import { Router } from "express";
import { requireAdmin } from "../middleware/admin";
import { adminService } from "../services/admin.service";
import { usageService } from "../services/ai/usage.service";
import { artifactService } from "../services/artifact.service";
import { billingService } from "../services/billing.service";
import type { AIProvider } from "@shared/schema";

const router = Router();

router.use(requireAdmin);

router.get("/health", async (_req, res) => {
  try {
    const providerStatus = await adminService.getProviderStatus();
    res.json({
      success: true,
      data: { providers: providerStatus },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "HEALTH_ERROR",
        message: error instanceof Error ? error.message : "Failed to get provider health",
      },
    });
  }
});

router.post("/providers/:provider/disable", async (req, res) => {
  try {
    const provider = req.params.provider as AIProvider;
    const { reason, confirm } = req.body as { reason?: string; confirm?: boolean };

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
          warning: `This will disable ${provider} for all consensus operations.`,
        },
      });
    }

    const status = await adminService.disableProvider(provider, req.adminUserId!, reason);
    res.json({
      success: true,
      data: { provider: status },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DISABLE_ERROR",
        message: error instanceof Error ? error.message : "Failed to disable provider",
      },
    });
  }
});

router.post("/providers/:provider/enable", async (req, res) => {
  try {
    const provider = req.params.provider as AIProvider;
    const { confirm } = req.body as { confirm?: boolean };

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
        },
      });
    }

    const status = await adminService.enableProvider(provider, req.adminUserId!);
    res.json({
      success: true,
      data: { provider: status },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ENABLE_ERROR",
        message: error instanceof Error ? error.message : "Failed to enable provider",
      },
    });
  }
});

router.get("/usage", async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const summary = usageService.getUsageSummary(projectId);
    const recent = usageService.getRecentUsage(50);

    res.json({
      success: true,
      data: { summary, recentUsage: recent },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "USAGE_ERROR",
        message: error instanceof Error ? error.message : "Failed to get usage data",
      },
    });
  }
});

router.get("/users", async (_req, res) => {
  try {
    const users = await adminService.getUsers();
    res.json({
      success: true,
      data: { users },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "USERS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get users",
      },
    });
  }
});

router.post("/users/:userId/disable-generation", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, confirm } = req.body as { reason: string; confirm?: boolean };

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Reason is required when disabling user generation.",
        },
      });
    }

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
          warning: `This will prevent user ${userId} from generating new content. Existing content remains accessible.`,
        },
      });
    }

    const user = await adminService.disableUserGeneration(userId, req.adminUserId!, reason);
    res.json({
      success: true,
      data: { user },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DISABLE_ERROR",
        message: error instanceof Error ? error.message : "Failed to disable user generation",
      },
    });
  }
});

router.post("/users/:userId/enable-generation", async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirm } = req.body as { confirm?: boolean };

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
        },
      });
    }

    const user = await adminService.enableUserGeneration(userId, req.adminUserId!);
    res.json({
      success: true,
      data: { user },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ENABLE_ERROR",
        message: error instanceof Error ? error.message : "Failed to enable user generation",
      },
    });
  }
});

router.get("/projects", async (_req, res) => {
  try {
    const projects = await adminService.getProjects();
    res.json({
      success: true,
      data: { projects },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PROJECTS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get projects",
      },
    });
  }
});

router.post("/projects/:projectId/disable-generation", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reason, confirm } = req.body as { reason: string; confirm?: boolean };

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Reason is required when disabling project generation.",
        },
      });
    }

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
          warning: `This will prevent new content generation in project ${projectId}. Existing content remains accessible.`,
        },
      });
    }

    const project = await adminService.disableProjectGeneration(projectId, req.adminUserId!, reason);
    res.json({
      success: true,
      data: { project },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DISABLE_ERROR",
        message: error instanceof Error ? error.message : "Failed to disable project generation",
      },
    });
  }
});

router.post("/projects/:projectId/enable-generation", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { confirm } = req.body as { confirm?: boolean };

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
        },
      });
    }

    const project = await adminService.enableProjectGeneration(projectId, req.adminUserId!);
    res.json({
      success: true,
      data: { project },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ENABLE_ERROR",
        message: error instanceof Error ? error.message : "Failed to enable project generation",
      },
    });
  }
});

router.get("/dashboard/stats", async (_req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({
      success: true,
      data: stats,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DASHBOARD_ERROR",
        message: error instanceof Error ? error.message : "Failed to get dashboard stats",
      },
    });
  }
});

router.post("/users/:userId/plan", async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId, confirm } = req.body as { planId: string; confirm?: boolean };

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "planId is required.",
        },
      });
    }

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Admin action requires confirmation. Set confirm: true in request body.",
        },
      });
    }

    await adminService.updateUserPlan(userId, planId, req.adminUserId!);
    res.json({
      success: true,
      data: { userId, planId },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PLAN_UPDATE_ERROR",
        message: error instanceof Error ? error.message : "Failed to update user plan",
      },
    });
  }
});

router.get("/artifacts/integrity", async (_req, res) => {
  try {
    const artifacts = await artifactService.list();

    const stageCounts: Record<string, number> = {
      DRAFT_IDEA: 0,
      VALIDATED_IDEA: 0,
      LOCKED_REQUIREMENTS: 0,
      PROMPTS_GENERATED: 0,
    };

    let stopRecommendationsIssued = 0;
    let stopRecommendationsOverridden = 0;

    for (const artifact of artifacts) {
      const stage = artifact.stage;
      if (stage && stage in stageCounts) {
        stageCounts[stage]++;
      }
    }

    res.json({
      success: true,
      data: {
        stageCounts,
        totalArtifacts: artifacts.length,
        stopRecommendations: {
          issued: stopRecommendationsIssued,
          overridden: stopRecommendationsOverridden,
        },
      },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTEGRITY_ERROR",
        message: error instanceof Error ? error.message : "Failed to get artifact integrity data",
      },
    });
  }
});

router.get("/actions", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const actions = await adminService.getActionLog(limit);
    res.json({
      success: true,
      data: { actions },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ACTIONS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get action log",
      },
    });
  }
});

router.get("/billing/usage-by-plan", async (_req, res) => {
  try {
    const usageByPlan = await billingService.getUsageByPlan();
    const plans = billingService.getAllPlans();
    res.json({
      success: true,
      data: { usageByPlan, plans },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "BILLING_ERROR",
        message: error instanceof Error ? error.message : "Failed to get billing usage",
      },
    });
  }
});

export default router;
