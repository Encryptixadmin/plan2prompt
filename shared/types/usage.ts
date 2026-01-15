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

export const COST_PER_1K_TOKENS: Record<AIProvider, number> = {
  openai: 0.002,
  anthropic: 0.003,
  gemini: 0.001,
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
