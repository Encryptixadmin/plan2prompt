import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, real } from "drizzle-orm/pg-core";
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

export const aiProviders = ["openai", "anthropic", "gemini"] as const;
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
