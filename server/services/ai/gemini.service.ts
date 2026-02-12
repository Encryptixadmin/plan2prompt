import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIPrompt, AIProviderResponse, AITokenUsage } from "@shared/types/ai";
import { BaseAIProvider, type ProviderConfig } from "./provider.interface";
import { providerValidationService } from "./provider-validation.service";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export class GeminiService extends BaseAIProvider {
  readonly provider = "gemini" as const;
  private client: GoogleGenerativeAI | null = null;

  constructor(config: Partial<ProviderConfig> = {}) {
    super(config);
    this.initializeClient();
  }

  get model(): string {
    return providerValidationService.getResolvedModelId("gemini") || DEFAULT_GEMINI_MODEL;
  }

  private initializeClient(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async generate(prompt: AIPrompt): Promise<AIProviderResponse> {
    const startTime = Date.now();

    if (!this.client) {
      return this.generateMockResponse(prompt, startTime);
    }

    const resolvedModel = this.model;

    try {
      const model = this.client.getGenerativeModel({
        model: resolvedModel,
        generationConfig: {
          temperature: prompt.temperature ?? this.config.temperature,
          maxOutputTokens: prompt.maxTokens ?? this.config.maxTokens,
        },
      });

      const fullPrompt = this.buildPrompt(prompt);
      const result = await this.withRetry(() =>
        this.withTimeout(model.generateContent(fullPrompt))
      );

      const response = result.response;
      const content = response.text();

      const usageMetadata = response.usageMetadata;
      const tokenUsage: AITokenUsage = {
        inputTokens: usageMetadata?.promptTokenCount || this.estimateInputTokens(fullPrompt),
        outputTokens: usageMetadata?.candidatesTokenCount || this.estimateInputTokens(content),
        totalTokens: usageMetadata?.totalTokenCount || 0,
      };

      if (!tokenUsage.totalTokens) {
        tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
      }

      const summary = this.extractSummary(content);
      const confidence = this.calculateConfidence(content, tokenUsage);

      return this.createResponse(
        content,
        summary,
        confidence,
        "Multimodal reasoning with broad knowledge base.",
        Date.now() - startTime,
        tokenUsage,
        false
      );
    } catch (error) {
      console.error(`[Gemini] API error: ${error instanceof Error ? error.message : error}`);
      return this.generateMockResponse(prompt, startTime);
    }
  }

  private buildPrompt(prompt: AIPrompt): string {
    const parts: string[] = [];

    if (prompt.system) {
      parts.push(`Instructions: ${prompt.system}\n`);
    }

    if (prompt.context) {
      parts.push(`Context:\n${prompt.context}\n`);
    }

    parts.push(prompt.user);
    return parts.join("\n");
  }

  private extractSummary(content: string): string {
    const firstParagraph = content.split("\n\n")[0] || content;
    return firstParagraph.slice(0, 200) + (firstParagraph.length > 200 ? "..." : "");
  }

  private calculateConfidence(content: string, usage: AITokenUsage): number {
    const baseConfidence = 0.83;
    const lengthBonus = Math.min(0.12, content.length / 5500);
    return Math.min(0.96, baseConfidence + lengthBonus);
  }

  private async generateMockResponse(prompt: AIPrompt, startTime: number): Promise<AIProviderResponse> {
    await this.delay(100 + Math.random() * 150);

    const inputTokens = this.estimateInputTokens(prompt.user + (prompt.context || "") + (prompt.system || ""));
    const mockContent = this.createMockContent(prompt);
    const outputTokens = this.estimateInputTokens(mockContent);

    return this.createResponse(
      mockContent,
      `Gemini analyzed: ${prompt.user.slice(0, 100)}`,
      0.83 + Math.random() * 0.1,
      "Mock response - no API key configured.",
      Date.now() - startTime,
      { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      true
    );
  }

  private createMockContent(prompt: AIPrompt): string {
    const query = prompt.user.toLowerCase();

    if (query.includes("analyze") || query.includes("analysis")) {
      return `[Gemini Analysis]\n\nHere's a comprehensive analysis based on the available information:\n\n## Overview\nThe subject matter presents interesting patterns.\n\n## Key Insights\n* **Pattern Recognition**: Clear trends emerge\n* **Correlation Analysis**: Multiple factors show interconnection\n\n## Data-Driven Conclusions\nBased on systematic evaluation, the evidence points toward structured approaches.`;
    }

    return `[Gemini Response]\n\nAnalyzing your request.\n\nThis is a mock response from Google Gemini. In production, this would contain:\n\n## Response Components\n* Direct answer to the query\n* Supporting information and context\n* Clear, actionable conclusions`;
  }
}

export const geminiService = new GeminiService();
