import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, real, uniqueIndex, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// AUTH (Replit Auth integration)
// ============================================
export * from "./models/auth";

// Import users for foreign key references
import { users } from "./models/auth";

// ============================================
// PROJECTS
// ============================================
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  generationDisabled: text("generation_disabled").default("false").$type<"true" | "false">(),
  generationDisabledReason: text("generation_disabled_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ============================================
// PROJECT MEMBERS (Collaboration)
// ============================================
export const projectRoles = ["owner", "collaborator", "viewer"] as const;
export type ProjectRole = typeof projectRoles[number];

export const projectMembers = pgTable("project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().$type<ProjectRole>(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// ============================================
// USAGE RECORDS (Cost Tracking)
// ============================================
export const usageModules = ["ideas", "requirements", "prompts"] as const;
export type UsageModule = typeof usageModules[number];

export const aiProviders = ["openai", "anthropic", "gemini", "anthropic-opus"] as const;
export type AIProvider = typeof aiProviders[number];

export const usageRecords = pgTable("usage_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  module: text("module").notNull().$type<UsageModule>(),
  provider: text("provider").notNull().$type<AIProvider>(),
  tokensUsed: integer("tokens_used").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  actionType: text("action_type").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  timestamp: true,
});

export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;
export type UsageRecord = typeof usageRecords.$inferSelect;

// ============================================
// BILLING USAGE (Monthly generation/token tracking per user)
// ============================================
export const billingUsage = pgTable("billing_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  generationsCount: integer("generations_count").notNull().default(0),
  tokensCount: integer("tokens_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("billing_usage_user_month_idx").on(table.userId, table.yearMonth),
]);

export type BillingUsageRecord = typeof billingUsage.$inferSelect;

// ============================================
// ARTIFACTS (Pipeline Markdown artifacts stored in DB)
// ============================================
export const artifacts = pgTable("artifacts", {
  id: varchar("id").primaryKey(),
  projectId: varchar("project_id"),
  module: varchar("module").notNull(),
  filename: varchar("filename").notNull(),
  parentId: varchar("parent_id"),
  sourceArtifactId: varchar("source_artifact_id"),
  content: text("content").notNull(),
  artifactMetadata: jsonb("artifact_metadata").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("artifacts_project_id_idx").on(table.projectId),
  index("artifacts_module_idx").on(table.module),
  index("artifacts_source_artifact_id_idx").on(table.sourceArtifactId),
  index("artifacts_parent_id_idx").on(table.parentId),
]);

export type ArtifactRecord = typeof artifacts.$inferSelect;

// ============================================
// ADMIN ACTION LOG
// ============================================
export const adminActionTypes = [
  "provider_disabled",
  "provider_enabled",
  "user_generation_disabled",
  "user_generation_enabled",
  "project_generation_disabled",
  "project_generation_enabled",
  "stop_recommendation_override",
  "user_plan_changed",
] as const;
export type AdminActionType = typeof adminActionTypes[number];

export const adminActionTargets = ["provider", "user", "project", "idea"] as const;
export type AdminActionTarget = typeof adminActionTargets[number];

export const adminActionLog = pgTable("admin_action_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull(),
  actionType: text("action_type").notNull().$type<AdminActionType>(),
  targetType: text("target_type").notNull().$type<AdminActionTarget>(),
  targetId: text("target_id").notNull(),
  reason: text("reason"),
  previousState: text("previous_state"),
  newState: text("new_state"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertAdminActionLogSchema = createInsertSchema(adminActionLog).omit({
  id: true,
  timestamp: true,
});

export type InsertAdminActionLog = z.infer<typeof insertAdminActionLogSchema>;
export type AdminActionLog = typeof adminActionLog.$inferSelect;

// ============================================
// PROMPT FEEDBACK EVENTS (Write-once metrics log)
// ============================================
export const feedbackClassifications = ["known_failure", "unknown_failure"] as const;
export type FeedbackClassification = typeof feedbackClassifications[number];

export const feedbackInstructionTypes = ["retry_step", "stop_execution", "regenerate_prompts"] as const;
export type FeedbackInstructionType = typeof feedbackInstructionTypes[number];

export const promptFeedbackEvents = pgTable("prompt_feedback_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  // Context
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id").notNull(),
  promptArtifactId: varchar("prompt_artifact_id").notNull(),
  promptStepNumber: integer("prompt_step_number").notNull(),
  ide: text("ide").notNull(),
  // Classification
  classification: text("classification").notNull().$type<FeedbackClassification>(),
  failurePatternId: text("failure_pattern_id"),
  // Outcome
  instructionType: text("instruction_type").notNull().$type<FeedbackInstructionType>(),
  // Meta (no raw output stored)
  rawOutputHash: text("raw_output_hash").notNull(),
});

export const insertPromptFeedbackEventSchema = createInsertSchema(promptFeedbackEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertPromptFeedbackEvent = z.infer<typeof insertPromptFeedbackEventSchema>;
export type PromptFeedbackEvent = typeof promptFeedbackEvents.$inferSelect;

// ============================================
// CLARIFICATION CONTRACTS (Cross-module escalation)
// ============================================
export const clarificationOriginModules = ["requirements", "prompts", "execution"] as const;
export type ClarificationOriginModule = typeof clarificationOriginModules[number];

export const clarificationCategories = [
  "missing_information", "contradiction", "architecture_gap",
  "regulatory_gap", "data_model_gap", "scope_conflict", "execution_failure",
] as const;
export type ClarificationCategory = typeof clarificationCategories[number];

export const clarificationSeverities = ["advisory", "blocker"] as const;
export type ClarificationSeverity = typeof clarificationSeverities[number];

export const clarificationStatuses = ["pending", "resolved", "dismissed"] as const;
export type ClarificationResolutionStatus = typeof clarificationStatuses[number];

export const clarificationContracts = pgTable("clarification_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  originatingModule: text("originating_module").notNull().$type<ClarificationOriginModule>(),
  currentArtifactId: varchar("current_artifact_id").notNull(),
  currentArtifactVersion: integer("current_artifact_version").notNull().default(1),
  upstreamArtifactId: varchar("upstream_artifact_id").notNull(),
  upstreamArtifactVersion: integer("upstream_artifact_version").notNull().default(1),
  severity: text("severity").notNull().$type<ClarificationSeverity>(),
  category: text("category").notNull().$type<ClarificationCategory>(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  affectedEntities: text("affected_entities"),
  requiredClarifications: text("required_clarifications").notNull(),
  resolutionStatus: text("resolution_status").notNull().$type<ClarificationResolutionStatus>().default("pending"),
  contractHash: text("contract_hash").notNull(),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  resolvedAt: timestamp("resolved_at"),
  resolutionData: text("resolution_data"),
  integrityContext: text("integrity_context"),
});

export const insertClarificationContractSchema = createInsertSchema(clarificationContracts).omit({
  id: true,
  timestamp: true,
  resolvedAt: true,
});

export type InsertClarificationContract = z.infer<typeof insertClarificationContractSchema>;
export type ClarificationContractRecord = typeof clarificationContracts.$inferSelect;

// ============================================
// EXECUTION SESSIONS (Prompt execution state tracking)
// ============================================
export const executionSessionStatuses = ["active", "blocked", "completed"] as const;
export type ExecutionSessionStatus = typeof executionSessionStatuses[number];

export const executionSessions = pgTable("execution_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  promptArtifactId: varchar("prompt_artifact_id").notNull(),
  promptArtifactVersion: integer("prompt_artifact_version").notNull().default(1),
  status: text("status").notNull().$type<ExecutionSessionStatus>().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExecutionSessionSchema = createInsertSchema(executionSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExecutionSession = z.infer<typeof insertExecutionSessionSchema>;
export type ExecutionSession = typeof executionSessions.$inferSelect;

// ============================================
// EXECUTION STEPS (Per-step execution state)
// ============================================
export const executionStepStatuses = ["not_started", "in_progress", "completed", "failed"] as const;
export type ExecutionStepStatus = typeof executionStepStatuses[number];

export const executionSteps = pgTable("execution_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => executionSessions.id),
  stepNumber: integer("step_number").notNull(),
  status: text("status").notNull().$type<ExecutionStepStatus>().default("not_started"),
  attempts: integer("attempts").notNull().default(0),
  lastFailureHash: text("last_failure_hash"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  completedAt: timestamp("completed_at"),
  reexecutionCount: integer("reexecution_count").notNull().default(0),
  successHash: text("success_hash"),
  integrityOverrideConfirmed: text("integrity_override_confirmed").default("false").$type<"true" | "false">(),
  duplicateFailureDetected: text("duplicate_failure_detected").default("false").$type<"true" | "false">(),
});

export const insertExecutionStepSchema = createInsertSchema(executionSteps).omit({
  id: true,
  completedAt: true,
});

export type InsertExecutionStep = z.infer<typeof insertExecutionStepSchema>;
export type ExecutionStep = typeof executionSteps.$inferSelect;

// ============================================
// API KEYS (MCP Server authentication)
// ============================================
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKeyRecord = typeof apiKeys.$inferSelect;
