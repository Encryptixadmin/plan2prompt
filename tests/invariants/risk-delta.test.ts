import { describe, it, expect } from "vitest";
import { computeRiskDeltas, applyDeltasToAnalysis, computeDeltaScoreAdjustment } from "../../server/services/risk-delta.service";
import type { IdeaAnalysis, IdeaRisk, AssumptionDependency, RiskDelta } from "../../shared/types/ideas";

function makeMinimalAnalysis(overrides: Partial<IdeaAnalysis> = {}): IdeaAnalysis {
  return {
    id: "test-id",
    input: { title: "Test", description: "Test idea" },
    strengths: [],
    weaknesses: [],
    feasibility: {
      score: 60,
      technical: { score: 60, notes: "" },
      market: { score: 60, notes: "" },
      financial: { score: 60, notes: "" },
      timeline: { score: 60, notes: "" },
    },
    risks: [],
    nextSteps: [],
    summary: "Test",
    overallScore: 60,
    consensusConfidence: 0.8,
    providerAgreement: 0.8,
    createdAt: new Date().toISOString(),
    confidenceAssessment: {
      score: 60,
      rationale: "test",
      keyFactors: [],
      limitations: [],
    },
    primaryRiskDrivers: [],
    scopeWarnings: [],
    assumptionDependencies: [],
    failureModeNarrative: {
      title: "test",
      narrative: "test",
      likelihood: "medium",
      preventionHint: "test",
    },
    recommendation: "proceed",
    recommendationRationale: "test",
    ...overrides,
  };
}

function makeRisk(overrides: Partial<IdeaRisk> = {}): IdeaRisk {
  return {
    category: "technical",
    description: "Default risk",
    severity: "high",
    ...overrides,
  };
}

function makeAssumption(overrides: Partial<AssumptionDependency> = {}): AssumptionDependency {
  return {
    assumption: "Default assumption",
    status: "unvalidated",
    ...overrides,
  };
}

describe("Risk Resolution Delta Model", () => {
  describe("Assumption Status Transitions", () => {
    it("detects unvalidated → partially_validated transition", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "partially_validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBeGreaterThan(0);
      const delta = deltas[0];
      expect(delta.assumptionChanges.length).toBe(1);
      expect(delta.assumptionChanges[0].before).toBe("unvalidated");
      expect(delta.assumptionChanges[0].after).toBe("partially_validated");
    });

    it("detects partially_validated → validated transition", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "partially_validated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBeGreaterThan(0);
      expect(deltas[0].assumptionChanges[0].before).toBe("partially_validated");
      expect(deltas[0].assumptionChanges[0].after).toBe("validated");
    });

    it("normalizes risky status to partially_validated", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "risky" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBeGreaterThan(0);
      expect(deltas[0].assumptionChanges[0].after).toBe("partially_validated");
    });

    it("does not produce delta when status is unchanged", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "Users want this", status: "unvalidated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(0);
    });
  });

  describe("Risk Severity Changes", () => {
    it("reduces high → medium when assumption goes unvalidated → partially_validated", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "partially_validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(1);
      expect(deltas[0].severityBefore).toBe("high");
      expect(deltas[0].severityAfter).toBe("medium");
    });

    it("reduces medium → low when assumption goes partially_validated → validated", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "financial", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "Revenue model works", status: "partially_validated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "financial", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "Revenue model works", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(1);
      expect(deltas[0].severityBefore).toBe("medium");
      expect(deltas[0].severityAfter).toBe("low");
    });

    it("reduces high → low when assumption goes unvalidated → validated (two-level jump)", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(1);
      expect(deltas[0].severityBefore).toBe("high");
      expect(deltas[0].severityAfter).toBe("low");
    });

    it("never reduces below low", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "low" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "low" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(1);
      expect(deltas[0].severityAfter).toBe("low");
    });

    it("does not change severity when there are no assumption improvements", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(0);
    });

    it("respects AI-driven severity reduction (uses the lower of AI and deterministic)", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "low" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "partially_validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(1);
      expect(deltas[0].severityAfter).toBe("low");
    });
  });

  describe("Delta Object Production", () => {
    it("produces a delta for each risk with changes", () => {
      const prev = makeMinimalAnalysis({
        risks: [
          makeRisk({ category: "market", severity: "high" }),
          makeRisk({ category: "technical", severity: "medium" }),
        ],
        assumptionDependencies: [
          makeAssumption({ assumption: "A1", status: "unvalidated" }),
        ],
      });
      const next = makeMinimalAnalysis({
        risks: [
          makeRisk({ category: "market", severity: "high" }),
          makeRisk({ category: "technical", severity: "medium" }),
        ],
        assumptionDependencies: [
          makeAssumption({ assumption: "A1", status: "partially_validated" }),
        ],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(2);
      deltas.forEach(delta => {
        expect(delta).toHaveProperty("riskId");
        expect(delta).toHaveProperty("severityBefore");
        expect(delta).toHaveProperty("severityAfter");
        expect(delta).toHaveProperty("assumptionChanges");
        expect(delta).toHaveProperty("improvementScore");
      });
    });

    it("assigns correct riskId using id field when available", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ id: "risk-custom-1", category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ id: "risk-custom-1", category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas[0].riskId).toBe("risk-custom-1");
    });

    it("assigns generated riskId when no id field exists", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "technical", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "technical", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas[0].riskId).toBe("risk_technical_0");
    });

    it("does not produce deltas when no changes exist", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(0);
    });

    it("improvement score is positive when severity decreases", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "partially_validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas[0].improvementScore).toBeGreaterThan(0);
    });

    it("improvement score reflects assumption + severity improvement", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      const score = deltas[0].improvementScore;
      expect(score).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Score Adjustment from Deltas", () => {
    it("returns 0 when no deltas exist", () => {
      expect(computeDeltaScoreAdjustment([])).toBe(0);
    });

    it("returns positive adjustment when deltas have improvement", () => {
      const deltas: RiskDelta[] = [{
        riskId: "r1",
        severityBefore: "high",
        severityAfter: "medium",
        assumptionChanges: [{ assumptionId: "a1", before: "unvalidated", after: "partially_validated" }],
        improvementScore: 50,
      }];
      const adjustment = computeDeltaScoreAdjustment(deltas);
      expect(adjustment).toBeGreaterThan(0);
    });

    it("caps adjustment at 15 points", () => {
      const deltas: RiskDelta[] = [
        {
          riskId: "r1",
          severityBefore: "high",
          severityAfter: "low",
          assumptionChanges: [
            { assumptionId: "a1", before: "unvalidated", after: "validated" },
          ],
          improvementScore: 100,
        },
        {
          riskId: "r2",
          severityBefore: "high",
          severityAfter: "low",
          assumptionChanges: [
            { assumptionId: "a2", before: "unvalidated", after: "validated" },
          ],
          improvementScore: 100,
        },
      ];
      const adjustment = computeDeltaScoreAdjustment(deltas);
      expect(adjustment).toBeLessThanOrEqual(15);
    });

    it("adjusts overall score when applied", () => {
      const prev = makeMinimalAnalysis({
        overallScore: 55,
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        overallScore: 60,
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "partially_validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      const adjustment = computeDeltaScoreAdjustment(deltas);
      const adjustedScore = Math.min(100, next.overallScore + adjustment);
      expect(adjustedScore).toBeGreaterThan(next.overallScore);
    });

    it("never exceeds 100 score", () => {
      const prev = makeMinimalAnalysis({
        overallScore: 95,
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        overallScore: 98,
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      const adjustment = computeDeltaScoreAdjustment(deltas);
      const adjustedScore = Math.min(100, next.overallScore + adjustment);
      expect(adjustedScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Apply Deltas to Analysis", () => {
    it("updates risk severities in the analysis object", () => {
      const analysis = makeMinimalAnalysis({
        risks: [
          makeRisk({ category: "market", severity: "high" }),
          makeRisk({ category: "technical", severity: "medium" }),
        ],
      });

      const deltas: RiskDelta[] = [{
        riskId: "risk_market_0",
        severityBefore: "high",
        severityAfter: "medium",
        assumptionChanges: [],
        improvementScore: 30,
      }];

      const updated = applyDeltasToAnalysis(analysis, deltas);
      expect(updated.risks[0].severity).toBe("medium");
      expect(updated.risks[1].severity).toBe("medium");
    });

    it("attaches riskDeltas to the analysis", () => {
      const analysis = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
      });

      const deltas: RiskDelta[] = [{
        riskId: "risk_market_0",
        severityBefore: "high",
        severityAfter: "low",
        assumptionChanges: [],
        improvementScore: 60,
      }];

      const updated = applyDeltasToAnalysis(analysis, deltas);
      expect(updated.riskDeltas).toBeDefined();
      expect(updated.riskDeltas!.length).toBe(1);
      expect(updated.riskDeltas![0].riskId).toBe("risk_market_0");
    });

    it("does not mutate the original analysis", () => {
      const analysis = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
      });

      const deltas: RiskDelta[] = [{
        riskId: "risk_market_0",
        severityBefore: "high",
        severityAfter: "low",
        assumptionChanges: [],
        improvementScore: 60,
      }];

      applyDeltasToAnalysis(analysis, deltas);
      expect(analysis.risks[0].severity).toBe("high");
      expect(analysis.riskDeltas).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty risks array", () => {
      const prev = makeMinimalAnalysis({ risks: [] });
      const next = makeMinimalAnalysis({ risks: [] });
      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(0);
    });

    it("handles empty assumptions array", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [],
      });
      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(0);
    });

    it("handles multiple assumption changes for the same risk", () => {
      const prev = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [
          makeAssumption({ assumption: "A1", status: "unvalidated" }),
          makeAssumption({ assumption: "A2", status: "unvalidated" }),
        ],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "high" })],
        assumptionDependencies: [
          makeAssumption({ assumption: "A1", status: "partially_validated" }),
          makeAssumption({ assumption: "A2", status: "validated" }),
        ],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(1);
      expect(deltas[0].assumptionChanges.length).toBe(2);
    });

    it("handles risk removed in new analysis (no match)", () => {
      const prev = makeMinimalAnalysis({
        risks: [
          makeRisk({ category: "market", severity: "high" }),
          makeRisk({ category: "legal", severity: "medium" }),
        ],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "unvalidated" })],
      });
      const next = makeMinimalAnalysis({
        risks: [makeRisk({ category: "market", severity: "medium" })],
        assumptionDependencies: [makeAssumption({ assumption: "A1", status: "validated" })],
      });

      const deltas = computeRiskDeltas(prev, next);
      expect(deltas.length).toBe(2);
    });
  });
});
