import type { AIPrompt, AIProviderResponse } from "@shared/types/ai";
import { BaseAIProvider } from "./provider.interface";

/**
 * Anthropic Service (Mock Implementation)
 * 
 * Provides mock responses simulating Claude behavior.
 * Will be replaced with real API calls when API keys are configured.
 */
export class AnthropicService extends BaseAIProvider {
  readonly provider = "anthropic" as const;
  readonly model = "claude-3-opus";
  
  async generate(prompt: AIPrompt): Promise<AIProviderResponse> {
    const startTime = Date.now();
    
    // Simulate API latency
    await this.simulateLatency(180, 350);
    
    const content = this.generateMockResponse(prompt);
    const summary = this.generateSummary(prompt);
    const confidence = this.calculateMockConfidence(prompt);
    
    return this.createResponse(
      content,
      summary,
      confidence,
      "Reasoning based on constitutional AI principles and careful consideration of nuances.",
      Date.now() - startTime
    );
  }
  
  async isAvailable(): Promise<boolean> {
    // In real implementation: check if ANTHROPIC_API_KEY is set
    return true;
  }
  
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  private generateMockResponse(prompt: AIPrompt): string {
    const userQuery = prompt.user.toLowerCase();
    
    if (userQuery.includes("analyze") || userQuery.includes("analysis")) {
      return `[Anthropic Analysis]\n\nI've carefully examined the information provided. Here's my analysis:\n\n**Contextual Understanding**\nThe situation presents several dimensions worth exploring. Each aspect interconnects with others in meaningful ways.\n\n**Critical Considerations**\n- The primary factors require balanced evaluation\n- Secondary elements provide supporting context\n- Potential implications extend across multiple domains\n\n**Thoughtful Conclusions**\nA nuanced approach that considers various stakeholder perspectives would be most beneficial. I'd recommend taking time to evaluate each option against stated objectives.`;
    }
    
    if (userQuery.includes("summarize") || userQuery.includes("summary")) {
      return `[Anthropic Summary]\n\nLet me provide a thoughtful summary:\n\n**Essence**: The core matter revolves around careful consideration of multiple factors.\n\n**Key Elements**:\n1. Primary considerations have been identified\n2. Context shapes the interpretation significantly\n3. Nuanced understanding is essential\n\n**Takeaway**: A balanced, well-reasoned approach will yield the best outcomes.`;
    }
    
    return `[Anthropic Response]\n\nThank you for your query. I've thought carefully about this:\n\n"${prompt.user.substring(0, 50)}..."\n\nThis is a mock response from Claude. In the actual implementation, I would provide a thoughtful, nuanced response that:\n\n1. Considers multiple perspectives\n2. Acknowledges complexity and uncertainty where appropriate\n3. Aims to be genuinely helpful while being honest about limitations\n\nI strive to be helpful, harmless, and honest in my responses.`;
  }
  
  private generateSummary(prompt: AIPrompt): string {
    return `Anthropic provided a nuanced analysis with careful consideration of: ${prompt.user.substring(0, 100)}`;
  }
  
  private calculateMockConfidence(prompt: AIPrompt): number {
    // Claude tends to be more conservative in confidence
    const baseConfidence = 0.82;
    const hasContext = prompt.context ? 0.06 : 0;
    const hasSystem = prompt.system ? 0.04 : 0;
    const randomVariation = (Math.random() - 0.5) * 0.12;
    
    return Math.min(0.95, Math.max(0.68, baseConfidence + hasContext + hasSystem + randomVariation));
  }
}

export const anthropicService = new AnthropicService();
