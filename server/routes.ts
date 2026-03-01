import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import type { HealthCheckResponse } from "@shared/types";
import artifactRoutes from "./routes/artifact.routes";
import aiRoutes from "./routes/ai.routes";
import ideasRoutes from "./routes/ideas.routes";
import requirementsRoutes from "./routes/requirements.routes";
import promptsRoutes from "./routes/prompts.routes";
import projectRoutes from "./routes/project.routes";
import adminRoutes from "./routes/admin.routes";
import billingRoutes from "./routes/billing.routes";
import clarificationRoutes from "./routes/clarification.routes";
import executionRoutes from "./routes/execution.routes";
import accountRoutes from "./routes/account.routes";
import mcpRoutes from "./mcp/server";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/health", async (_req, res) => {
    let dbStatus: "connected" | "error" = "error";
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch {}

    const response: HealthCheckResponse = {
      status: dbStatus === "connected" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
    };
    const statusCode = dbStatus === "connected" ? 200 : 503;
    res.status(statusCode).json(response);
  });

  // Artifact management routes
  app.use("/api/artifacts", artifactRoutes);

  // AI orchestration routes
  app.use("/api/ai", aiRoutes);

  // Ideas module routes
  app.use("/api/ideas", ideasRoutes);

  // Requirements module routes
  app.use("/api/requirements", requirementsRoutes);

  // Prompts module routes
  app.use("/api/prompts", promptsRoutes);

  // Project management routes
  app.use("/api/projects", projectRoutes);

  // Admin console routes (protected by admin middleware)
  app.use("/api/admin", adminRoutes);

  // Billing routes (user-facing)
  app.use("/api/billing", billingRoutes);

  // Clarification contract routes
  app.use("/api/clarifications", clarificationRoutes);

  // Execution state tracking routes
  app.use("/api/execution", executionRoutes);

  // Account management routes (API keys)
  app.use("/api/account", accountRoutes);

  // MCP server routes (IDE integration)
  app.use("/mcp", mcpRoutes);

  return httpServer;
}
