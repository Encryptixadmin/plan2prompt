import Anthropic from "@anthropic-ai/sdk";
import type { AIPrompt, AIProviderResponse, AITokenUsage } from "@shared/types/ai";
import { BaseAIProvider, type ProviderConfig } from "./provider.interface";

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

export class AnthropicService extends BaseAIProvider {
  readonly provider = "anthropic" as const;
  readonly model = ANTHROPIC_MODEL;
  private client: Anthropic | null = null;

  constructor(config: Partial<ProviderConfig> = {}) {
    super(config);
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
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

    try {
      const response = await this.withRetry(() =>
        this.withTimeout(
          this.client!.messages.create({
            model: this.model,
            max_tokens: prompt.maxTokens ?? this.config.maxTokens,
            system: prompt.system,
            messages: this.buildMessages(prompt),
          })
        )
      );

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      const tokenUsage: AITokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      };

      const summary = this.extractSummary(content);
      const confidence = this.calculateConfidence(content, tokenUsage);

      return this.createResponse(
        content,
        summary,
        confidence,
        "Reasoning based on constitutional AI principles.",
        Date.now() - startTime,
        tokenUsage,
        false
      );
    } catch (error) {
      console.error(`[Anthropic] API error: ${error instanceof Error ? error.message : error}`);
      return this.generateMockResponse(prompt, startTime);
    }
  }

  private buildMessages(prompt: AIPrompt): Anthropic.MessageParam[] {
    let userContent = prompt.user;
    if (prompt.context) {
      userContent = `Context:\n${prompt.context}\n\n${prompt.user}`;
    }

    return [{ role: "user", content: userContent }];
  }

  private extractSummary(content: string): string {
    const firstParagraph = content.split("\n\n")[0] || content;
    return firstParagraph.slice(0, 200) + (firstParagraph.length > 200 ? "..." : "");
  }

  private calculateConfidence(content: string, usage: AITokenUsage): number {
    const baseConfidence = 0.82;
    const lengthBonus = Math.min(0.12, content.length / 6000);
    return Math.min(0.95, baseConfidence + lengthBonus);
  }

  private async generateMockResponse(prompt: AIPrompt, startTime: number): Promise<AIProviderResponse> {
    await this.delay(180 + Math.random() * 170);

    const inputTokens = this.estimateInputTokens(prompt.user + (prompt.context || "") + (prompt.system || ""));
    const mockContent = this.createMockContent(prompt);
    const outputTokens = this.estimateInputTokens(mockContent);

    return this.createResponse(
      mockContent,
      `Anthropic analyzed: ${prompt.user.slice(0, 100)}`,
      0.82 + Math.random() * 0.1,
      "Mock response - no API key configured.",
      Date.now() - startTime,
      { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      true
    );
  }

  private createMockContent(prompt: AIPrompt): string {
    const query = prompt.user.toLowerCase();

    if (query.includes("analyze") || query.includes("analysis")) {
      return `[Anthropic Analysis]\n\nI've carefully examined the information provided. Here's my analysis:\n\n**Contextual Understanding**\nThe situation presents several dimensions worth exploring.\n\n**Critical Considerations**\n- The primary factors require balanced evaluation\n- Secondary elements provide supporting context\n\n**Thoughtful Conclusions**\nA nuanced approach that considers various perspectives would be most beneficial.`;
    }

    return `[Anthropic Response]\n\nThank you for your query. I've thought carefully about this.\n\nThis is a mock response from Claude. In the actual implementation, I would provide a thoughtful, nuanced response that:\n\n1. Considers multiple perspectives\n2. Acknowledges complexity where appropriate\n3. Aims to be genuinely helpful`;
  }
}

export const anthropicService = new AnthropicService();
