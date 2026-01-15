import type { AIPrompt, AIProviderResponse, AIProviderType } from "@shared/types/ai";

/**
 * AI Provider Interface
 * 
 * All AI providers must implement this interface.
 * This allows easy swapping between mock and real implementations.
 */
export interface IAIProvider {
  readonly provider: AIProviderType;
  readonly model: string;
  
  /**
   * Generate a response from the AI provider
   */
  generate(prompt: AIPrompt): Promise<AIProviderResponse>;
  
  /**
   * Check if the provider is available/configured
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Base class with common functionality for AI providers
 */
export abstract class BaseAIProvider implements IAIProvider {
  abstract readonly provider: AIProviderType;
  abstract readonly model: string;
  
  abstract generate(prompt: AIPrompt): Promise<AIProviderResponse>;
  
  async isAvailable(): Promise<boolean> {
    // Override in real implementations to check API key availability
    return true;
  }
  
  protected createResponse(
    content: string,
    summary: string,
    confidence: number,
    reasoning?: string,
    latencyMs?: number
  ): AIProviderResponse {
    return {
      provider: this.provider,
      model: this.model,
      content,
      summary,
      confidence,
      reasoning,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }
}
