import { createHash } from "crypto";
import { storage } from "../storage";
import type { Request, Response, NextFunction } from "express";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const rawKey = `p2p_${hex}`;
  const prefix = rawKey.substring(0, 8);
  return { rawKey, prefix };
}

export interface McpAuthInfo {
  userId: string;
  apiKeyId: string;
}

export async function authenticateApiKey(authHeader: string | undefined): Promise<McpAuthInfo | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const record = await storage.getApiKeyByHash(keyHash);

  if (!record) return null;
  if (record.revokedAt) return null;

  storage.updateApiKeyLastUsed(record.id).catch(() => {});

  return {
    userId: record.userId,
    apiKeyId: record.id,
  };
}

export function requireApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  authenticateApiKey(authHeader).then(auth => {
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Valid API key required. Use Authorization: Bearer <key>" },
      });
    }

    (req as any).mcpAuth = auth;

    const projectId = req.headers["x-project-id"] as string;
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_PROJECT", message: "X-Project-Id header required" },
      });
    }

    storage.getProjectMember(projectId, auth.userId).then(member => {
      if (!member) {
        return res.status(403).json({
          success: false,
          error: { code: "ACCESS_DENIED", message: "You do not have access to this project" },
        });
      }

      (req as any).mcpProjectId = projectId;
      next();
    }).catch(() => {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to verify project access" },
      });
    });
  }).catch(() => {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  });
}
