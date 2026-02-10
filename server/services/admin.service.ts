import { randomUUID } from "crypto";
import type {
  AdminActionType,
  AdminActionTarget,
  AIProvider,
} from "@shared/schema";
import { adminActionLog } from "@shared/schema";
import { db } from "../db";
import { desc } from "drizzle-orm";
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
  ownerId?: string;
  generationDisabled: boolean;
  generationDisabledReason?: string;
  artifactCount: number;
  createdAt: string;
}

class AdminService {
  private actionLog: AdminActionLogEntry[] = [];
  private providerStatus: Map<AIProvider, ProviderStatus> = new Map();
  private users: Map<string, UserSummary> = new Map();
  private projects: Map<string, ProjectSummary> = new Map();
  private adminUserIds: Set<string> = new Set(["default-user", "admin"]);

  constructor() {
    this.initializeProviderStatus();
    this.initializeDefaultAdmin();
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

  private initializeDefaultAdmin(): void {
    this.users.set("default-user", {
      id: "default-user",
      username: "admin",
      email: "admin@platform.local",
      role: "admin",
      isAdmin: true,
      generationDisabled: false,
      projectCount: 1,
      lastActivityAt: new Date().toISOString(),
      usageSummary: { totalRequests: 12, estimatedCost: 0.0045 },
      billingPlan: "free",
      createdAt: new Date().toISOString(),
    });

    this.users.set("user-alice", {
      id: "user-alice",
      username: "alice",
      email: "alice@example.com",
      role: "owner",
      isAdmin: false,
      generationDisabled: false,
      projectCount: 3,
      lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
      usageSummary: { totalRequests: 8, estimatedCost: 0.0032 },
      billingPlan: "free",
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    });

    this.users.set("user-bob", {
      id: "user-bob",
      username: "bob",
      email: "bob@company.org",
      role: "collaborator",
      isAdmin: false,
      generationDisabled: false,
      projectCount: 1,
      lastActivityAt: new Date(Date.now() - 86400000).toISOString(),
      usageSummary: { totalRequests: 3, estimatedCost: 0.0012 },
      billingPlan: "free",
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    });

    this.users.set("user-carol", {
      id: "user-carol",
      username: "carol",
      email: "carol@startup.io",
      role: "viewer",
      isAdmin: false,
      generationDisabled: false,
      projectCount: 0,
      lastActivityAt: undefined,
      usageSummary: { totalRequests: 0, estimatedCost: 0 },
      billingPlan: "free",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    });
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    return this.adminUserIds.has(userId);
  }

  async logAction(entry: Omit<AdminActionLogEntry, "id" | "timestamp">): Promise<AdminActionLogEntry> {
    const id = randomUUID();
    const timestamp = new Date();

    // Persist to database (authoritative storage)
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

    // Also keep in-memory cache for quick access
    this.actionLog.push(logEntry);
    if (this.actionLog.length > 1000) {
      this.actionLog = this.actionLog.slice(-1000);
    }

    console.log(`[Admin] Action persisted: ${entry.actionType} on ${entry.targetType}:${entry.targetId} by ${entry.adminUserId}`);
    return logEntry;
  }

  async getActionLog(limit = 100): Promise<AdminActionLogEntry[]> {
    // Read from database (authoritative)
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
      targetId: provider,
      previousState,
      newState: "enabled",
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
    return Array.from(this.users.values());
  }

  async disableUserGeneration(userId: string, adminUserId: string, reason: string): Promise<UserSummary> {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        id: userId,
        username: `user-${userId.slice(0, 8)}`,
        email: undefined,
        role: "owner",
        isAdmin: false,
        generationDisabled: false,
        projectCount: 0,
        lastActivityAt: undefined,
        usageSummary: { totalRequests: 0, estimatedCost: 0 },
        billingPlan: "free",
        createdAt: new Date().toISOString(),
      };
      this.users.set(userId, user);
    }

    const previousState = user.generationDisabled ? "disabled" : "enabled";
    user.generationDisabled = true;
    user.generationDisabledReason = reason;

    await this.logAction({
      adminUserId,
      actionType: "user_generation_disabled",
      targetType: "user",
      targetId: userId,
      reason,
      previousState,
      newState: "disabled",
    });

    return user;
  }

  async enableUserGeneration(userId: string, adminUserId: string): Promise<UserSummary> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const previousState = user.generationDisabled ? "disabled" : "enabled";
    user.generationDisabled = false;
    user.generationDisabledReason = undefined;

    await this.logAction({
      adminUserId,
      actionType: "user_generation_enabled",
      targetType: "user",
      targetId: userId,
      previousState,
      newState: "enabled",
    });

    return user;
  }

  isUserGenerationEnabled(userId: string): { enabled: boolean; reason?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { enabled: true };
    }
    return {
      enabled: !user.generationDisabled,
      reason: user.generationDisabledReason,
    };
  }

  async getProjects(): Promise<ProjectSummary[]> {
    return Array.from(this.projects.values());
  }

  registerProject(projectId: string, name: string, ownerId?: string): void {
    if (!this.projects.has(projectId)) {
      this.projects.set(projectId, {
        id: projectId,
        name,
        ownerId,
        generationDisabled: false,
        artifactCount: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async disableProjectGeneration(projectId: string, adminUserId: string, reason: string): Promise<ProjectSummary> {
    let project = this.projects.get(projectId);
    if (!project) {
      project = {
        id: projectId,
        name: `Project ${projectId.slice(0, 8)}`,
        generationDisabled: false,
        artifactCount: 0,
        createdAt: new Date().toISOString(),
      };
      this.projects.set(projectId, project);
    }

    const previousState = project.generationDisabled ? "disabled" : "enabled";
    project.generationDisabled = true;
    project.generationDisabledReason = reason;

    await this.logAction({
      adminUserId,
      actionType: "project_generation_disabled",
      targetType: "project",
      targetId: projectId,
      reason,
      previousState,
      newState: "disabled",
    });

    return project;
  }

  async enableProjectGeneration(projectId: string, adminUserId: string): Promise<ProjectSummary> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const previousState = project.generationDisabled ? "disabled" : "enabled";
    project.generationDisabled = false;
    project.generationDisabledReason = undefined;

    await this.logAction({
      adminUserId,
      actionType: "project_generation_enabled",
      targetType: "project",
      targetId: projectId,
      previousState,
      newState: "enabled",
    });

    return project;
  }

  isProjectGenerationEnabled(projectId: string): { enabled: boolean; reason?: string } {
    const project = this.projects.get(projectId);
    if (!project) {
      return { enabled: true };
    }
    return {
      enabled: !project.generationDisabled,
      reason: project.generationDisabledReason,
    };
  }

  updateProjectArtifactCount(projectId: string, count: number): void {
    const project = this.projects.get(projectId);
    if (project) {
      project.artifactCount = count;
    }
  }
}

export const adminService = new AdminService();
