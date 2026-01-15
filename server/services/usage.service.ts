import { randomUUID } from "crypto";
import type {
  UsageRecord,
  UsageSummary,
  ModuleUsage,
  ProviderUsage,
  CostEstimate,
  UsageLimitWarning,
} from "@shared/types/usage";
import type { UsageModule, AIProvider } from "@shared/schema";
import { COST_PER_1K_TOKENS, estimateCost, formatCostDisplay } from "@shared/types/usage";

interface UsageStore {
  records: Map<string, UsageRecord>;
}

const store: UsageStore = {
  records: new Map(),
};

const SOFT_LIMIT_THRESHOLD = 0.8;
const DEFAULT_MONTHLY_LIMIT = 10.0;

export class UsageService {
  async recordUsage(
    projectId: string,
    userId: string,
    module: UsageModule,
    provider: AIProvider,
    tokensUsed: number,
    actionType: string
  ): Promise<UsageRecord> {
    const id = randomUUID();
    const estimatedCost = estimateCost(provider, tokensUsed);

    const record: UsageRecord = {
      id,
      projectId,
      userId,
      module,
      provider,
      tokensUsed,
      estimatedCost,
      actionType,
      timestamp: new Date().toISOString(),
    };

    store.records.set(id, record);
    return record;
  }

  async getProjectUsage(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageSummary> {
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate || now;

    const records = Array.from(store.records.values()).filter((r) => {
      const timestamp = new Date(r.timestamp);
      return (
        r.projectId === projectId &&
        timestamp >= start &&
        timestamp <= end
      );
    });

    const byModule: Record<UsageModule, ModuleUsage> = {
      ideas: { module: "ideas", tokensUsed: 0, estimatedCost: 0, actionCount: 0 },
      requirements: { module: "requirements", tokensUsed: 0, estimatedCost: 0, actionCount: 0 },
      prompts: { module: "prompts", tokensUsed: 0, estimatedCost: 0, actionCount: 0 },
    };

    const byProvider: Record<AIProvider, ProviderUsage> = {
      openai: { provider: "openai", tokensUsed: 0, estimatedCost: 0, actionCount: 0 },
      anthropic: { provider: "anthropic", tokensUsed: 0, estimatedCost: 0, actionCount: 0 },
      gemini: { provider: "gemini", tokensUsed: 0, estimatedCost: 0, actionCount: 0 },
    };

    let totalTokens = 0;
    let totalCost = 0;

    for (const record of records) {
      totalTokens += record.tokensUsed;
      totalCost += record.estimatedCost;

      byModule[record.module].tokensUsed += record.tokensUsed;
      byModule[record.module].estimatedCost += record.estimatedCost;
      byModule[record.module].actionCount++;

      byProvider[record.provider].tokensUsed += record.tokensUsed;
      byProvider[record.provider].estimatedCost += record.estimatedCost;
      byProvider[record.provider].actionCount++;
    }

    return {
      projectId,
      totalTokens,
      totalEstimatedCost: totalCost,
      byModule,
      byProvider,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  estimateActionCost(
    module: UsageModule,
    provider: AIProvider
  ): CostEstimate {
    const estimatedTokens = this.getEstimatedTokens(module);
    const cost = estimateCost(provider, estimatedTokens);

    return {
      module,
      provider,
      estimatedTokens,
      estimatedCost: cost,
      displayMessage: `This action will use ${formatCostDisplay(cost)} in credits`,
    };
  }

  async checkSoftLimits(projectId: string): Promise<UsageLimitWarning | null> {
    const summary = await this.getProjectUsage(projectId);
    const percentUsed = (summary.totalEstimatedCost / DEFAULT_MONTHLY_LIMIT) * 100;

    if (percentUsed >= SOFT_LIMIT_THRESHOLD * 100) {
      return {
        type: "soft",
        message: `You're approaching your usage goal for this period. Current usage: ${formatCostDisplay(summary.totalEstimatedCost)}`,
        currentUsage: summary.totalEstimatedCost,
        suggestedLimit: DEFAULT_MONTHLY_LIMIT,
        percentUsed,
      };
    }

    return null;
  }

  private getEstimatedTokens(module: UsageModule): number {
    switch (module) {
      case "ideas":
        return 2000;
      case "requirements":
        return 4000;
      case "prompts":
        return 3000;
      default:
        return 1000;
    }
  }
}

export const usageService = new UsageService();
