import { 
  users, 
  projects,
  projectMembers,
  type User, 
  type UpsertUser,
  type Project,
  type InsertProject,
  type ProjectMember,
  type InsertProjectMember,
  type ProjectRole 
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Storage interface for platform data
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: "user" | "admin"): Promise<User | undefined>;
  updateUserBillingPlan(id: string, plan: "free" | "starter" | "professional" | "team"): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  listProjects(): Promise<Project[]>;
  
  // Project Members
  getProjectMember(projectId: string, userId: string): Promise<ProjectMember | undefined>;
  addProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  updateProjectMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember | undefined>;
  removeProjectMember(projectId: string, userId: string): Promise<boolean>;
  listProjectMembers(projectId: string): Promise<ProjectMember[]>;
  listUserProjects(userId: string): Promise<{ project: Project; role: ProjectRole }[]>;
}

// DatabaseStorage implementation using PostgreSQL
export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: "user" | "admin"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, isAdmin: role === "admin" ? "true" : "false", updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserBillingPlan(id: string, plan: "free" | "starter" | "professional" | "team"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ billingPlan: plan, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db
      .insert(projects)
      .values({
        name: project.name,
        description: project.description ?? null,
        generationDisabled: project.generationDisabled ?? "false",
        generationDisabledReason: project.generationDisabledReason ?? null,
      })
      .returning();
    return newProject;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (project.name !== undefined) updateData.name = project.name;
    if (project.description !== undefined) updateData.description = project.description;
    if (project.generationDisabled !== undefined) updateData.generationDisabled = project.generationDisabled;
    if (project.generationDisabledReason !== undefined) updateData.generationDisabledReason = project.generationDisabledReason;
    
    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return true;
  }

  async listProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  // Project Members
  async getProjectMember(projectId: string, userId: string): Promise<ProjectMember | undefined> {
    const [member] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    return member;
  }

  async addProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    const [newMember] = await db
      .insert(projectMembers)
      .values({
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
      })
      .returning();
    return newMember;
  }

  async updateProjectMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember | undefined> {
    const [updated] = await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .returning();
    return updated;
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    return true;
  }

  async listProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
  }

  async listUserProjects(userId: string): Promise<{ project: Project; role: ProjectRole }[]> {
    const memberships = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    
    const results: { project: Project; role: ProjectRole }[] = [];
    for (const membership of memberships) {
      const project = await this.getProject(membership.projectId);
      if (project) {
        results.push({ project, role: membership.role });
      }
    }
    return results;
  }
}

export const storage = new DatabaseStorage();
