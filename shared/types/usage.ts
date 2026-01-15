/**
 * Usage Tracking Type Definitions
 * 
 * Track AI usage per project, module, and provider.
 * Soft limits only - warnings, not hard stops.
 */

import type { UsageModule, AIProvider } from "@shared/schema";

export interface UsageRecord {
  id: string;
  projectId: string;
  userId: string;
  module: UsageModule;
  provider: AIProvider;
  tokensUsed: number;
  estimatedCost: number;
  actionType: string;
  timestamp: string;
}

export interface UsageSummary {
  projectId: string;
  totalTokens: number;
  totalEstimatedCost: number;
  byModule: Record<UsageModule, ModuleUsage>;
  byProvider: Record<AIProvider, ProviderUsage>;
  periodStart: string;
  periodEnd: string;
}

export interface ModuleUsage {
  module: UsageModule;
  tokensUsed: number;
  estimatedCost: number;
  actionCount: number;
}

export interface ProviderUsage {
  provider: AIProvider;
  tokensUsed: number;
  estimatedCost: number;
  actionCount: number;
}

export interface CostEstimate {
  module: UsageModule;
  provider: AIProvider;
  estimatedTokens: number;
  estimatedCost: number;
  displayMessage: string;
}

export interface UsageLimitWarning {
  type: "soft";
  message: string;
  currentUsage: number;
  suggestedLimit: number;
  percentUsed: number;
}

export interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelCostConfig {
  inputPer1k: number;
  outputPer1k: number;
}

export const MODEL_COSTS: Record<string, ModelCostConfig> = {
  "gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
  "gpt-4o": { inputPer1k: 0.005, outputPer1k: 0.015 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "claude-3-5-sonnet-20241022": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-opus-20240229": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "gemini-1.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
  "gemini-pro": { inputPer1k: 0.00025, outputPer1k: 0.0005 },
};

export const COST_PER_1K_TOKENS: Record<AIProvider, number> = {
  openai: 0.002,
  anthropic: 0.003,
  gemini: 0.001,
};

export const USAGE_SOFT_THRESHOLDS = {
  dailyCostUsd: 10,
  monthlyTokens: 1_000_000,
  singleRequestTokens: 50_000,
};

export function estimateCost(
  provider: AIProvider,
  tokens: number
): number {
  return (tokens / 1000) * COST_PER_1K_TOKENS[provider];
}

export function formatCostDisplay(cost: number): string {
  if (cost < 0.01) {
    return "less than $0.01";
  }
  return `approximately $${cost.toFixed(2)}`;
}

export function createCostEstimateMessage(estimate: CostEstimate): string {
  return `This action will use ${formatCostDisplay(estimate.estimatedCost)} in credits`;
}
