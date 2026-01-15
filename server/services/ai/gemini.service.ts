import type { AIPrompt, AIProviderResponse } from "@shared/types/ai";
import { BaseAIProvider } from "./provider.interface";

/**
 * Gemini Service (Mock Implementation)
 * 
 * Provides mock responses simulating Google Gemini behavior.
 * Will be replaced with real API calls when API keys are configured.
 */
export class GeminiService extends BaseAIProvider {
  readonly provider = "gemini" as const;
  readonly model = "gemini-pro";
  
  async generate(prompt: AIPrompt): Promise<AIProviderResponse> {
    const startTime = Date.now();
    
    // Simulate API latency (Gemini tends to be fast)
    await this.simulateLatency(100, 250);
    
    const content = this.generateMockResponse(prompt);
    const summary = this.generateSummary(prompt);
    const confidence = this.calculateMockConfidence(prompt);
    
    return this.createResponse(
      content,
      summary,
      confidence,
      "Multimodal reasoning with access to broad knowledge base.",
      Date.now() - startTime
    );
  }
  
  async isAvailable(): Promise<boolean> {
    // In real implementation: check if GEMINI_API_KEY is set
    return true;
  }
  
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  private generateMockResponse(prompt: AIPrompt): string {
    const userQuery = prompt.user.toLowerCase();
    
    if (userQuery.includes("analyze") || userQuery.includes("analysis")) {
      return `[Gemini Analysis]\n\nHere's a comprehensive analysis based on the available information:\n\n## Overview\nThe subject matter presents interesting patterns worthy of examination.\n\n## Key Insights\n* **Pattern Recognition**: Clear trends emerge from the data\n* **Correlation Analysis**: Multiple factors show interconnection\n* **Predictive Elements**: Future trajectories can be reasonably estimated\n\n## Data-Driven Conclusions\nBased on systematic evaluation, the evidence points toward structured approaches that leverage identified patterns for optimal outcomes.`;
    }
    
    if (userQuery.includes("summarize") || userQuery.includes("summary")) {
      return `[Gemini Summary]\n\n## Quick Overview\nThe essential information can be condensed to these key points:\n\n1. **Core Theme**: Systematic evaluation yields clear insights\n2. **Supporting Data**: Multiple sources confirm primary findings\n3. **Action Items**: Specific steps can be derived from analysis\n\n## Bottom Line\nA data-informed approach supports the conclusions presented.`;
    }
    
    return `[Gemini Response]\n\nAnalyzing your request: "${prompt.user.substring(0, 50)}..."\n\nThis is a mock response from Google Gemini. In the production environment, this would contain:\n\n## Response Components\n* Direct answer to the query\n* Supporting information and context\n* Relevant examples where applicable\n* Clear, actionable conclusions\n\nGemini excels at integrating information from diverse sources to provide comprehensive responses.`;
  }
  
  private generateSummary(prompt: AIPrompt): string {
    return `Gemini analyzed the request with multimodal reasoning: ${prompt.user.substring(0, 100)}`;
  }
  
  private calculateMockConfidence(prompt: AIPrompt): number {
    // Gemini confidence varies with context availability
    const baseConfidence = 0.83;
    const hasContext = prompt.context ? 0.08 : 0;
    const hasSystem = prompt.system ? 0.02 : 0;
    const randomVariation = (Math.random() - 0.5) * 0.14;
    
    return Math.min(0.96, Math.max(0.65, baseConfidence + hasContext + hasSystem + randomVariation));
  }
}

export const geminiService = new GeminiService();
