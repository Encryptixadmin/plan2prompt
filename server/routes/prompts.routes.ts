import { Router, Request, Response } from "express";
import { z } from "zod";
import { promptsService } from "../services/prompts.service";
import { artifactService } from "../services/artifact.service";

const router = Router();

// Validation schema for prompt generation
const generatePromptsSchema = z.object({
  requirementsArtifactId: z.string().uuid("Invalid requirements artifact ID"),
  ide: z.enum(["replit", "cursor", "lovable", "antigravity", "warp", "other"]),
});

/**
 * GET /api/prompts/requirements
 * List all requirements artifacts for prompt generation
 */
router.get("/requirements", async (req: Request, res: Response) => {
  try {
    const artifacts = await artifactService.list("requirements");
    res.json({
      success: true,
      data: artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        version: a.version,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error listing requirements:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list requirements",
    });
  }
});

/**
 * POST /api/prompts/generate
 * Generate IDE-specific build prompts from requirements
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const validation = generatePromptsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validation.error.flatten(),
      });
    }

    const { requirementsArtifactId, ide } = validation.data;

    const prompts = await promptsService.generatePrompts(
      requirementsArtifactId,
      ide
    );

    res.json({
      success: true,
      data: prompts,
    });
  } catch (error) {
    console.error("Error generating prompts:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate prompts",
    });
  }
});

/**
 * GET /api/prompts/artifacts
 * List all prompt artifacts
 */
router.get("/artifacts", async (req: Request, res: Response) => {
  try {
    const artifacts = await artifactService.list("prompts");
    res.json({
      success: true,
      data: artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        version: a.version,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error listing prompt artifacts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list prompt artifacts",
    });
  }
});

export default router;
