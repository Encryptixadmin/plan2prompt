import type { AIProviderType } from "@shared/types/ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ProviderValidationResult {
  provider: AIProviderType;
  modelId: string;
  validated: boolean;
  validationError: string | null;
  validatedAt: string;
  configured: boolean;
}

class ProviderValidationService {
  private validationResults: Map<AIProviderType, ProviderValidationResult> = new Map();
  private validationCompleted = false;

  async validateAllProvidersAtStartup(): Promise<void> {
    if (this.validationCompleted) {
      console.log("[ProviderValidation] Validation already completed, skipping");
      return;
    }

    console.log("[ProviderValidation] Starting model validation for all providers...");

    const validations = await Promise.allSettled([
      this.validateOpenAI(),
      this.validateAnthropic(),
      this.validateGemini(),
    ]);

    this.validationCompleted = true;

    const results = this.getValidationResults();
    const validCount = results.filter((r) => r.validated).length;
    const invalidCount = results.filter((r) => !r.validated).length;

    console.log(`[ProviderValidation] Validation complete: ${validCount} valid, ${invalidCount} invalid`);
    
    for (const result of results) {
      if (result.validated) {
        console.log(`[ProviderValidation] ${result.provider}: VALID (${result.modelId})`);
      } else {
        console.warn(`[ProviderValidation] ${result.provider}: INVALID - ${result.validationError}`);
      }
    }
  }

  private async validateOpenAI(): Promise<void> {
    const modelId = "gpt-4o-mini";
    const provider: AIProviderType = "openai";
    
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, modelId, true, "OPENAI_API_KEY not configured - mock mode available", false);
        return;
      }

      const client = new OpenAI({ apiKey });
      
      const models = await client.models.list();
      const modelExists = Array.from(models.data).some((m) => m.id === modelId);
      
      if (modelExists) {
        this.setValidationResult(provider, modelId, true, null, true);
      } else {
        this.setValidationResult(provider, modelId, false, `Model '${modelId}' not found in available models`, true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setValidationResult(provider, modelId, false, `Validation failed: ${message}`, true);
    }
  }

  private async validateAnthropic(): Promise<void> {
    const modelId = "claude-3-5-sonnet-latest";
    const provider: AIProviderType = "anthropic";
    
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, modelId, true, "ANTHROPIC_API_KEY not configured - mock mode available", false);
        return;
      }

      const client = new Anthropic({ apiKey });
      
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 10,
        messages: [{ role: "user", content: "Respond with only the word 'validated'" }],
      });
      
      if (response.content && response.content.length > 0) {
        this.setValidationResult(provider, modelId, true, null, true);
      } else {
        this.setValidationResult(provider, modelId, false, `Model '${modelId}' returned empty response`, true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("model") || message.includes("404") || message.includes("not found")) {
        this.setValidationResult(provider, modelId, false, `Model '${modelId}' not found or not accessible`, true);
      } else {
        this.setValidationResult(provider, modelId, false, `Validation failed: ${message}`, true);
      }
    }
  }

  private async validateGemini(): Promise<void> {
    const modelId = "gemini-1.5-pro";
    const provider: AIProviderType = "gemini";
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, modelId, true, "GEMINI_API_KEY not configured - mock mode available", false);
        return;
      }

      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: modelId });
      
      const result = await model.generateContent("Respond with only the word 'validated'");
      const response = result.response;
      const text = response.text();
      
      if (text && text.length > 0) {
        this.setValidationResult(provider, modelId, true, null, true);
      } else {
        this.setValidationResult(provider, modelId, false, `Model '${modelId}' returned empty response`, true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("model") || message.includes("404") || message.includes("not found")) {
        this.setValidationResult(provider, modelId, false, `Model '${modelId}' not found or not accessible`, true);
      } else {
        this.setValidationResult(provider, modelId, false, `Validation failed: ${message}`, true);
      }
    }
  }

  private setValidationResult(
    provider: AIProviderType,
    modelId: string,
    validated: boolean,
    validationError: string | null,
    configured: boolean
  ): void {
    this.validationResults.set(provider, {
      provider,
      modelId,
      validated,
      validationError,
      validatedAt: new Date().toISOString(),
      configured,
    });
  }

  getValidationResults(): ProviderValidationResult[] {
    return Array.from(this.validationResults.values());
  }

  getValidationResult(provider: AIProviderType): ProviderValidationResult | null {
    return this.validationResults.get(provider) || null;
  }

  isProviderValidated(provider: AIProviderType): boolean {
    const result = this.validationResults.get(provider);
    return result?.validated ?? false;
  }

  getValidatedProviders(): AIProviderType[] {
    return this.getValidationResults()
      .filter((r) => r.validated)
      .map((r) => r.provider);
  }

  isValidationCompleted(): boolean {
    return this.validationCompleted;
  }
}

export const providerValidationService = new ProviderValidationService();
