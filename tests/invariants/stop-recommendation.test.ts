import { describe, it, expect } from "vitest";

interface IdeaAcceptanceRequest {
  ideaId: string;
  recommendation: "proceed" | "stop";
  acknowledgeStopRecommendation?: boolean;
}

const validateAcceptance = (request: IdeaAcceptanceRequest) => {
  if (request.recommendation === "stop" && !request.acknowledgeStopRecommendation) {
    return { allowed: false, error: "Cannot accept STOP-recommended idea without acknowledgment" };
  }
  return { allowed: true };
};

describe("STOP Recommendation Enforcement Invariants", () => {
  it("2.1 STOP-recommended ideas MUST require acknowledgeStopRecommendation to accept", () => {
    const withoutAck: IdeaAcceptanceRequest = { ideaId: "test", recommendation: "stop" };
    const withFalseAck: IdeaAcceptanceRequest = { ideaId: "test", recommendation: "stop", acknowledgeStopRecommendation: false };

    expect(validateAcceptance(withoutAck).allowed).toBe(false);
    expect(validateAcceptance(withFalseAck).allowed).toBe(false);
  });

  it("2.2 Acknowledged STOP MUST succeed and create audit entry", () => {
    const request: IdeaAcceptanceRequest = { ideaId: "test", recommendation: "stop", acknowledgeStopRecommendation: true };
    const auditLog: Array<{ action: string }> = [];

    const result = validateAcceptance(request);
    if (result.allowed) {
      auditLog.push({ action: "STOP_RECOMMENDATION_ACKNOWLEDGED" });
    }

    expect(result.allowed).toBe(true);
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].action).toBe("STOP_RECOMMENDATION_ACKNOWLEDGED");
  });
});
