import type { AIPrompt, AIProviderResponse, AIProviderType, AITokenUsage } from "@shared/types/ai";

export interface ProviderConfig {
  maxRetries: number;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  maxRetries: 1,
  timeoutMs: 90000,
  temperature: 0.3,
  maxTokens: 4096,
};

export interface IAIProvider {
  readonly provider: AIProviderType;
  readonly model: string;
  
  generate(prompt: AIPrompt): Promise<AIProviderResponse>;
  isAvailable(): Promise<boolean>;
}

export abstract class BaseAIProvider implements IAIProvider {
  abstract readonly provider: AIProviderType;
  abstract readonly model: string;
  protected config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = { ...DEFAULT_PROVIDER_CONFIG, ...config };
  }
  
  abstract generate(prompt: AIPrompt): Promise<AIProviderResponse>;
  
  async isAvailable(): Promise<boolean> {
    return true;
  }
  
  protected createResponse(
    content: string,
    summary: string,
    confidence: number,
    reasoning?: string,
    latencyMs?: number,
    tokenUsage?: AITokenUsage,
    isMock?: boolean
  ): AIProviderResponse {
    return {
      provider: this.provider,
      model: this.model,
      content,
      summary,
      confidence,
      reasoning,
      latencyMs,
      tokenUsage,
      tokensUsed: tokenUsage?.totalTokens,
      timestamp: new Date().toISOString(),
      isMock,
    };
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;
    const baseDelayMs = 500;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          console.warn(`[${this.provider}] Retry ${attempt + 1}/${retries} after error: ${lastError.message} (waiting ${delayMs}ms)`);
          await this.delay(delayMs);
        }
      }
    }
    throw lastError;
  }

  protected async withTimeout<T>(promise: Promise<T>, ms: number = this.config.timeoutMs): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
      ),
    ]);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected estimateInputTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
