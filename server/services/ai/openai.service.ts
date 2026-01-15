import type { AIPrompt, AIProviderResponse } from "@shared/types/ai";
import { BaseAIProvider } from "./provider.interface";

/**
 * OpenAI Service (Mock Implementation)
 * 
 * Provides mock responses simulating OpenAI GPT-4 behavior.
 * Will be replaced with real API calls when API keys are configured.
 */
export class OpenAIService extends BaseAIProvider {
  readonly provider = "openai" as const;
  readonly model = "gpt-4-turbo";
  
  async generate(prompt: AIPrompt): Promise<AIProviderResponse> {
    const startTime = Date.now();
    
    // Simulate API latency
    await this.simulateLatency(150, 300);
    
    const content = this.generateMockResponse(prompt);
    const summary = this.generateSummary(prompt);
    const confidence = this.calculateMockConfidence(prompt);
    
    return this.createResponse(
      content,
      summary,
      confidence,
      "Based on extensive training data and pattern recognition.",
      Date.now() - startTime
    );
  }
  
  async isAvailable(): Promise<boolean> {
    // In real implementation: check if OPENAI_API_KEY is set
    // For now, always return true (mock mode)
    return true;
  }
  
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  private generateMockResponse(prompt: AIPrompt): string {
    const userQuery = prompt.user.toLowerCase();
    
    // Generate contextually relevant mock responses
    if (userQuery.includes("analyze") || userQuery.includes("analysis")) {
      return `[OpenAI Analysis]\n\nBased on the provided information, here is a comprehensive analysis:\n\n1. **Key Findings**: The data suggests several important patterns that warrant attention.\n\n2. **Observations**: Multiple factors contribute to the current state, including contextual elements and historical trends.\n\n3. **Recommendations**: Consider implementing structured approaches to address the identified areas.\n\nThis analysis considers multiple perspectives and aims to provide actionable insights.`;
    }
    
    if (userQuery.includes("summarize") || userQuery.includes("summary")) {
      return `[OpenAI Summary]\n\nThe core points can be distilled as follows:\n\n- Primary theme: Systematic evaluation of the subject matter\n- Key considerations: Context, implications, and potential outcomes\n- Conclusion: A balanced approach is recommended\n\nThis summary captures the essential elements while maintaining objectivity.`;
    }
    
    return `[OpenAI Response]\n\nRegarding your query: "${prompt.user.substring(0, 50)}..."\n\nThis is a mock response from the OpenAI GPT-4 service. In production, this would contain a genuine AI-generated response based on the prompt provided.\n\nKey points:\n- Structured reasoning applied\n- Multiple angles considered\n- Evidence-based conclusions drawn`;
  }
  
  private generateSummary(prompt: AIPrompt): string {
    return `OpenAI processed the query and generated a structured response addressing the key aspects of: ${prompt.user.substring(0, 100)}`;
  }
  
  private calculateMockConfidence(prompt: AIPrompt): number {
    // Simulate varying confidence based on prompt characteristics
    const baseConfidence = 0.85;
    const hasContext = prompt.context ? 0.05 : 0;
    const hasSystem = prompt.system ? 0.03 : 0;
    const randomVariation = (Math.random() - 0.5) * 0.1;
    
    return Math.min(0.98, Math.max(0.7, baseConfidence + hasContext + hasSystem + randomVariation));
  }
}

export const openaiService = new OpenAIService();
