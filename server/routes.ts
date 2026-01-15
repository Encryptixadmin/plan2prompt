import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { HealthCheckResponse } from "@shared/types";
import artifactRoutes from "./routes/artifact.routes";
import aiRoutes from "./routes/ai.routes";
import ideasRoutes from "./routes/ideas.routes";
import requirementsRoutes from "./routes/requirements.routes";
import promptsRoutes from "./routes/prompts.routes";
import projectRoutes from "./routes/project.routes";
import adminRoutes from "./routes/admin.routes";
import billingRoutes from "./routes/billing.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    const response: HealthCheckResponse = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "backend",
      version: "1.0.0",
    };
    res.json(response);
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

  return httpServer;
}
