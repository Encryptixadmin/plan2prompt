import { Request, Response, NextFunction } from "express";
import { projectService } from "../services/project.service";
import { getRolePermissions } from "@shared/types/project";

const DEFAULT_USER_ID = "default-user";

declare global {
  namespace Express {
    interface Request {
      projectId?: string;
      userId?: string;
      userRole?: "owner" | "collaborator" | "viewer";
      permissions?: ReturnType<typeof getRolePermissions>;
    }
  }
}

export async function requireProjectContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const projectId = req.headers["x-project-id"] as string;
  const userId = (req.query.userId as string) || DEFAULT_USER_ID;

  if (!projectId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "MISSING_PROJECT_CONTEXT",
        message: "Project context is required. Include X-Project-Id header.",
      },
    });
  }

  const project = await projectService.getById(projectId);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "The specified project does not exist.",
      },
    });
  }

  const role = await projectService.getUserRole(projectId, userId);
  if (!role) {
    return res.status(403).json({
      success: false,
      error: {
        code: "ACCESS_DENIED",
        message: "You do not have access to this project.",
      },
    });
  }

  req.projectId = projectId;
  req.userId = userId;
  req.userRole = role;
  req.permissions = getRolePermissions(role);

  next();
}

export function requirePermission(permission: keyof ReturnType<typeof getRolePermissions>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.permissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: "NO_PERMISSIONS",
          message: "Permission check failed. Project context may be missing.",
        },
      });
    }

    if (!req.permissions[permission]) {
      const roleText = req.userRole || "unknown";
      return res.status(403).json({
        success: false,
        error: {
          code: "PERMISSION_DENIED",
          message: `Your role (${roleText}) does not have the '${permission}' permission required for this action.`,
          hint: getPermissionHint(permission, roleText),
        },
      });
    }

    next();
  };
}

function getPermissionHint(permission: string, role: string): string {
  const hints: Record<string, string> = {
    canEdit: "Only owners and collaborators can edit. Contact the project owner for access.",
    canGenerate: "Only owners and collaborators can generate content. Contact the project owner for access.",
    canLock: "Only the project owner can lock artifacts.",
    canDelete: "Only the project owner can delete artifacts.",
    canInvite: "Only the project owner can invite members.",
  };
  return hints[permission] || `The ${permission} permission is required.`;
}
