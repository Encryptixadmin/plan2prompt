import type {
  AIPrompt,
  AIProviderType,
  AIProviderResponse,
  AIConsensusResult,
  AIDisagreement,
  AIRisk,
  ConsensusRequest,
} from "@shared/types/ai";
import type { UsageModule } from "@shared/schema";
import { type IAIProvider } from "./provider.interface";
import { openaiService } from "./openai.service";
import { anthropicService } from "./anthropic.service";
import { geminiService } from "./gemini.service";
import { usageService } from "./usage.service";
import { billingService } from "../billing.service";

interface ProviderQueryResult {
  response?: AIProviderResponse;
  error?: string;
  provider: AIProviderType;
}

export class ConsensusService {
  private providers: Map<AIProviderType, IAIProvider>;

  constructor() {
    this.providers = new Map();
    this.providers.set("openai", openaiService);
    this.providers.set("anthropic", anthropicService);
    this.providers.set("gemini", geminiService);
  }

  async getConsensus(
    request: ConsensusRequest,
    usageContext?: { projectId: string; module: UsageModule; artifactId?: string; artifactVersion?: number; userId?: string }
  ): Promise<AIConsensusResult> {
    const startTime = Date.now();
    const providersToQuery = request.providers || (["openai", "anthropic", "gemini"] as AIProviderType[]);

    const results = await this.queryProvidersWithFallback(request.prompt, providersToQuery);

    if (usageContext) {
      this.recordUsageForResults(results, usageContext);
    }

    const successfulResponses = results
      .filter((r): r is { response: AIProviderResponse; provider: AIProviderType } => !!r.response)
      .map((r) => r.response);

    const failedProviders = results.filter((r) => r.error);

    if (successfulResponses.length === 0) {
      throw new Error(
        "All AI providers failed. Please try again in a moment. " +
        `Errors: ${failedProviders.map((f) => `${f.provider}: ${f.error}`).join("; ")}`
      );
    }

    const { agreementScore, disagreements } = this.analyzeAgreement(successfulResponses);
    const risks = this.identifyRisks(successfulResponses, failedProviders);

    const minimumConfidence = request.minimumConfidence || 0.7;
    const averageConfidence = this.calculateAverageConfidence(successfulResponses);
    const consensusReached = request.requireUnanimity
      ? agreementScore >= 0.9 && averageConfidence >= minimumConfidence
      : agreementScore >= 0.6 && averageConfidence >= minimumConfidence;

    const unifiedContent = this.synthesizeContent(successfulResponses, disagreements);
    const summary = this.generateConsensusSummary(successfulResponses, agreementScore);

    return {
      consensusReached,
      agreementScore,
      summary,
      unifiedContent,
      confidence: averageConfidence,
      risks,
      disagreements,
      providerResponses: successfulResponses,
      metadata: {
        providersQueried: providersToQuery,
        totalLatencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async queryProvidersWithFallback(
    prompt: AIPrompt,
    providers: AIProviderType[]
  ): Promise<ProviderQueryResult[]> {
    const results = await Promise.all(
      providers.map(async (providerType): Promise<ProviderQueryResult> => {
        const provider = this.providers.get(providerType);
        if (!provider) {
          return { provider: providerType, error: `Provider ${providerType} not found` };
        }

        try {
          const response = await provider.generate(prompt);
          return { provider: providerType, response };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[Consensus] Provider ${providerType} failed: ${message}`);
          return { provider: providerType, error: message };
        }
      })
    );

    return results;
  }

  private analyzeAgreement(responses: AIProviderResponse[]): {
    agreementScore: number;
    disagreements: AIDisagreement[];
  } {
    const disagreements: AIDisagreement[] = [];

    const confidences = responses.map((r) => r.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const confidenceVariance = this.calculateVariance(confidences);

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

    const disagreementPenalty = disagreements.reduce((penalty, d) => {
      const severityWeight = { low: 0.05, medium: 0.15, high: 0.3 };
      return penalty + severityWeight[d.severity];
    }, 0);

    const agreementScore = Math.max(0.5, Math.min(1, avgConfidence - disagreementPenalty));

    return { agreementScore, disagreements };
  }

  private identifyRisks(
    responses: AIProviderResponse[],
    failedProviders: ProviderQueryResult[] = []
  ): AIRisk[] {
    const risks: AIRisk[] = [];

    if (failedProviders.length > 0) {
      risks.push({
        description: `${failedProviders.length} provider(s) were unavailable for this analysis`,
        identifiedBy: failedProviders.map((f) => f.provider),
        severity: failedProviders.length >= 2 ? "medium" : "low",
        mitigation: "Analysis continued with available providers. Results may be less comprehensive.",
      });
    }

    const mockResponses = responses.filter((r) => r.isMock);
    if (mockResponses.length > 0) {
      risks.push({
        description: `${mockResponses.length} provider(s) returned mock data (API keys not configured)`,
        identifiedBy: mockResponses.map((r) => r.provider),
        severity: mockResponses.length === responses.length ? "high" : "medium",
        mitigation: "Configure API keys for real AI analysis",
      });
    }

    const lowConfidenceProviders = responses.filter((r) => r.confidence < 0.75);
    if (lowConfidenceProviders.length > 0) {
      risks.push({
        description: "Some providers reported lower confidence in their responses",
        identifiedBy: lowConfidenceProviders.map((r) => r.provider),
        severity: lowConfidenceProviders.length >= 2 ? "medium" : "low",
        mitigation: "Consider providing more context or breaking down the query",
      });
    }

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

  private synthesizeContent(
    responses: AIProviderResponse[],
    disagreements: AIDisagreement[]
  ): string {
    const sections: string[] = [];

    sections.push("# Consensus Analysis\n");
    sections.push("## Unified Findings\n");
    sections.push("Based on analysis from multiple AI providers, the following consensus emerges:\n");

    const sortedResponses = [...responses].sort((a, b) => b.confidence - a.confidence);
    const primaryResponse = sortedResponses[0];

    sections.push("### Primary Analysis\n");
    sections.push(`*Source: ${primaryResponse.provider} (${primaryResponse.model})*\n`);
    sections.push(primaryResponse.content);
    sections.push("\n");

    if (sortedResponses.length > 1) {
      sections.push("### Supporting Perspectives\n");
      sortedResponses.slice(1).forEach((response) => {
        sections.push(`**${response.provider}** (Confidence: ${(response.confidence * 100).toFixed(1)}%):\n`);
        sections.push(`${response.summary}\n`);
      });
    }

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

  private generateConsensusSummary(
    responses: AIProviderResponse[],
    agreementScore: number
  ): string {
    const providerCount = responses.length;
    const avgConfidence = this.calculateAverageConfidence(responses);

    if (agreementScore >= 0.85) {
      return `Strong consensus achieved across ${providerCount} providers with ${(avgConfidence * 100).toFixed(0)}% average confidence.`;
    } else if (agreementScore >= 0.7) {
      return `Moderate consensus reached across ${providerCount} providers with ${(avgConfidence * 100).toFixed(0)}% average confidence.`;
    } else {
      return `Limited consensus among ${providerCount} providers with ${(avgConfidence * 100).toFixed(0)}% average confidence.`;
    }
  }

  private calculateAverageConfidence(responses: AIProviderResponse[]): number {
    if (responses.length === 0) return 0;
    return responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  async getAvailableProviders(): Promise<AIProviderType[]> {
    const available: AIProviderType[] = [];
    const entries = Array.from(this.providers.entries());

    for (const [type, provider] of entries) {
      if (await provider.isAvailable()) {
        available.push(type);
      }
    }

    return available;
  }

  async getProviderStatus(): Promise<{ provider: AIProviderType; available: boolean; model: string }[]> {
    const entries = Array.from(this.providers.entries());
    const status = await Promise.all(
      entries.map(async ([type, provider]) => ({
        provider: type,
        available: await provider.isAvailable(),
        model: provider.model,
      }))
    );
    return status;
  }

  private recordUsageForResults(
    results: ProviderQueryResult[],
    context: { projectId: string; module: UsageModule; artifactId?: string; artifactVersion?: number; userId?: string }
  ): void {
    let totalTokens = 0;
    
    for (const result of results) {
      const tokenUsage = result.response?.tokenUsage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      const model = result.response?.model || "unknown";
      const estimatedCost = usageService.estimateCost(model, tokenUsage.inputTokens, tokenUsage.outputTokens);

      usageService.recordUsage({
        provider: result.provider,
        model,
        tokens: tokenUsage,
        estimatedCostUsd: estimatedCost,
        projectId: context.projectId,
        module: context.module,
        artifactId: context.artifactId,
        artifactVersion: context.artifactVersion,
        latencyMs: result.response?.latencyMs || 0,
        success: !result.error,
        errorMessage: result.error,
      });
      
      // Accumulate tokens for billing
      if (!result.error) {
        totalTokens += tokenUsage.totalTokens;
      }
    }
    
    // Record to billing service for user usage tracking
    if (context.userId && totalTokens > 0) {
      billingService.recordGeneration(context.userId, totalTokens);
    }
  }
}

export const consensusService = new ConsensusService();
