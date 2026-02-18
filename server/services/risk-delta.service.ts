import type {
  IdeaAnalysis,
  IdeaRisk,
  AssumptionDependency,
  RiskDelta,
  RiskSeverity,
  AssumptionStatus,
  AssumptionChange,
} from "../../shared/types/ideas";

const SEVERITY_ORDER: Record<RiskSeverity, number> = { high: 3, medium: 2, low: 1 };

function normalizeAssumptionStatus(status: string): AssumptionStatus {
  if (status === "risky") return "partially_validated";
  if (status === "partially_validated") return "partially_validated";
  if (status === "validated") return "validated";
  return "unvalidated";
}

function reduceSeverity(severity: RiskSeverity): RiskSeverity {
  if (severity === "high") return "medium";
  if (severity === "medium") return "low";
  return "low";
}

function computeImprovementScore(
  severityBefore: RiskSeverity,
  severityAfter: RiskSeverity,
  assumptionChanges: AssumptionChange[]
): number {
  const severityDelta = SEVERITY_ORDER[severityBefore] - SEVERITY_ORDER[severityAfter];

  let assumptionDelta = 0;
  for (const change of assumptionChanges) {
    const statusOrder: Record<AssumptionStatus, number> = {
      unvalidated: 0,
      partially_validated: 1,
      validated: 2,
    };
    const diff = statusOrder[change.after] - statusOrder[change.before];
    if (diff > 0) assumptionDelta += diff;
  }

  return Math.min(100, (severityDelta * 30) + (assumptionDelta * 20));
}

function matchRisk(prevRisk: IdeaRisk, prevIndex: number, newRisks: IdeaRisk[]): IdeaRisk | undefined {
  if (prevRisk.id) {
    const byId = newRisks.find(r => r.id === prevRisk.id);
    if (byId) return byId;
  }
  const byExact = newRisks.find(r =>
    r.category === prevRisk.category && r.description === prevRisk.description
  );
  if (byExact) return byExact;
  return newRisks.find(r => r.category === prevRisk.category);
}

function matchAssumption(
  prevAssumption: AssumptionDependency,
  newAssumptions: AssumptionDependency[]
): AssumptionDependency | undefined {
  if (prevAssumption.id) {
    const byId = newAssumptions.find(a => a.id === prevAssumption.id);
    if (byId) return byId;
  }
  return newAssumptions.find(a => a.assumption === prevAssumption.assumption);
}

export function computeRiskDeltas(
  previousAnalysis: IdeaAnalysis,
  newAnalysis: IdeaAnalysis
): RiskDelta[] {
  const deltas: RiskDelta[] = [];

  previousAnalysis.risks.forEach((prevRisk, index) => {
    const riskId = prevRisk.id || `risk_${prevRisk.category}_${index}`;
    const newRisk = matchRisk(prevRisk, index, newAnalysis.risks);

    const severityBefore = prevRisk.severity;
    let severityAfter = newRisk ? newRisk.severity : severityBefore;

    const assumptionChanges: AssumptionChange[] = [];

    previousAnalysis.assumptionDependencies.forEach((prevAssumption, aIdx) => {
      const assumptionId = prevAssumption.id || `assumption_${aIdx}`;
      const newAssumption = matchAssumption(prevAssumption, newAnalysis.assumptionDependencies);

      if (newAssumption) {
        const before = normalizeAssumptionStatus(prevAssumption.status);
        const after = normalizeAssumptionStatus(newAssumption.status);

        if (before !== after) {
          assumptionChanges.push({ assumptionId, before, after });
        }
      }
    });

    for (const change of assumptionChanges) {
      if (
        change.before === "unvalidated" && change.after === "partially_validated"
      ) {
        severityAfter = reduceSeverity(severityAfter);
      } else if (
        change.before === "partially_validated" && change.after === "validated"
      ) {
        severityAfter = reduceSeverity(severityAfter);
      } else if (
        change.before === "unvalidated" && change.after === "validated"
      ) {
        severityAfter = reduceSeverity(reduceSeverity(severityAfter));
      }
    }

    if (SEVERITY_ORDER[severityAfter] < 1) {
      severityAfter = "low";
    }

    const improvementScore = computeImprovementScore(severityBefore, severityAfter, assumptionChanges);

    if (severityBefore !== severityAfter || assumptionChanges.length > 0) {
      deltas.push({
        riskId,
        severityBefore,
        severityAfter,
        assumptionChanges,
        improvementScore,
      });
    }
  });

  return deltas;
}

export function applyDeltasToAnalysis(
  analysis: IdeaAnalysis,
  deltas: RiskDelta[]
): IdeaAnalysis {
  const updatedRisks = analysis.risks.map((risk, index) => {
    const riskId = risk.id || `risk_${risk.category}_${index}`;
    const delta = deltas.find(d => d.riskId === riskId);
    if (delta) {
      return { ...risk, severity: delta.severityAfter };
    }
    return risk;
  });

  return {
    ...analysis,
    risks: updatedRisks,
    riskDeltas: deltas,
  };
}

export function computeDeltaScoreAdjustment(deltas: RiskDelta[]): number {
  if (deltas.length === 0) return 0;

  let totalImprovement = 0;
  for (const delta of deltas) {
    totalImprovement += delta.improvementScore;
  }

  return Math.min(15, Math.round(totalImprovement / deltas.length));
}
