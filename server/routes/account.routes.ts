import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { generateApiKey, hashApiKey } from "../mcp/auth";

const router = Router();

router.use(isAuthenticated);

function getUserId(req: Request): string | null {
  const localUserId = (req.session as any)?.localUserId;
  if (localUserId) return localUserId;
  const user = (req as any).user;
  if (user?.claims?.sub) return user.claims.sub;
  return null;
}

const createKeySchema = z.object({
  label: z.string().min(1).max(100),
});

router.post("/api-keys", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    }

    const validation = createKeySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Label is required (1-100 characters)" },
      });
    }

    const { rawKey, prefix } = generateApiKey();
    const keyHash = hashApiKey(rawKey);

    const record = await storage.createApiKey({
      userId,
      keyHash,
      keyPrefix: prefix,
      label: validation.data.label,
    });

    res.json({
      success: true,
      data: {
        id: record.id,
        key: rawKey,
        prefix: record.keyPrefix,
        label: record.label,
        createdAt: record.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create API key" },
    });
  }
});

router.get("/api-keys", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    }

    const keys = await storage.listApiKeysByUser(userId);

    res.json({
      success: true,
      data: keys.map(k => ({
        id: k.id,
        prefix: k.keyPrefix,
        label: k.label,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        revoked: !!k.revokedAt,
      })),
    });
  } catch (error) {
    console.error("Error listing API keys:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list API keys" },
    });
  }
});

router.delete("/api-keys/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    }

    const keys = await storage.listApiKeysByUser(userId);
    const targetKey = keys.find(k => k.id === req.params.id);

    if (!targetKey) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "API key not found" },
      });
    }

    if (targetKey.revokedAt) {
      return res.status(409).json({
        success: false,
        error: { code: "ALREADY_REVOKED", message: "API key is already revoked" },
      });
    }

    await storage.revokeApiKey(req.params.id);

    res.json({ success: true, data: { revoked: true } });
  } catch (error) {
    console.error("Error revoking API key:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to revoke API key" },
    });
  }
});

export default router;
