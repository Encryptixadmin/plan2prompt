import { Router } from "express";
import { consensusService, openaiService, anthropicService, geminiService } from "../services/ai";
import type { AIPrompt, ConsensusRequest, AIProviderType } from "@shared/types/ai";

const router = Router();

// Get available AI providers
router.get("/providers", async (_req, res) => {
  try {
    const available = await consensusService.getAvailableProviders();
    res.json({
      success: true,
      data: {
        providers: available,
        models: {
          openai: "gpt-4-turbo",
          anthropic: "claude-3-opus",
          gemini: "gemini-pro",
        },
      },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PROVIDERS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get providers",
      },
    });
  }
});

// Query a single provider
router.post("/query/:provider", async (req, res) => {
  try {
    const provider = req.params.provider as AIProviderType;
    const prompt: AIPrompt = req.body;

    if (!prompt.user) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required field: user (the prompt text)",
        },
      });
    }

    let response;
    switch (provider) {
      case "openai":
        response = await openaiService.generate(prompt);
        break;
      case "anthropic":
        response = await anthropicService.generate(prompt);
        break;
      case "gemini":
        response = await geminiService.generate(prompt);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PROVIDER",
            message: `Invalid provider: ${provider}. Valid options: openai, anthropic, gemini`,
          },
        });
    }

    res.json({
      success: true,
      data: response,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "QUERY_ERROR",
        message: error instanceof Error ? error.message : "Failed to query provider",
      },
    });
  }
});

// Get consensus from multiple providers
router.post("/consensus", async (req, res) => {
  try {
    const request: ConsensusRequest = req.body;

    if (!request.prompt?.user) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required field: prompt.user (the prompt text)",
        },
      });
    }

    const result = await consensusService.getConsensus(request);

    res.json({
      success: true,
      data: result,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "CONSENSUS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get consensus",
      },
    });
  }
});

export default router;
