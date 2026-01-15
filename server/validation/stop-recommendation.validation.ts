export interface StopValidationRequest {
  recommendation: "proceed" | "stop";
  acknowledgeStopRecommendation?: boolean;
}

export interface StopValidationResult {
  allowed: boolean;
  error?: string;
  requiresAudit: boolean;
}

export function validateStopRecommendationAcceptance(request: StopValidationRequest): StopValidationResult {
  if (request.recommendation === "stop" && !request.acknowledgeStopRecommendation) {
    return {
      allowed: false,
      error: "Cannot accept STOP-recommended idea without explicit acknowledgment. Set acknowledgeStopRecommendation: true to proceed.",
      requiresAudit: false,
    };
  }

  if (request.recommendation === "stop" && request.acknowledgeStopRecommendation) {
    return {
      allowed: true,
      requiresAudit: true,
    };
  }

  return {
    allowed: true,
    requiresAudit: false,
  };
}
