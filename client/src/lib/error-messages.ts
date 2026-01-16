interface StructuredError {
  code?: string;
  message?: string;
  error?: string;
}

function extractErrorMessage(error: unknown): { message: string; code?: string } {
  if (!error) {
    return { message: "" };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as StructuredError;
    return { 
      message: obj.message || obj.error || JSON.stringify(error),
      code: obj.code,
    };
  }

  return { message: String(error) };
}

export class AnalysisTimeoutError extends Error {
  code = "ANALYSIS_TIMEOUT";
  constructor() {
    super("Analysis is taking longer than expected");
    this.name = "AnalysisTimeoutError";
  }
}

export function mapBackendError(error: unknown): string {
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  const { message, code } = extractErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (code === "ANALYSIS_TIMEOUT" || error instanceof AnalysisTimeoutError || lowerMessage.includes("analysis_timeout") || lowerMessage.includes("aborted")) {
    return "Analysis is taking longer than expected. This can happen when models are under heavy load. Please try again in a moment.";
  }

  if (code === "MISSING_PROJECT_CONTEXT" || lowerMessage.includes("missing_project_context") || lowerMessage.includes("project context") || lowerMessage.includes("x-project-id")) {
    return "Please create or select a project before continuing.";
  }

  if (code === "NO_VALID_AI_PROVIDERS" || lowerMessage.includes("no_valid_ai_providers") || lowerMessage.includes("no ai providers") || lowerMessage.includes("providers are currently available")) {
    return "Idea analysis is unavailable due to configuration issues.";
  }

  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("not authenticated")) {
    return "You must be logged in to perform this action.";
  }

  if (lowerMessage.includes("forbidden") || lowerMessage.includes("permission")) {
    return "You do not have permission to perform this action.";
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("fetch") || lowerMessage === "[object response]") {
    return "Network error. Please check your connection and try again.";
  }

  if (!message || message === "[object Object]") {
    return "An unexpected error occurred. Please try again.";
  }

  return message;
}
