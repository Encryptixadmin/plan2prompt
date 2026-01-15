import { describe, it, expect } from "vitest";
import { validateStopRecommendationAcceptance } from "../../server/validation/stop-recommendation.validation";

describe("STOP Recommendation Enforcement Invariants", () => {
  it("2.1 STOP-recommended ideas MUST require acknowledgeStopRecommendation to accept", () => {
    const withoutAck = validateStopRecommendationAcceptance({
      recommendation: "stop",
    });
    expect(withoutAck.allowed).toBe(false);
    expect(withoutAck.error).toContain("Cannot accept STOP-recommended idea");
    expect(withoutAck.requiresAudit).toBe(false);

    const withFalseAck = validateStopRecommendationAcceptance({
      recommendation: "stop",
      acknowledgeStopRecommendation: false,
    });
    expect(withFalseAck.allowed).toBe(false);
  });

  it("2.2 Acknowledged STOP MUST succeed and create audit entry", () => {
    const result = validateStopRecommendationAcceptance({
      recommendation: "stop",
      acknowledgeStopRecommendation: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.requiresAudit).toBe(true);

    const proceedResult = validateStopRecommendationAcceptance({
      recommendation: "proceed",
    });
    expect(proceedResult.allowed).toBe(true);
    expect(proceedResult.requiresAudit).toBe(false);
  });
});
