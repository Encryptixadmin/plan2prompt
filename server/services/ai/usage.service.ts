import type { AIProviderType } from "@shared/types/ai";
import type { UsageModule, AIProvider } from "@shared/schema";
import { MODEL_COSTS, USAGE_SOFT_THRESHOLDS } from "@shared/types/usage";

interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface UsageEntry {
  id: string;
  timestamp: string;
  provider: AIProviderType;
  model: string;
  tokens: TokenBreakdown;
  estimatedCostUsd: number;
  projectId: string;
  module: UsageModule;
  artifactId?: string;
  artifactVersion?: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

class UsageService {
  private usageLog: UsageEntry[] = [];

  recordUsage(entry: Omit<UsageEntry, "id" | "timestamp">): UsageEntry {
    const record: UsageEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.usageLog.push(record);
    this.checkSoftLimits(record);

    return record;
  }

  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = MODEL_COSTS[model];
    if (!costs) {
      return ((inputTokens + outputTokens) / 1000) * 0.002;
    }
    return (inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k;
  }

  private checkSoftLimits(entry: UsageEntry): void {
    if (entry.tokens.totalTokens > USAGE_SOFT_THRESHOLDS.singleRequestTokens) {
      console.warn(
        `[UsageService] High token usage detected: ${entry.tokens.totalTokens} tokens ` +
        `(threshold: ${USAGE_SOFT_THRESHOLDS.singleRequestTokens})`
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCost = this.usageLog
      .filter((e) => new Date(e.timestamp) >= todayStart)
      .reduce((sum, e) => sum + e.estimatedCostUsd, 0);

    if (todayCost > USAGE_SOFT_THRESHOLDS.dailyCostUsd) {
      console.warn(
        `[UsageService] Daily cost threshold exceeded: $${todayCost.toFixed(2)} ` +
        `(threshold: $${USAGE_SOFT_THRESHOLDS.dailyCostUsd})`
      );
    }
  }

  getUsageSummary(projectId?: string): {
    totalRequests: number;
    totalTokens: number;
    totalCostUsd: number;
    byProvider: Record<string, { requests: number; tokens: number; costUsd: number }>;
    byModule: Record<string, { requests: number; tokens: number; costUsd: number }>;
  } {
    const entries = projectId
      ? this.usageLog.filter((e) => e.projectId === projectId)
      : this.usageLog;

    const byProvider: Record<string, { requests: number; tokens: number; costUsd: number }> = {};
    const byModule: Record<string, { requests: number; tokens: number; costUsd: number }> = {};

    for (const entry of entries) {
      if (!byProvider[entry.provider]) {
        byProvider[entry.provider] = { requests: 0, tokens: 0, costUsd: 0 };
      }
      byProvider[entry.provider].requests++;
      byProvider[entry.provider].tokens += entry.tokens.totalTokens;
      byProvider[entry.provider].costUsd += entry.estimatedCostUsd;

      if (!byModule[entry.module]) {
        byModule[entry.module] = { requests: 0, tokens: 0, costUsd: 0 };
      }
      byModule[entry.module].requests++;
      byModule[entry.module].tokens += entry.tokens.totalTokens;
      byModule[entry.module].costUsd += entry.estimatedCostUsd;
    }

    return {
      totalRequests: entries.length,
      totalTokens: entries.reduce((sum, e) => sum + e.tokens.totalTokens, 0),
      totalCostUsd: entries.reduce((sum, e) => sum + e.estimatedCostUsd, 0),
      byProvider,
      byModule,
    };
  }

  getRecentUsage(limit = 50): UsageEntry[] {
    return this.usageLog.slice(-limit);
  }
}

export const usageService = new UsageService();
