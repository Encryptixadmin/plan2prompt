/**
 * Shared Type Contracts
 * 
 * This file contains cross-module type definitions used by both
 * frontend and backend. All module contracts should be defined here
 * to ensure type safety across the application.
 */

// Re-export artifact types
export * from "./artifact";

// Re-export AI types
export * from "./ai";

// Re-export Ideas module types
export * from "./ideas";

// Re-export Requirements module types
export * from "./requirements";

// Health check response type
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  service: string;
  version: string;
}

// API response wrapper for consistent responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

// Pagination parameters
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// AI Provider types (interfaces only - no implementation)
export type AIProvider = "openai" | "anthropic" | "gemini";

export interface AIServiceConfig {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// Module output metadata
export interface ModuleOutputMetadata {
  moduleId: string;
  moduleName: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}
