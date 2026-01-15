/**
 * Project Type Definitions
 * 
 * Projects are containers for artifacts. Each project isolates work completely.
 * Artifacts never belong to more than one project.
 */

import type { ProjectRole } from "@shared/schema";

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user?: ProjectUser;
}

export interface ProjectUser {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
}

export interface ProjectWithRole extends Project {
  role: ProjectRole;
  memberCount?: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

export interface InviteMemberInput {
  email: string;
  role: ProjectRole;
}

export interface ProjectArtifactSummary {
  projectId: string;
  ideaCount: number;
  requirementsCount: number;
  promptsCount: number;
}

export interface ActiveProjectContext {
  project: Project;
  role: ProjectRole;
  canEdit: boolean;
  canLock: boolean;
  canInvite: boolean;
}

export function getRolePermissions(role: ProjectRole): {
  canView: boolean;
  canEdit: boolean;
  canGenerate: boolean;
  canLock: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canExport: boolean;
} {
  switch (role) {
    case "owner":
      return {
        canView: true,
        canEdit: true,
        canGenerate: true,
        canLock: true,
        canDelete: true,
        canInvite: true,
        canExport: true,
      };
    case "collaborator":
      return {
        canView: true,
        canEdit: true,
        canGenerate: true,
        canLock: false,
        canDelete: false,
        canInvite: false,
        canExport: true,
      };
    case "viewer":
      return {
        canView: true,
        canEdit: false,
        canGenerate: false,
        canLock: false,
        canDelete: false,
        canInvite: false,
        canExport: true,
      };
  }
}
