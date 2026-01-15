import type {
  AIPrompt,
  AIProviderType,
  AIProviderResponse,
  AIConsensusResult,
  AIDisagreement,
  AIRisk,
  ConsensusRequest,
} from "@shared/types/ai";
import { type IAIProvider } from "./provider.interface";
import { openaiService } from "./openai.service";
import { anthropicService } from "./anthropic.service";
import { geminiService } from "./gemini.service";

/**
 * Consensus Service
 * 
 * Orchestrates multiple AI providers and produces unified consensus output.
 * Compares responses, identifies agreements/conflicts, and calculates confidence.
 */
export class ConsensusService {
  private providers: Map<AIProviderType, IAIProvider>;
  
  constructor() {
    this.providers = new Map([
      ["openai", openaiService],
      ["anthropic", anthropicService],
      ["gemini", geminiService],
    ]);
  }
  
  /**
   * Query all providers and produce consensus
   */
  async getConsensus(request: ConsensusRequest): Promise<AIConsensusResult> {
    const startTime = Date.now();
    const providersToQuery = request.providers || (["openai", "anthropic", "gemini"] as AIProviderType[]);
    
    // Query all providers in parallel
    const responses = await this.queryProviders(request.prompt, providersToQuery);
    
    // Analyze responses for agreement and disagreement
    const { agreementScore, disagreements } = this.analyzeAgreement(responses);
    
    // Identify risks mentioned by providers
    const risks = this.identifyRisks(responses);
    
    // Determine if consensus was reached
    const minimumConfidence = request.minimumConfidence || 0.7;
    const averageConfidence = this.calculateAverageConfidence(responses);
    const consensusReached = request.requireUnanimity
      ? agreementScore >= 0.9 && averageConfidence >= minimumConfidence
      : agreementScore >= 0.6 && averageConfidence >= minimumConfidence;
    
    // Generate unified content
    const unifiedContent = this.synthesizeContent(responses, disagreements);
    const summary = this.generateConsensusSummary(responses, agreementScore);
    
    return {
      consensusReached,
      agreementScore,
      summary,
      unifiedContent,
      confidence: averageConfidence,
      risks,
      disagreements,
      providerResponses: responses,
      metadata: {
        providersQueried: providersToQuery,
        totalLatencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Query specific providers
   */
  private async queryProviders(
    prompt: AIPrompt,
    providers: AIProviderType[]
  ): Promise<AIProviderResponse[]> {
    const promises = providers.map(async (providerType) => {
      const provider = this.providers.get(providerType);
      if (!provider) {
        throw new Error(`Provider ${providerType} not found`);
      }
      
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        throw new Error(`Provider ${providerType} is not available`);
      }
      
      return provider.generate(prompt);
    });
    
    return Promise.all(promises);
  }
  
  /**
   * Analyze agreement between provider responses
   */
  private analyzeAgreement(responses: AIProviderResponse[]): {
    agreementScore: number;
    disagreements: AIDisagreement[];
  } {
    const disagreements: AIDisagreement[] = [];
    
    // Mock analysis - in real implementation, use NLP/semantic similarity
    const confidences = responses.map((r) => r.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const confidenceVariance = this.calculateVariance(confidences);
    
    // High variance in confidence suggests disagreement
    if (confidenceVariance > 0.02) {
      const lowConfProvider = responses.reduce((min, r) => 
        r.confidence < min.confidence ? r : min
      );
      const highConfProvider = responses.reduce((max, r) => 
        r.confidence > max.confidence ? r : max
      );
      
      if (highConfProvider.confidence - lowConfProvider.confidence > 0.15) {
        disagreements.push({
          topic: "Confidence in response accuracy",
          providers: [
            { provider: lowConfProvider.provider, position: "Lower certainty in conclusions" },
            { provider: highConfProvider.provider, position: "Higher certainty in conclusions" },
          ],
          severity: confidenceVariance > 0.04 ? "medium" : "low",
        });
      }
    }
    
    // Simulate occasional topical disagreements
    if (Math.random() > 0.7 && responses.length >= 2) {
      disagreements.push({
        topic: "Approach to problem framing",
        providers: [
          { provider: responses[0].provider, position: "Emphasizes systematic methodology" },
          { provider: responses[1].provider, position: "Emphasizes contextual nuance" },
        ],
        severity: "low",
      });
    }
    
    // Calculate agreement score (inverse of disagreement impact)
    const disagreementPenalty = disagreements.reduce((penalty, d) => {
      const severityWeight = { low: 0.05, medium: 0.15, high: 0.3 };
      return penalty + severityWeight[d.severity];
    }, 0);
    
    const agreementScore = Math.max(0.5, Math.min(1, avgConfidence - disagreementPenalty));
    
    return { agreementScore, disagreements };
  }
  
  /**
   * Identify risks from provider responses
   */
  private identifyRisks(responses: AIProviderResponse[]): AIRisk[] {
    const risks: AIRisk[] = [];
    
    // Check for low confidence across providers
    const lowConfidenceProviders = responses.filter((r) => r.confidence < 0.75);
    if (lowConfidenceProviders.length > 0) {
      risks.push({
        description: "Some providers reported lower confidence in their responses",
        identifiedBy: lowConfidenceProviders.map((r) => r.provider),
        severity: lowConfidenceProviders.length >= 2 ? "medium" : "low",
        mitigation: "Consider providing more context or breaking down the query",
      });
    }
    
    // Check for significant latency (might indicate complexity)
    const highLatencyProviders = responses.filter((r) => (r.latencyMs || 0) > 500);
    if (highLatencyProviders.length > 1) {
      risks.push({
        description: "Query complexity may have affected response quality",
        identifiedBy: highLatencyProviders.map((r) => r.provider),
        severity: "low",
        mitigation: "Simplify the query or provide structured input",
      });
    }
    
    return risks;
  }
  
  /**
   * Synthesize unified content from all responses
   */
  private synthesizeContent(
    responses: AIProviderResponse[],
    disagreements: AIDisagreement[]
  ): string {
    const sections: string[] = [];
    
    sections.push("# Consensus Analysis\n");
    sections.push("## Unified Findings\n");
    sections.push("Based on analysis from multiple AI providers, the following consensus emerges:\n");
    
    // Weight responses by confidence
    const sortedResponses = [...responses].sort((a, b) => b.confidence - a.confidence);
    const primaryResponse = sortedResponses[0];
    
    sections.push("### Primary Analysis\n");
    sections.push(`*Source: ${primaryResponse.provider} (${primaryResponse.model})*\n`);
    sections.push(primaryResponse.content);
    sections.push("\n");
    
    // Add supporting perspectives
    if (sortedResponses.length > 1) {
      sections.push("### Supporting Perspectives\n");
      sortedResponses.slice(1).forEach((response) => {
        sections.push(`**${response.provider}** (Confidence: ${(response.confidence * 100).toFixed(1)}%):\n`);
        sections.push(`${response.summary}\n`);
      });
    }
    
    // Note disagreements if any
    if (disagreements.length > 0) {
      sections.push("\n### Areas of Divergence\n");
      disagreements.forEach((d) => {
        sections.push(`- **${d.topic}** (${d.severity} impact):\n`);
        d.providers.forEach((p) => {
          sections.push(`  - ${p.provider}: ${p.position}\n`);
        });
      });
    }
    
    return sections.join("");
  }
  
  /**
   * Generate consensus summary
   */
  private generateConsensusSummary(
    responses: AIProviderResponse[],
    agreementScore: number
  ): string {
    const providerCount = responses.length;
    const avgConfidence = this.calculateAverageConfidence(responses);
    
    if (agreementScore >= 0.85) {
      return `Strong consensus achieved across ${providerCount} providers with ${(avgConfidence * 100).toFixed(0)}% average confidence. All providers substantially agree on key conclusions.`;
    } else if (agreementScore >= 0.7) {
      return `Moderate consensus reached across ${providerCount} providers with ${(avgConfidence * 100).toFixed(0)}% average confidence. Minor variations in approach noted but core conclusions align.`;
    } else {
      return `Limited consensus among ${providerCount} providers with ${(avgConfidence * 100).toFixed(0)}% average confidence. Significant differences in perspective require attention.`;
    }
  }
  
  /**
   * Calculate average confidence across responses
   */
  private calculateAverageConfidence(responses: AIProviderResponse[]): number {
    if (responses.length === 0) return 0;
    return responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
  }
  
  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }
  
  /**
   * Get available providers
   */
  async getAvailableProviders(): Promise<AIProviderType[]> {
    const available: AIProviderType[] = [];
    
    for (const [type, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(type);
      }
    }
    
    return available;
  }
}

export const consensusService = new ConsensusService();
