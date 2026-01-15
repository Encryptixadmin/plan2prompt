import { randomUUID } from "crypto";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectWithRole,
  ProjectArtifactSummary,
} from "@shared/types/project";
import type { ProjectRole } from "@shared/schema";
import { artifactService } from "./artifact.service";

interface StoredMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
}

interface ProjectStore {
  projects: Map<string, Project>;
  members: Map<string, StoredMember>;
}

const store: ProjectStore = {
  projects: new Map(),
  members: new Map(),
};

export class ProjectService {
  async create(input: CreateProjectInput, ownerId: string): Promise<Project> {
    const now = new Date().toISOString();
    const id = randomUUID();

    const project: Project = {
      id,
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };

    store.projects.set(id, project);

    const memberId = randomUUID();
    const member: StoredMember = {
      id: memberId,
      projectId: id,
      userId: ownerId,
      role: "owner",
      joinedAt: now,
    };
    store.members.set(memberId, member);

    return project;
  }

  async getById(id: string): Promise<Project | null> {
    return store.projects.get(id) || null;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const project = store.projects.get(id);
    if (!project) return null;

    const updated: Project = {
      ...project,
      name: input.name ?? project.name,
      description: input.description ?? project.description,
      updatedAt: new Date().toISOString(),
    };

    store.projects.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const project = store.projects.get(id);
    if (!project) return false;

    const entries = Array.from(store.members.entries());
    for (const [memberId, member] of entries) {
      if (member.projectId === id) {
        store.members.delete(memberId);
      }
    }

    store.projects.delete(id);
    return true;
  }

  async listForUser(userId: string): Promise<ProjectWithRole[]> {
    const userProjects: ProjectWithRole[] = [];
    const members = Array.from(store.members.values());

    for (const member of members) {
      if (member.userId === userId) {
        const project = store.projects.get(member.projectId);
        if (project) {
          const memberCount = this.getMemberCount(member.projectId);
          userProjects.push({
            ...project,
            role: member.role,
            memberCount,
          });
        }
      }
    }

    return userProjects.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getUserRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const members = Array.from(store.members.values());
    for (const member of members) {
      if (member.projectId === projectId && member.userId === userId) {
        return member.role;
      }
    }
    return null;
  }

  async getMembers(projectId: string): Promise<StoredMember[]> {
    const result: StoredMember[] = [];
    const members = Array.from(store.members.values());
    for (const member of members) {
      if (member.projectId === projectId) {
        result.push(member);
      }
    }
    return result;
  }

  async addMember(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<StoredMember | null> {
    const project = store.projects.get(projectId);
    if (!project) return null;

    const existingRole = await this.getUserRole(projectId, userId);
    if (existingRole) return null;

    const now = new Date().toISOString();
    const id = randomUUID();
    const member: StoredMember = {
      id,
      projectId,
      userId,
      role,
      joinedAt: now,
    };

    store.members.set(id, member);
    return member;
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<boolean> {
    const entries = Array.from(store.members.entries());
    for (const [memberId, member] of entries) {
      if (member.projectId === projectId && member.userId === userId) {
        store.members.set(memberId, { ...member, role });
        return true;
      }
    }
    return false;
  }

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const entries = Array.from(store.members.entries());
    for (const [memberId, member] of entries) {
      if (member.projectId === projectId && member.userId === userId) {
        store.members.delete(memberId);
        return true;
      }
    }
    return false;
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

  private getMemberCount(projectId: string): number {
    let count = 0;
    const members = Array.from(store.members.values());
    for (const member of members) {
      if (member.projectId === projectId) {
        count++;
      }
    }
    return count;
  }
}

export const projectService = new ProjectService();
