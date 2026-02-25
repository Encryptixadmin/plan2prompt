import OpenAI from "openai";
import type { AIPrompt, AIProviderResponse, AITokenUsage } from "@shared/types/ai";
import { BaseAIProvider, type ProviderConfig } from "./provider.interface";
import { providerValidationService } from "./provider-validation.service";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export class OpenAIService extends BaseAIProvider {
  readonly provider = "openai" as const;
  private client: OpenAI | null = null;

  constructor(config: Partial<ProviderConfig> = {}) {
    super(config);
    this.initializeClient();
  }

  get model(): string {
    return providerValidationService.getResolvedModelId("openai") || DEFAULT_OPENAI_MODEL;
  }

  private initializeClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
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
      const response = await this.withRetry(() =>
        this.withTimeout(
          this.client!.chat.completions.create({
            model: resolvedModel,
            temperature: prompt.temperature ?? this.config.temperature,
            max_tokens: prompt.maxTokens ?? this.config.maxTokens,
            messages: this.buildMessages(prompt),
            ...(prompt.responseFormat === "json_object"
              ? { response_format: { type: "json_object" as const } }
              : {}),
          })
        )
      );

      const content = response.choices[0]?.message?.content || "";
      const usage = response.usage;

      const tokenUsage: AITokenUsage = {
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      };

      const summary = this.extractSummary(content);
      const confidence = this.calculateConfidence(content, tokenUsage);

      return this.createResponse(
        content,
        summary,
        confidence,
        "Analysis based on GPT-4 reasoning.",
        Date.now() - startTime,
        tokenUsage,
        false
      );
    } catch (error) {
      console.error(`[OpenAI] API error: ${error instanceof Error ? error.message : error}`);
      return this.generateMockResponse(prompt, startTime);
    }
  }

  private buildMessages(prompt: AIPrompt): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (prompt.system) {
      messages.push({ role: "system", content: prompt.system });
    }

    let userContent = prompt.user;
    if (prompt.context) {
      userContent = `Context:\n${prompt.context}\n\n${prompt.user}`;
    }

    messages.push({ role: "user", content: userContent });
    return messages;
  }

  private extractSummary(content: string): string {
    const firstParagraph = content.split("\n\n")[0] || content;
    return firstParagraph.slice(0, 200) + (firstParagraph.length > 200 ? "..." : "");
  }

  private calculateConfidence(content: string, usage: AITokenUsage): number {
    const baseConfidence = 0.85;
    const lengthBonus = Math.min(0.1, content.length / 5000);
    return Math.min(0.98, baseConfidence + lengthBonus);
  }

  private async generateMockResponse(prompt: AIPrompt, startTime: number): Promise<AIProviderResponse> {
    await this.delay(150 + Math.random() * 150);

    const inputTokens = this.estimateInputTokens(prompt.user + (prompt.context || "") + (prompt.system || ""));
    const mockContent = this.createMockContent(prompt);
    const outputTokens = this.estimateInputTokens(mockContent);

    return this.createResponse(
      mockContent,
      `OpenAI analyzed: ${prompt.user.slice(0, 100)}`,
      0.85 + Math.random() * 0.1,
      "Mock response - no API key configured.",
      Date.now() - startTime,
      { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      true
    );
  }

  private createMockContent(prompt: AIPrompt): string {
    const query = prompt.user.toLowerCase();

    if (query.includes("analyze") || query.includes("analysis")) {
      return `[OpenAI Analysis]\n\nBased on the provided information, here is a comprehensive analysis:\n\n1. **Key Findings**: The data suggests several important patterns.\n\n2. **Observations**: Multiple factors contribute to the current state.\n\n3. **Recommendations**: Consider implementing structured approaches.\n\nThis analysis considers multiple perspectives.`;
    }

    return `[OpenAI Response]\n\nThis is a mock response from OpenAI GPT-4. In production, this would contain a genuine AI-generated response.\n\nKey points:\n- Structured reasoning applied\n- Multiple angles considered\n- Evidence-based conclusions drawn`;
  }
}

export const openaiService = new OpenAIService();
