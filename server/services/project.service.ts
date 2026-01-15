import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectWithRole,
  ProjectArtifactSummary,
} from "@shared/types/project";
import type { ProjectRole, ProjectMember } from "@shared/schema";
import { artifactService } from "./artifact.service";
import { storage } from "../storage";

export class ProjectService {
  async create(input: CreateProjectInput, ownerId: string): Promise<Project> {
    const project = await storage.createProject({
      name: input.name,
      description: input.description ?? null,
    });

    await storage.addProjectMember({
      projectId: project.id,
      userId: ownerId,
      role: "owner",
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async getById(id: string): Promise<Project | null> {
    const project = await storage.getProject(id);
    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const project = await storage.updateProject(id, {
      name: input.name,
      description: input.description,
    });
    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async delete(id: string): Promise<boolean> {
    return storage.deleteProject(id);
  }

  async listForUser(userId: string): Promise<ProjectWithRole[]> {
    const userProjects = await storage.listUserProjects(userId);
    
    const result: ProjectWithRole[] = [];
    for (const { project, role } of userProjects) {
      const members = await storage.listProjectMembers(project.id);
      result.push({
        id: project.id,
        name: project.name,
        description: project.description ?? undefined,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        role,
        memberCount: members.length,
      });
    }

    return result.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getUserRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await storage.getProjectMember(projectId, userId);
    return member?.role ?? null;
  }

  async getMembers(projectId: string): Promise<ProjectMember[]> {
    return storage.listProjectMembers(projectId);
  }

  async addMember(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<ProjectMember | null> {
    const project = await storage.getProject(projectId);
    if (!project) return null;

    const existingRole = await this.getUserRole(projectId, userId);
    if (existingRole) return null;

    return storage.addProjectMember({
      projectId,
      userId,
      role,
    });
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<boolean> {
    const updated = await storage.updateProjectMemberRole(projectId, userId, role);
    return !!updated;
  }

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    return storage.removeProjectMember(projectId, userId);
  }

  async getArtifactSummary(projectId: string): Promise<ProjectArtifactSummary> {
    const artifacts = await artifactService.listByProject(projectId);

    return {
      projectId,
      ideaCount: artifacts.filter((a) => a.module === "ideas").length,
      requirementsCount: artifacts.filter((a) => a.module === "requirements").length,
      promptsCount: artifacts.filter((a) => a.module === "prompts").length,
    };
  }

  async createDefaultProject(userId: string): Promise<Project> {
    return this.create(
      {
        name: "My First Project",
        description: "Your default project for organizing ideas and artifacts",
      },
      userId
    );
  }

  async ensureUserHasProject(userId: string): Promise<Project> {
    const projects = await this.listForUser(userId);
    if (projects.length > 0) {
      return projects[0];
    }
    return this.createDefaultProject(userId);
  }
}

export const projectService = new ProjectService();
