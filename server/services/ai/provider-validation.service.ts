import type { AIProviderType } from "@shared/types/ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ProviderValidationResult {
  provider: AIProviderType;
  modelId: string;
  resolvedModelId: string | null;
  validated: boolean;
  validationError: string | null;
  validatedAt: string;
  configured: boolean;
}

const ANTHROPIC_MODEL_PREFERENCE = [
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

const ANTHROPIC_OPUS_MODEL_PREFERENCE = [
  "claude-opus-4-6",
  "claude-opus-4-0-20250514",
  "claude-opus-latest",
  "claude-3-opus-latest",
  "claude-3-opus-20240229",
];

const GEMINI_MODEL_PREFERENCE = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

class ProviderValidationService {
  private validationResults: Map<AIProviderType, ProviderValidationResult> = new Map();
  private validationCompleted = false;

  async validateAllProvidersAtStartup(): Promise<void> {
    if (this.validationCompleted) {
      console.log("[ProviderValidation] Validation already completed, skipping");
      return;
    }

    console.log("[ProviderValidation] Starting model validation for all providers...");

    await Promise.allSettled([
      this.validateOpenAI(),
      this.validateAnthropic(),
      this.validateGemini(),
      this.validateAnthropicOpus(),
    ]);

    this.validationCompleted = true;

    const results = this.getValidationResults();
    const validCount = results.filter((r) => r.validated).length;
    const invalidCount = results.filter((r) => !r.validated).length;

    console.log(`[ProviderValidation] Validation complete: ${validCount} valid, ${invalidCount} invalid`);
    
    for (const result of results) {
      if (result.validated) {
        console.log(`[ProviderValidation] ${result.provider}: VALID (resolved: ${result.resolvedModelId})`);
      } else {
        console.warn(`[ProviderValidation] ${result.provider}: INVALID - ${result.validationError}`);
      }
    }
  }

  private async validateOpenAI(): Promise<void> {
    const defaultModelId = "gpt-4o-mini";
    const provider: AIProviderType = "openai";
    
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, defaultModelId, defaultModelId, true, "OPENAI_API_KEY not configured - mock mode available", false);
        return;
      }

      const client = new OpenAI({ apiKey });
      
      const models = await client.models.list();
      const modelList = Array.from(models.data);
      const modelExists = modelList.some((m) => m.id === defaultModelId);
      
      if (modelExists) {
        this.setValidationResult(provider, defaultModelId, defaultModelId, true, null, true);
      } else {
        const gpt4Models = modelList
          .filter((m) => m.id.includes("gpt-4"))
          .map((m) => m.id);
        
        if (gpt4Models.length > 0) {
          const fallback = gpt4Models[0];
          console.log(`[ProviderValidation] OpenAI: '${defaultModelId}' not found, using '${fallback}'`);
          this.setValidationResult(provider, defaultModelId, fallback, true, null, true);
        } else {
          this.setValidationResult(provider, defaultModelId, defaultModelId, false, `Model '${defaultModelId}' not found and no GPT-4 alternatives available`, true);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setValidationResult(provider, defaultModelId, defaultModelId, false, `Validation failed: ${message}`, true);
    }
  }

  private async validateAnthropic(): Promise<void> {
    const defaultModelId = "claude-3-5-sonnet-latest";
    const provider: AIProviderType = "anthropic";
    
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, defaultModelId, defaultModelId, true, "ANTHROPIC_API_KEY not configured - mock mode available", false);
        return;
      }

      const client = new Anthropic({ apiKey });
      
      let resolvedModel: string | null = null;
      let lastError: string | null = null;
      
      for (const modelId of ANTHROPIC_MODEL_PREFERENCE) {
        try {
          console.log(`[ProviderValidation] Anthropic: Testing model '${modelId}'...`);
          
          const response = await client.messages.create({
            model: modelId,
            max_tokens: 10,
            messages: [{ role: "user", content: "Respond with only: OK" }],
          });
          
          if (response.content && response.content.length > 0) {
            resolvedModel = modelId;
            console.log(`[ProviderValidation] Anthropic: Model '${modelId}' is accessible`);
            break;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(`[ProviderValidation] Anthropic: Model '${modelId}' not accessible: ${msg.slice(0, 100)}`);
          lastError = msg;
        }
      }
      
      if (resolvedModel) {
        this.setValidationResult(provider, defaultModelId, resolvedModel, true, null, true);
      } else {
        this.setValidationResult(
          provider, 
          defaultModelId, 
          null, 
          false, 
          `No accessible Claude 3+ models available for this API key. Last error: ${lastError || 'Unknown'}`,
          true
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setValidationResult(provider, defaultModelId, defaultModelId, false, `Validation failed: ${message}`, true);
    }
  }

  private async validateGemini(): Promise<void> {
    const defaultModelId = "gemini-2.5-flash";
    const provider: AIProviderType = "gemini";
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, defaultModelId, defaultModelId, true, "GEMINI_API_KEY not configured - mock mode available", false);
        return;
      }

      const client = new GoogleGenerativeAI(apiKey);
      
      let resolvedModel: string | null = null;
      let lastError: string | null = null;
      
      for (const modelId of GEMINI_MODEL_PREFERENCE) {
        try {
          console.log(`[ProviderValidation] Gemini: Testing model '${modelId}'...`);
          
          const model = client.getGenerativeModel({ model: modelId });
          const result = await model.generateContent("Respond with only: OK");
          const response = result.response;
          const text = response.text();
          
          if (text && text.length > 0) {
            resolvedModel = modelId;
            console.log(`[ProviderValidation] Gemini: Model '${modelId}' is accessible`);
            break;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(`[ProviderValidation] Gemini: Model '${modelId}' not accessible: ${msg.slice(0, 100)}`);
          lastError = msg;
        }
      }
      
      if (resolvedModel) {
        this.setValidationResult(provider, defaultModelId, resolvedModel, true, null, true);
      } else {
        this.setValidationResult(
          provider, 
          defaultModelId, 
          null, 
          false, 
          `No Gemini models available that support text generation for this API key. Last error: ${lastError || 'Unknown'}`,
          true
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setValidationResult(provider, defaultModelId, defaultModelId, false, `Validation failed: ${message}`, true);
    }
  }

  private async validateAnthropicOpus(): Promise<void> {
    const defaultModelId = "claude-opus-4-6";
    const provider: AIProviderType = "anthropic-opus";
    
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        this.setValidationResult(provider, defaultModelId, null, false, "ANTHROPIC_API_KEY not configured - Opus compiler unavailable", false);
        return;
      }

      const client = new Anthropic({ apiKey });
      
      let resolvedModel: string | null = null;
      let lastError: string | null = null;
      
      for (const modelId of ANTHROPIC_OPUS_MODEL_PREFERENCE) {
        try {
          console.log(`[ProviderValidation] Anthropic Opus: Testing model '${modelId}'...`);
          
          const response = await client.messages.create({
            model: modelId,
            max_tokens: 10,
            messages: [{ role: "user", content: "Respond with only: OK" }],
          });
          
          if (response.content && response.content.length > 0) {
            resolvedModel = modelId;
            console.log(`[ProviderValidation] Anthropic Opus: Model '${modelId}' is accessible`);
            break;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(`[ProviderValidation] Anthropic Opus: Model '${modelId}' not accessible: ${msg.slice(0, 100)}`);
          lastError = msg;
        }
      }
      
      if (resolvedModel) {
        this.setValidationResult(provider, defaultModelId, resolvedModel, true, null, true);
      } else {
        this.setValidationResult(
          provider, 
          defaultModelId, 
          null, 
          false, 
          `No accessible Anthropic Opus model available for this API key. Last error: ${lastError || 'Unknown'}`,
          true
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setValidationResult(provider, defaultModelId, null, false, `Validation failed: ${message}`, true);
    }
  }

  private setValidationResult(
    provider: AIProviderType,
    modelId: string,
    resolvedModelId: string | null,
    validated: boolean,
    validationError: string | null,
    configured: boolean
  ): void {
    this.validationResults.set(provider, {
      provider,
      modelId,
      resolvedModelId,
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

  getResolvedModelId(provider: AIProviderType): string | null {
    const result = this.validationResults.get(provider);
    return result?.validated ? result.resolvedModelId : null;
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
