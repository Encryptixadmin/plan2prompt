import { Router } from "express";
import { projectService } from "../services/project.service";
import { artifactService } from "../services/artifact.service";
import { storage } from "../storage";
import type { CreateProjectInput, UpdateProjectInput } from "@shared/types/project";
import { getRolePermissions } from "@shared/types/project";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

function getUserId(req: any): string | undefined {
  if (req.session?.localUserId) {
    return req.session.localUserId;
  }
  return req.user?.claims?.sub;
}

router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
    
    const projects = await projectService.listForUser(userId);

    res.json({
      success: true,
      data: projects,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LIST_ERROR",
        message: error instanceof Error ? error.message : "Failed to list projects",
      },
    });
  }
});

router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const project = await projectService.getById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Project not found",
        },
      });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
    
    const role = await projectService.getUserRole(req.params.id, userId);

    res.json({
      success: true,
      data: {
        ...project,
        role,
        permissions: role ? getRolePermissions(role) : null,
      },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "GET_ERROR",
        message: error instanceof Error ? error.message : "Failed to get project",
      },
    });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  try {
    const input: CreateProjectInput = req.body;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    if (!input.name) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Project name is required",
        },
      });
    }

    const project = await projectService.create(input, userId);

    res.status(201).json({
      success: true,
      data: project,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "CREATE_ERROR",
        message: error instanceof Error ? error.message : "Failed to create project",
      },
    });
  }
});

router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const input: UpdateProjectInput = req.body;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const role = await projectService.getUserRole(req.params.id, userId);
    if (!role || role !== "owner") {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only the project owner can update project settings",
        },
      });
    }

    const project = await projectService.update(req.params.id, input);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Project not found",
        },
      });
    }

    res.json({
      success: true,
      data: project,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "UPDATE_ERROR",
        message: error instanceof Error ? error.message : "Failed to update project",
      },
    });
  }
});

router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const role = await projectService.getUserRole(req.params.id, userId);
    if (!role || role !== "owner") {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only the project owner can delete the project",
        },
      });
    }

    const deleted = await projectService.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Project not found",
        },
      });
    }

    res.json({
      success: true,
      data: { deleted: true },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DELETE_ERROR",
        message: error instanceof Error ? error.message : "Failed to delete project",
      },
    });
  }
});

router.get("/:id/members", isAuthenticated, async (req, res) => {
  try {
    const members = await projectService.getMembers(req.params.id);

    res.json({
      success: true,
      data: members,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MEMBERS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get members",
      },
    });
  }
});

router.get("/:id/summary", isAuthenticated, async (req, res) => {
  try {
    const summary = await projectService.getArtifactSummary(req.params.id);

    res.json({
      success: true,
      data: summary,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "SUMMARY_ERROR",
        message: error instanceof Error ? error.message : "Failed to get project summary",
      },
    });
  }
});

router.post("/ensure-default", isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
    
    const project = await projectService.ensureUserHasProject(userId);

    res.json({
      success: true,
      data: project,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ENSURE_ERROR",
        message: error instanceof Error ? error.message : "Failed to ensure default project",
      },
    });
  }
});

router.get("/:id/pipeline", isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const ideaArtifacts = await artifactService.listByProject(projectId, "ideas");

    const pipeline = await Promise.all(
      ideaArtifacts.map(async (idea) => {
        const requirementsRecords = await storage.getArtifactsBySourceId(idea.id);
        const requirementArtifacts = requirementsRecords.filter(
          (r) => r.module === "requirements"
        );

        let promptsCount = 0;
        let latestPromptsId: string | null = null;

        let latestPromptsDate = 0;
        for (const reqArt of requirementArtifacts) {
          const promptRecords = await storage.getArtifactsBySourceId(reqArt.id);
          const prompts = promptRecords.filter((r) => r.module === "prompts");
          promptsCount += prompts.length;
          if (prompts.length > 0) {
            const sorted = prompts.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const newestTime = new Date(sorted[0].createdAt).getTime();
            if (newestTime > latestPromptsDate) {
              latestPromptsDate = newestTime;
              latestPromptsId = sorted[0].id;
            }
          }
        }

        const latestRequirementsId =
          requirementArtifacts.length > 0
            ? requirementArtifacts.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0].id
            : null;

        let stage: string = "idea_submitted";
        if (promptsCount > 0) {
          stage = "prompts_generated";
        } else if (requirementArtifacts.length > 0) {
          stage = "requirements_generated";
        } else if (idea.stage) {
          stage = idea.stage;
        }

        return {
          id: idea.id,
          title: idea.title,
          stage,
          createdAt: idea.createdAt,
          requirementsCount: requirementArtifacts.length,
          promptsCount,
          latestRequirementsId,
          latestPromptsId,
        };
      })
    );

    res.json({
      success: true,
      data: pipeline,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PIPELINE_ERROR",
        message: error instanceof Error ? error.message : "Failed to get pipeline data",
      },
    });
  }
});

export default router;
