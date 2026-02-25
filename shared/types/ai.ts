/**
 * AI Provider Type Definitions
 * 
 * Defines the contracts for AI service providers and consensus mechanisms.
 * All providers implement the same interface for easy swapping.
 */

// Supported AI providers
export type AIProviderType = "openai" | "anthropic" | "gemini" | "anthropic-opus";

// Input prompt structure
export interface AIPrompt {
  system?: string;
  user: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "json_object";
}

// Token usage breakdown
export interface AITokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Individual provider response
export interface AIProviderResponse {
  provider: AIProviderType;
  model: string;
  content: string;
  summary: string;
  confidence: number; // 0-1 scale
  reasoning?: string;
  tokensUsed?: number;
  tokenUsage?: AITokenUsage;
  latencyMs?: number;
  timestamp: string;
  isMock?: boolean;
}

// Disagreement between providers
export interface AIDisagreement {
  topic: string;
  providers: {
    provider: AIProviderType;
    position: string;
  }[];
  severity: "low" | "medium" | "high";
}

// Risk identified in responses
export interface AIRisk {
  description: string;
  identifiedBy: AIProviderType[];
  severity: "low" | "medium" | "high";
  mitigation?: string;
}

// Consensus result from multiple providers
export interface AIConsensusResult {
  consensusReached: boolean;
  agreementScore: number; // 0-1 scale
  summary: string;
  unifiedContent: string;
  confidence: number;
  risks: AIRisk[];
  disagreements: AIDisagreement[];
  providerResponses: AIProviderResponse[];
  metadata: {
    providersQueried: AIProviderType[];
    totalLatencyMs: number;
    timestamp: string;
  };
}

// Provider configuration (for future real implementation)
export interface AIProviderConfig {
  provider: AIProviderType;
  model: string;
  apiKey?: string; // Will be set via environment
  baseUrl?: string;
  timeout?: number;
}

// Request for consensus evaluation
export interface ConsensusRequest {
  prompt: AIPrompt;
  providers?: AIProviderType[]; // Defaults to all
  requireUnanimity?: boolean;
  minimumConfidence?: number;
  raceMode?: boolean; // Return as soon as the first provider succeeds
}
