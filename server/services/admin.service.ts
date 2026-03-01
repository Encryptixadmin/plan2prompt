import { randomUUID } from "crypto";
import type {
  AdminActionType,
  AdminActionTarget,
  AIProvider,
} from "@shared/schema";
import { adminActionLog, projects, projectMembers, artifacts, usageRecords } from "@shared/schema";
import { users } from "@shared/models/auth";
import { db } from "../db";
import { desc, eq, sql, count, gte } from "drizzle-orm";
import { providerValidationService } from "./ai/provider-validation.service";

interface AdminActionLogEntry {
  id: string;
  adminUserId: string;
  actionType: AdminActionType;
  targetType: AdminActionTarget;
  targetId: string;
  reason?: string | null;
  previousState?: string | null;
  newState?: string | null;
  timestamp: Date;
}

interface ProviderStatus {
  provider: AIProvider;
  enabled: boolean;
  validated: boolean;
  validationError: string | null;
  modelId: string;
  resolvedModelId: string | null;
  configured: boolean;
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
  errorCount: number;
  timeoutCount: number;
  retryCount: number;
  lastSuccessfulRequest?: string;
}

interface UserSummary {
  id: string;
  username: string;
  email?: string;
  role: "viewer" | "collaborator" | "owner" | "admin";
  isAdmin: boolean;
  generationDisabled: boolean;
  generationDisabledReason?: string;
  projectCount: number;
  lastActivityAt?: string;
  usageSummary: {
    totalRequests: number;
    estimatedCost: number;
  };
  billingPlan: string;
  createdAt: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  ownerName?: string;
  memberCount: number;
  generationDisabled: boolean;
  generationDisabledReason?: string;
  artifactCount: number;
  createdAt: string;
}

interface DashboardStats {
  totalUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalProjects: number;
  totalArtifacts: number;
  totalGenerations: number;
  recentSignups: Array<{
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    billingPlan: string;
    createdAt: string;
  }>;
  userGrowth: Array<{
    month: string;
    count: number;
  }>;
  planDistribution: Array<{
    plan: string;
    count: number;
  }>;
}

class AdminService {
  private actionLog: AdminActionLogEntry[] = [];
  private providerStatus: Map<AIProvider, ProviderStatus> = new Map();
  private generationDisabledUsers: Map<string, { reason?: string }> = new Map();
  private generationDisabledProjects: Map<string, { reason?: string }> = new Map();

  constructor() {
    this.initializeProviderStatus();
  }

  private initializeProviderStatus(): void {
    const providerModels: Record<AIProvider, string> = {
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-sonnet-latest",
      gemini: "gemini-1.5-pro",
      "anthropic-opus": "claude-opus-4-6",
    };
    const providers: AIProvider[] = ["openai", "anthropic", "gemini", "anthropic-opus"];
    for (const provider of providers) {
      this.providerStatus.set(provider, {
        provider,
        enabled: true,
        validated: false,
        validationError: null,
        modelId: providerModels[provider],
        resolvedModelId: null,
        configured: false,
        errorCount: 0,
        timeoutCount: 0,
        retryCount: 0,
      });
    }
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return user?.isAdmin === "true";
    } catch {
      return false;
    }
  }

  async isUserAdminByEmail(email: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return user?.isAdmin === "true";
    } catch {
      return false;
    }
  }

  async logAction(entry: Omit<AdminActionLogEntry, "id" | "timestamp">): Promise<AdminActionLogEntry> {
    const id = randomUUID();
    const timestamp = new Date();

    const [inserted] = await db
      .insert(adminActionLog)
      .values({
        id,
        adminUserId: entry.adminUserId,
        actionType: entry.actionType,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: entry.reason ?? null,
        previousState: entry.previousState ?? null,
        newState: entry.newState ?? null,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to persist admin audit log entry");
    }

    const logEntry: AdminActionLogEntry = {
      id: inserted.id,
      adminUserId: inserted.adminUserId,
      actionType: inserted.actionType as AdminActionType,
      targetType: inserted.targetType as AdminActionTarget,
      targetId: inserted.targetId,
      reason: inserted.reason,
      previousState: inserted.previousState,
      newState: inserted.newState,
      timestamp: inserted.timestamp,
    };

    this.actionLog.push(logEntry);
    if (this.actionLog.length > 1000) {
      this.actionLog = this.actionLog.slice(-1000);
    }

    console.log(`[Admin] Action persisted: ${entry.actionType} on ${entry.targetType}:${entry.targetId} by ${entry.adminUserId}`);
    return logEntry;
  }

  async getActionLog(limit = 100): Promise<AdminActionLogEntry[]> {
    const rows = await db
      .select()
      .from(adminActionLog)
      .orderBy(desc(adminActionLog.timestamp))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      adminUserId: row.adminUserId,
      actionType: row.actionType as AdminActionType,
      targetType: row.targetType as AdminActionTarget,
      targetId: row.targetId,
      reason: row.reason,
      previousState: row.previousState,
      newState: row.newState,
      timestamp: row.timestamp,
    }));
  }

  async getProviderStatus(): Promise<ProviderStatus[]> {
    const statuses = Array.from(this.providerStatus.values());
    
    for (const status of statuses) {
      const validationResult = providerValidationService.getValidationResult(status.provider);
      if (validationResult) {
        status.validated = validationResult.validated;
        status.validationError = validationResult.validationError;
        status.modelId = validationResult.modelId;
        status.resolvedModelId = validationResult.resolvedModelId;
        status.configured = validationResult.configured;
        if (!validationResult.validated && validationResult.configured) {
          status.enabled = false;
        }
      }
    }
    
    return statuses;
  }

  async disableProvider(provider: AIProvider, adminUserId: string, reason?: string): Promise<ProviderStatus> {
    const status = this.providerStatus.get(provider);
    if (!status) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const previousState = status.enabled ? "enabled" : "disabled";
    status.enabled = false;
    status.disabledAt = new Date().toISOString();
    status.disabledBy = adminUserId;
    status.disabledReason = reason;

    await this.logAction({
      adminUserId,
      actionType: "provider_disabled",
      targetType: "provider",
      targetId: provider,
      reason,
      previousState,
      newState: "disabled",
    });

    return status;
  }

  async enableProvider(provider: AIProvider, adminUserId: string): Promise<ProviderStatus> {
    const status = this.providerStatus.get(provider);
    if (!status) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const previousState = status.enabled ? "enabled" : "disabled";
    status.enabled = true;
    status.disabledAt = undefined;
    status.disabledBy = undefined;
    status.disabledReason = undefined;

    await this.logAction({
      adminUserId,
      actionType: "provider_enabled",
      targetType: "provider",
      previousState,
      newState: "enabled",
      targetId: provider,
    });

    return status;
  }

  isProviderEnabled(provider: AIProvider): boolean {
    const status = this.providerStatus.get(provider);
    return status?.enabled ?? true;
  }

  recordProviderError(provider: AIProvider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.errorCount++;
    }
  }

  recordProviderTimeout(provider: AIProvider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.timeoutCount++;
    }
  }

  recordProviderRetry(provider: AIProvider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.retryCount++;
    }
  }

  recordProviderSuccess(provider: AIProvider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.lastSuccessfulRequest = new Date().toISOString();
    }
  }

  async getUsers(): Promise<UserSummary[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    
    const memberCounts = await db
      .select({
        userId: projectMembers.userId,
        projectCount: count(projectMembers.id),
      })
      .from(projectMembers)
      .groupBy(projectMembers.userId);

    const memberCountMap = new Map(memberCounts.map(m => [m.userId, Number(m.projectCount)]));

    const usageTotals = await db
      .select({
        userId: usageRecords.userId,
        totalRequests: count(usageRecords.id),
        totalCost: sql<number>`COALESCE(SUM(${usageRecords.estimatedCost}), 0)`,
      })
      .from(usageRecords)
      .groupBy(usageRecords.userId);

    const usageMap = new Map(usageTotals.map(u => [u.userId, { totalRequests: Number(u.totalRequests), estimatedCost: Number(u.totalCost) }]));

    return allUsers.map((user) => {
      const disabledInfo = this.generationDisabledUsers.get(user.id);
      const dbDisabled = user.generationDisabled === "true";
      return {
        id: user.id,
        username: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || `user-${user.id.slice(0, 8)}`,
        email: user.email ?? undefined,
        role: (user.isAdmin === "true" ? "admin" : "owner") as "admin" | "owner",
        isAdmin: user.isAdmin === "true",
        generationDisabled: dbDisabled || !!disabledInfo,
        generationDisabledReason: disabledInfo?.reason ?? (user.generationDisabledReason ?? undefined),
        projectCount: memberCountMap.get(user.id) || 0,
        lastActivityAt: user.updatedAt?.toISOString(),
        usageSummary: usageMap.get(user.id) || { totalRequests: 0, estimatedCost: 0 },
        billingPlan: user.billingPlan ?? "free",
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      };
    });
  }

  async disableUserGeneration(userId: string, adminUserId: string, reason: string): Promise<UserSummary> {
    this.generationDisabledUsers.set(userId, { reason });

    await db
      .update(users)
      .set({ generationDisabled: "true", generationDisabledReason: reason, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.logAction({
      adminUserId,
      actionType: "user_generation_disabled",
      targetType: "user",
      targetId: userId,
      reason,
      previousState: "enabled",
      newState: "disabled",
    });

    const allUsers = await this.getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    return user;
  }

  async enableUserGeneration(userId: string, adminUserId: string): Promise<UserSummary> {
    this.generationDisabledUsers.delete(userId);

    await db
      .update(users)
      .set({ generationDisabled: "false", generationDisabledReason: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.logAction({
      adminUserId,
      actionType: "user_generation_enabled",
      targetType: "user",
      targetId: userId,
      previousState: "disabled",
      newState: "enabled",
    });

    const allUsers = await this.getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    return user;
  }

  isUserGenerationEnabled(userId: string): { enabled: boolean; reason?: string } {
    const memInfo = this.generationDisabledUsers.get(userId);
    if (memInfo) {
      return { enabled: false, reason: memInfo.reason };
    }
    return { enabled: true };
  }

  async isUserGenerationEnabledFromDb(userId: string): Promise<{ enabled: boolean; reason?: string }> {
    const memInfo = this.generationDisabledUsers.get(userId);
    if (memInfo) {
      return { enabled: false, reason: memInfo.reason };
    }
    try {
      const [user] = await db
        .select({ generationDisabled: users.generationDisabled, generationDisabledReason: users.generationDisabledReason })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.generationDisabled === "true") {
        return { enabled: false, reason: user.generationDisabledReason ?? undefined };
      }
    } catch {}
    return { enabled: true };
  }

  async getProjects(): Promise<ProjectSummary[]> {
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));

    const memberCounts = await db
      .select({
        projectId: projectMembers.projectId,
        memberCount: count(projectMembers.id),
      })
      .from(projectMembers)
      .groupBy(projectMembers.projectId);

    const memberCountMap = new Map(memberCounts.map(m => [m.projectId, Number(m.memberCount)]));

    const artifactCounts = await db
      .select({
        projectId: artifacts.projectId,
        artifactCount: count(artifacts.id),
      })
      .from(artifacts)
      .groupBy(artifacts.projectId);

    const artifactCountMap = new Map(artifactCounts.map(a => [a.projectId, Number(a.artifactCount)]));

    const owners = await db
      .select({
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
      })
      .from(projectMembers)
      .where(eq(projectMembers.role, "owner"));

    const ownerUserIds = [...new Set(owners.map(o => o.userId))];
    let ownerNameMap = new Map<string, string>();
    if (ownerUserIds.length > 0) {
      const ownerUsers = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users);
      ownerNameMap = new Map(ownerUsers.map(u => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unknown"]));
    }
    const projectOwnerMap = new Map(owners.map(o => [o.projectId, ownerNameMap.get(o.userId) || "Unknown"]));

    return allProjects.map((project) => {
      const disabledInfo = this.generationDisabledProjects.get(project.id);
      return {
        id: project.id,
        name: project.name,
        description: project.description ?? undefined,
        ownerName: projectOwnerMap.get(project.id),
        memberCount: memberCountMap.get(project.id) || 0,
        generationDisabled: project.generationDisabled === "true" || !!disabledInfo,
        generationDisabledReason: disabledInfo?.reason ?? (project.generationDisabledReason ?? undefined),
        artifactCount: artifactCountMap.get(project.id) || 0,
        createdAt: project.createdAt.toISOString(),
      };
    });
  }

  registerProject(projectId: string, name: string, _ownerId?: string): void {
    // no-op now — projects are read from DB
  }

  async disableProjectGeneration(projectId: string, adminUserId: string, reason: string): Promise<ProjectSummary> {
    this.generationDisabledProjects.set(projectId, { reason });

    await db
      .update(projects)
      .set({ generationDisabled: "true", generationDisabledReason: reason, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await this.logAction({
      adminUserId,
      actionType: "project_generation_disabled",
      targetType: "project",
      targetId: projectId,
      reason,
      previousState: "enabled",
      newState: "disabled",
    });

    const allProjects = await this.getProjects();
    const project = allProjects.find(p => p.id === projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project;
  }

  async enableProjectGeneration(projectId: string, adminUserId: string): Promise<ProjectSummary> {
    this.generationDisabledProjects.delete(projectId);

    await db
      .update(projects)
      .set({ generationDisabled: "false", generationDisabledReason: null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await this.logAction({
      adminUserId,
      actionType: "project_generation_enabled",
      targetType: "project",
      targetId: projectId,
      previousState: "disabled",
      newState: "enabled",
    });

    const allProjects = await this.getProjects();
    const project = allProjects.find(p => p.id === projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project;
  }

  isProjectGenerationEnabled(projectId: string): { enabled: boolean; reason?: string } {
    const memInfo = this.generationDisabledProjects.get(projectId);
    if (memInfo) {
      return { enabled: false, reason: memInfo.reason };
    }
    return { enabled: true };
  }

  async isProjectGenerationEnabledFromDb(projectId: string): Promise<{ enabled: boolean; reason?: string }> {
    const memInfo = this.generationDisabledProjects.get(projectId);
    if (memInfo) {
      return { enabled: false, reason: memInfo.reason };
    }
    try {
      const [project] = await db
        .select({ generationDisabled: projects.generationDisabled, generationDisabledReason: projects.generationDisabledReason })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (project?.generationDisabled === "true") {
        return { enabled: false, reason: project.generationDisabledReason ?? undefined };
      }
    } catch {}
    return { enabled: true };
  }

  updateProjectArtifactCount(_projectId: string, _count: number): void {
    // no-op — artifact counts are read from DB
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const totalUsers = Number(totalUsersResult?.count || 0);

    const [weekResult] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, oneWeekAgo));
    const newUsersThisWeek = Number(weekResult?.count || 0);

    const [monthResult] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, oneMonthAgo));
    const newUsersThisMonth = Number(monthResult?.count || 0);

    const [projectsResult] = await db.select({ count: count() }).from(projects);
    const totalProjects = Number(projectsResult?.count || 0);

    const [artifactsResult] = await db.select({ count: count() }).from(artifacts);
    const totalArtifacts = Number(artifactsResult?.count || 0);

    const [generationsResult] = await db.select({ count: count() }).from(usageRecords);
    const totalGenerations = Number(generationsResult?.count || 0);

    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        billingPlan: users.billingPlan,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10);

    const recentSignups = recentUsers.map(u => ({
      id: u.id,
      email: u.email ?? undefined,
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      billingPlan: u.billingPlan ?? "free",
      createdAt: u.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const growthRows = await db
      .select({
        month: sql<string>`to_char(${users.createdAt}, 'YYYY-MM')`,
        count: count(),
      })
      .from(users)
      .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`);

    const userGrowth = growthRows.map(r => ({
      month: r.month,
      count: Number(r.count),
    }));

    const planRows = await db
      .select({
        plan: users.billingPlan,
        count: count(),
      })
      .from(users)
      .groupBy(users.billingPlan);

    const planDistribution = planRows.map(r => ({
      plan: r.plan ?? "free",
      count: Number(r.count),
    }));

    return {
      totalUsers,
      newUsersThisWeek,
      newUsersThisMonth,
      totalProjects,
      totalArtifacts,
      totalGenerations,
      recentSignups,
      userGrowth,
      planDistribution,
    };
  }

  async updateUserPlan(userId: string, planId: string, adminUserId: string): Promise<void> {
    const validPlans: Record<string, "free" | "starter" | "professional" | "team"> = {
      free: "free",
      starter: "starter",
      pro: "professional",
      professional: "professional",
      team: "team",
    };
    const dbPlan = validPlans[planId];
    if (!dbPlan) throw new Error(`Invalid plan: ${planId}`);

    const [user] = await db.select({ billingPlan: users.billingPlan }).from(users).where(eq(users.id, userId));
    const previousPlan = user?.billingPlan ?? "free";

    await db
      .update(users)
      .set({ billingPlan: dbPlan, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.logAction({
      adminUserId,
      actionType: "user_plan_changed",
      targetType: "user",
      targetId: userId,
      reason: `Plan changed from ${previousPlan} to ${dbPlan}`,
      previousState: previousPlan,
      newState: dbPlan,
    });
  }
}

export const adminService = new AdminService();
