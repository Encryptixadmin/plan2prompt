import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { HealthCheckResponse } from "@shared/types";
import artifactRoutes from "./routes/artifact.routes";
import aiRoutes from "./routes/ai.routes";

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

  return httpServer;
}
