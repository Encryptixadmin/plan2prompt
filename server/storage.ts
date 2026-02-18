import { 
  users, 
  projects,
  projectMembers,
  clarificationContracts,
  executionSessions,
  executionSteps,
  type User, 
  type UpsertUser,
  type Project,
  type InsertProject,
  type ProjectMember,
  type InsertProjectMember,
  type ProjectRole,
  type ClarificationContractRecord,
  type InsertClarificationContract,
  type ClarificationResolutionStatus,
  type ExecutionSession,
  type InsertExecutionSession,
  type ExecutionSessionStatus,
  type ExecutionStep,
  type InsertExecutionStep,
  type ExecutionStepStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: "user" | "admin"): Promise<User | undefined>;
  updateUserBillingPlan(id: string, plan: "free" | "starter" | "professional" | "team"): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  listProjects(): Promise<Project[]>;
  
  getProjectMember(projectId: string, userId: string): Promise<ProjectMember | undefined>;
  addProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  updateProjectMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember | undefined>;
  removeProjectMember(projectId: string, userId: string): Promise<boolean>;
  listProjectMembers(projectId: string): Promise<ProjectMember[]>;
  listUserProjects(userId: string): Promise<{ project: Project; role: ProjectRole }[]>;

  createClarificationContract(contract: InsertClarificationContract): Promise<ClarificationContractRecord>;
  getClarificationContract(id: string): Promise<ClarificationContractRecord | undefined>;
  listClarificationsByProject(projectId: string): Promise<ClarificationContractRecord[]>;
  listPendingClarificationsByProject(projectId: string): Promise<ClarificationContractRecord[]>;
  listPendingClarificationsByModule(projectId: string, module: string): Promise<ClarificationContractRecord[]>;
  getClarificationByHash(projectId: string, hash: string): Promise<ClarificationContractRecord | undefined>;
  updateClarificationStatus(id: string, status: ClarificationResolutionStatus, resolutionData?: string): Promise<ClarificationContractRecord | undefined>;
  incrementClarificationOccurrence(id: string): Promise<ClarificationContractRecord | undefined>;
  escalateClarificationToBlocker(id: string): Promise<ClarificationContractRecord | undefined>;

  createExecutionSession(session: InsertExecutionSession): Promise<ExecutionSession>;
  getExecutionSession(id: string): Promise<ExecutionSession | undefined>;
  getActiveSessionForArtifact(projectId: string, promptArtifactId: string): Promise<ExecutionSession | undefined>;
  updateExecutionSessionStatus(id: string, status: ExecutionSessionStatus): Promise<ExecutionSession | undefined>;
  listExecutionSessionsByProject(projectId: string): Promise<ExecutionSession[]>;

  createExecutionStep(step: InsertExecutionStep): Promise<ExecutionStep>;
  getExecutionStep(sessionId: string, stepNumber: number): Promise<ExecutionStep | undefined>;
  listExecutionSteps(sessionId: string): Promise<ExecutionStep[]>;
  updateExecutionStepStatus(id: string, status: ExecutionStepStatus): Promise<ExecutionStep | undefined>;
  incrementStepAttempts(id: string, failureHash: string): Promise<ExecutionStep | undefined>;
  incrementStepEscalation(id: string): Promise<ExecutionStep | undefined>;
}

export class DatabaseStorage implements IStorage {
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

  async createClarificationContract(contract: InsertClarificationContract): Promise<ClarificationContractRecord> {
    const [record] = await db
      .insert(clarificationContracts)
      .values({
        projectId: contract.projectId,
        originatingModule: contract.originatingModule as "requirements" | "prompts" | "execution",
        currentArtifactId: contract.currentArtifactId,
        currentArtifactVersion: contract.currentArtifactVersion,
        upstreamArtifactId: contract.upstreamArtifactId,
        upstreamArtifactVersion: contract.upstreamArtifactVersion,
        severity: contract.severity as "advisory" | "blocker",
        category: contract.category as any,
        title: contract.title,
        description: contract.description,
        affectedEntities: contract.affectedEntities ?? null,
        requiredClarifications: contract.requiredClarifications,
        resolutionStatus: (contract.resolutionStatus || "pending") as "pending" | "resolved" | "dismissed",
        contractHash: contract.contractHash,
        occurrenceCount: contract.occurrenceCount ?? 1,
        resolutionData: contract.resolutionData ?? null,
      })
      .returning();
    return record;
  }

  async getClarificationContract(id: string): Promise<ClarificationContractRecord | undefined> {
    const [record] = await db
      .select()
      .from(clarificationContracts)
      .where(eq(clarificationContracts.id, id));
    return record;
  }

  async listClarificationsByProject(projectId: string): Promise<ClarificationContractRecord[]> {
    return db
      .select()
      .from(clarificationContracts)
      .where(eq(clarificationContracts.projectId, projectId))
      .orderBy(desc(clarificationContracts.timestamp));
  }

  async listPendingClarificationsByProject(projectId: string): Promise<ClarificationContractRecord[]> {
    return db
      .select()
      .from(clarificationContracts)
      .where(
        and(
          eq(clarificationContracts.projectId, projectId),
          eq(clarificationContracts.resolutionStatus, "pending")
        )
      )
      .orderBy(desc(clarificationContracts.timestamp));
  }

  async listPendingClarificationsByModule(projectId: string, module: string): Promise<ClarificationContractRecord[]> {
    return db
      .select()
      .from(clarificationContracts)
      .where(
        and(
          eq(clarificationContracts.projectId, projectId),
          eq(clarificationContracts.originatingModule, module),
          eq(clarificationContracts.resolutionStatus, "pending")
        )
      )
      .orderBy(desc(clarificationContracts.timestamp));
  }

  async getClarificationByHash(projectId: string, hash: string): Promise<ClarificationContractRecord | undefined> {
    const [record] = await db
      .select()
      .from(clarificationContracts)
      .where(
        and(
          eq(clarificationContracts.projectId, projectId),
          eq(clarificationContracts.contractHash, hash),
          eq(clarificationContracts.resolutionStatus, "pending")
        )
      );
    return record;
  }

  async updateClarificationStatus(
    id: string,
    status: ClarificationResolutionStatus,
    resolutionData?: string
  ): Promise<ClarificationContractRecord | undefined> {
    const updateData: Record<string, unknown> = { resolutionStatus: status };
    if (status === "resolved" || status === "dismissed") {
      updateData.resolvedAt = new Date();
    }
    if (resolutionData) {
      updateData.resolutionData = resolutionData;
    }
    const [updated] = await db
      .update(clarificationContracts)
      .set(updateData)
      .where(eq(clarificationContracts.id, id))
      .returning();
    return updated;
  }

  async incrementClarificationOccurrence(id: string): Promise<ClarificationContractRecord | undefined> {
    const existing = await this.getClarificationContract(id);
    if (!existing) return undefined;
    const [updated] = await db
      .update(clarificationContracts)
      .set({ occurrenceCount: existing.occurrenceCount + 1 })
      .where(eq(clarificationContracts.id, id))
      .returning();
    return updated;
  }

  async escalateClarificationToBlocker(id: string): Promise<ClarificationContractRecord | undefined> {
    const [updated] = await db
      .update(clarificationContracts)
      .set({ severity: "blocker" })
      .where(eq(clarificationContracts.id, id))
      .returning();
    return updated;
  }

  async createExecutionSession(session: InsertExecutionSession): Promise<ExecutionSession> {
    const [record] = await db
      .insert(executionSessions)
      .values(session)
      .returning();
    return record;
  }

  async getExecutionSession(id: string): Promise<ExecutionSession | undefined> {
    const [record] = await db.select().from(executionSessions).where(eq(executionSessions.id, id));
    return record;
  }

  async getActiveSessionForArtifact(projectId: string, promptArtifactId: string): Promise<ExecutionSession | undefined> {
    const [record] = await db
      .select()
      .from(executionSessions)
      .where(
        and(
          eq(executionSessions.projectId, projectId),
          eq(executionSessions.promptArtifactId, promptArtifactId),
          eq(executionSessions.status, "active")
        )
      )
      .orderBy(desc(executionSessions.createdAt))
      .limit(1);
    return record;
  }

  async updateExecutionSessionStatus(id: string, status: ExecutionSessionStatus): Promise<ExecutionSession | undefined> {
    const [updated] = await db
      .update(executionSessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(executionSessions.id, id))
      .returning();
    return updated;
  }

  async listExecutionSessionsByProject(projectId: string): Promise<ExecutionSession[]> {
    return db
      .select()
      .from(executionSessions)
      .where(eq(executionSessions.projectId, projectId))
      .orderBy(desc(executionSessions.createdAt));
  }

  async createExecutionStep(step: InsertExecutionStep): Promise<ExecutionStep> {
    const [record] = await db
      .insert(executionSteps)
      .values(step)
      .returning();
    return record;
  }

  async getExecutionStep(sessionId: string, stepNumber: number): Promise<ExecutionStep | undefined> {
    const [record] = await db
      .select()
      .from(executionSteps)
      .where(
        and(
          eq(executionSteps.sessionId, sessionId),
          eq(executionSteps.stepNumber, stepNumber)
        )
      );
    return record;
  }

  async listExecutionSteps(sessionId: string): Promise<ExecutionStep[]> {
    return db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.sessionId, sessionId))
      .orderBy(asc(executionSteps.stepNumber));
  }

  async updateExecutionStepStatus(id: string, status: ExecutionStepStatus): Promise<ExecutionStep | undefined> {
    const updateData: Record<string, unknown> = { status };
    if (status === "completed") {
      updateData.completedAt = new Date();
    }
    const [updated] = await db
      .update(executionSteps)
      .set(updateData)
      .where(eq(executionSteps.id, id))
      .returning();
    return updated;
  }

  async incrementStepAttempts(id: string, failureHash: string): Promise<ExecutionStep | undefined> {
    const existing = await db.select().from(executionSteps).where(eq(executionSteps.id, id));
    if (!existing[0]) return undefined;
    const [updated] = await db
      .update(executionSteps)
      .set({
        attempts: existing[0].attempts + 1,
        lastFailureHash: failureHash,
        status: "failed" as const,
      })
      .where(eq(executionSteps.id, id))
      .returning();
    return updated;
  }

  async incrementStepEscalation(id: string): Promise<ExecutionStep | undefined> {
    const existing = await db.select().from(executionSteps).where(eq(executionSteps.id, id));
    if (!existing[0]) return undefined;
    const [updated] = await db
      .update(executionSteps)
      .set({ escalationLevel: existing[0].escalationLevel + 1 })
      .where(eq(executionSteps.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
