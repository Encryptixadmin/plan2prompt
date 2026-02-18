import { describe, it, expect } from "vitest";
import type {
  TechnicalProfile,
  CommercialProfile,
  ExecutionProfile,
  ViabilityAssessment,
  ComplexityLevel,
  DataComplexity,
  ComplianceExposure,
  ClarityLevel,
  RevenueModelClarity,
  CompetitionDensity,
  DifferentiationStrength,
  TeamComplexity,
  LikelihoodLevel,
  ViabilityBand,
  IdeaFeasibility,
} from "../../shared/types/ideas";

function computeWeightedScore(
  viability: ViabilityAssessment,
  technical: TechnicalProfile,
  commercial: CommercialProfile,
  execution: ExecutionProfile,
  feasibility: IdeaFeasibility
): number {
  const viabilityScore = viability.confidenceScore;

  const complexityScores: Record<ComplexityLevel, number> = { "Low": 90, "Moderate": 65, "High": 40, "Very High": 20 };
  const dataScores: Record<DataComplexity, number> = { "Simple": 90, "Structured": 70, "Complex": 45, "Highly Regulated": 20 };
  const techScore = Math.round(
    (complexityScores[technical.architectureComplexity] * 0.3) +
    (complexityScores[technical.integrationDifficulty] * 0.25) +
    (dataScores[technical.dataComplexity] * 0.25) +
    (feasibility.technical.score * 0.2)
  );

  const clarityScores: Record<ClarityLevel, number> = { "Defined": 90, "Partially Defined": 55, "Unclear": 20 };
  const revenueScores: Record<RevenueModelClarity, number> = { "Clear": 90, "Emerging": 55, "Unclear": 20 };
  const diffScores: Record<DifferentiationStrength, number> = { "Strong": 90, "Moderate": 55, "Weak": 20 };
  const commercialScore = Math.round(
    (clarityScores[commercial.marketClarity] * 0.3) +
    (revenueScores[commercial.revenueModelClarity] * 0.25) +
    (diffScores[commercial.differentiationStrength] * 0.25) +
    (feasibility.market.score * 0.2)
  );

  const teamScores: Record<TeamComplexity, number> = { "Solo": 80, "Small Team": 65, "Cross-Functional": 45, "Enterprise": 25 };
  const hiddenWorkScores: Record<LikelihoodLevel, number> = { "Low": 90, "Moderate": 55, "High": 20 };
  const execScore = Math.round(
    (teamScores[execution.teamComplexity] * 0.4) +
    (hiddenWorkScores[execution.hiddenWorkLikelihood] * 0.3) +
    (feasibility.timeline.score * 0.3)
  );

  const weighted = Math.round(
    (viabilityScore * 0.40) +
    (techScore * 0.25) +
    (commercialScore * 0.20) +
    (execScore * 0.15)
  );

  return Math.max(0, Math.min(100, weighted));
}

function determineRecommendation(
  overallScore: number,
  technical: TechnicalProfile,
  commercial: CommercialProfile,
  execution: ExecutionProfile
): "proceed" | "revise" | "stop" {
  if (technical.complianceExposure === "High" && execution.teamComplexity === "Solo") {
    return "stop";
  }
  if (technical.estimatedMvpEffortWeeks > 24 && execution.teamComplexity === "Solo") {
    return "revise";
  }
  if (commercial.differentiationStrength === "Weak" && commercial.competitionDensity === "High") {
    return "revise";
  }
  if (overallScore < 30) return "stop";
  if (overallScore < 60) return "revise";
  return "proceed";
}

const defaultFeasibility: IdeaFeasibility = {
  score: 60,
  technical: { score: 60, notes: "" },
  market: { score: 60, notes: "" },
  financial: { score: 60, notes: "" },
  timeline: { score: 60, notes: "" },
};

describe("Intelligence Upgrade: Structured Profile Validation", () => {
  it("9.1 Scoring weights sum to 100%: viability 40%, technical 25%, commercial 20%, execution 15%", () => {
    const weights = 0.40 + 0.25 + 0.20 + 0.15;
    expect(weights).toBeCloseTo(1.0);
  });

  it("9.2 All-favorable profile produces high score (>70)", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "Low",
      integrationDifficulty: "Low",
      dataComplexity: "Simple",
      complianceExposure: "None",
      estimatedMvpEffortWeeks: 4,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "Low",
      differentiationStrength: "Strong",
      goToMarketComplexity: "Low",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Solo",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };
    const viability: ViabilityAssessment = {
      overallViability: "Strong",
      confidenceScore: 85,
      rationale: "Strong across all dimensions.",
    };

    const highFeasibility: IdeaFeasibility = {
      score: 85,
      technical: { score: 85, notes: "" },
      market: { score: 85, notes: "" },
      financial: { score: 85, notes: "" },
      timeline: { score: 85, notes: "" },
    };

    const score = computeWeightedScore(viability, tech, comm, exec, highFeasibility);
    expect(score).toBeGreaterThan(70);
  });

  it("9.3 All-unfavorable profile produces low score (<40)", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "Very High",
      integrationDifficulty: "Very High",
      dataComplexity: "Highly Regulated",
      complianceExposure: "High",
      estimatedMvpEffortWeeks: 52,
      keyTechnicalRisks: ["Many risks"],
    };
    const comm: CommercialProfile = {
      marketClarity: "Unclear",
      revenueModelClarity: "Unclear",
      competitionDensity: "High",
      differentiationStrength: "Weak",
      goToMarketComplexity: "Very High",
      keyCommercialRisks: ["Many risks"],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Enterprise",
      hiddenWorkLikelihood: "High",
      scalabilityChallenges: ["Many"],
      operationalRisks: ["Many"],
    };
    const viability: ViabilityAssessment = {
      overallViability: "Critical Risk",
      confidenceScore: 15,
      rationale: "Extremely challenging.",
    };

    const lowFeasibility: IdeaFeasibility = {
      score: 20,
      technical: { score: 20, notes: "" },
      market: { score: 20, notes: "" },
      financial: { score: 20, notes: "" },
      timeline: { score: 20, notes: "" },
    };

    const score = computeWeightedScore(viability, tech, comm, exec, lowFeasibility);
    expect(score).toBeLessThan(40);
  });

  it("9.4 Score is always clamped between 0 and 100", () => {
    const viability: ViabilityAssessment = { overallViability: "Strong", confidenceScore: 100, rationale: "" };
    const tech: TechnicalProfile = { architectureComplexity: "Low", integrationDifficulty: "Low", dataComplexity: "Simple", complianceExposure: "None", estimatedMvpEffortWeeks: 1, keyTechnicalRisks: [] };
    const comm: CommercialProfile = { marketClarity: "Defined", revenueModelClarity: "Clear", competitionDensity: "Low", differentiationStrength: "Strong", goToMarketComplexity: "Low", keyCommercialRisks: [] };
    const exec: ExecutionProfile = { teamComplexity: "Solo", hiddenWorkLikelihood: "Low", scalabilityChallenges: [], operationalRisks: [] };

    const maxFeasibility: IdeaFeasibility = {
      score: 100,
      technical: { score: 100, notes: "" },
      market: { score: 100, notes: "" },
      financial: { score: 100, notes: "" },
      timeline: { score: 100, notes: "" },
    };

    const score = computeWeightedScore(viability, tech, comm, exec, maxFeasibility);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("Intelligence Upgrade: Recommendation Rules", () => {
  it("9.5 High compliance + solo execution triggers STOP", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "High",
      integrationDifficulty: "High",
      dataComplexity: "Highly Regulated",
      complianceExposure: "High",
      estimatedMvpEffortWeeks: 16,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "Low",
      differentiationStrength: "Strong",
      goToMarketComplexity: "Low",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Solo",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };

    const recommendation = determineRecommendation(70, tech, comm, exec);
    expect(recommendation).toBe("stop");
  });

  it("9.6 Effort > 24 weeks + solo triggers REVISE", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "High",
      integrationDifficulty: "Moderate",
      dataComplexity: "Structured",
      complianceExposure: "None",
      estimatedMvpEffortWeeks: 30,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "Low",
      differentiationStrength: "Strong",
      goToMarketComplexity: "Low",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Solo",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };

    const recommendation = determineRecommendation(75, tech, comm, exec);
    expect(recommendation).toBe("revise");
  });

  it("9.7 Weak differentiation + high competition triggers REVISE", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "Low",
      integrationDifficulty: "Low",
      dataComplexity: "Simple",
      complianceExposure: "None",
      estimatedMvpEffortWeeks: 8,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "High",
      differentiationStrength: "Weak",
      goToMarketComplexity: "Low",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Small Team",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };

    const recommendation = determineRecommendation(65, tech, comm, exec);
    expect(recommendation).toBe("revise");
  });

  it("9.8 Score < 30 triggers STOP regardless of profiles", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "Low",
      integrationDifficulty: "Low",
      dataComplexity: "Simple",
      complianceExposure: "None",
      estimatedMvpEffortWeeks: 4,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "Low",
      differentiationStrength: "Strong",
      goToMarketComplexity: "Low",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Solo",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };

    const recommendation = determineRecommendation(25, tech, comm, exec);
    expect(recommendation).toBe("stop");
  });

  it("9.9 Score >= 60 with no risk triggers PROCEED", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "Low",
      integrationDifficulty: "Low",
      dataComplexity: "Simple",
      complianceExposure: "None",
      estimatedMvpEffortWeeks: 8,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "Moderate",
      differentiationStrength: "Moderate",
      goToMarketComplexity: "Moderate",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Small Team",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };

    const recommendation = determineRecommendation(72, tech, comm, exec);
    expect(recommendation).toBe("proceed");
  });

  it("9.10 Compliance + solo rule takes priority over good score", () => {
    const tech: TechnicalProfile = {
      architectureComplexity: "Low",
      integrationDifficulty: "Low",
      dataComplexity: "Simple",
      complianceExposure: "High",
      estimatedMvpEffortWeeks: 4,
      keyTechnicalRisks: [],
    };
    const comm: CommercialProfile = {
      marketClarity: "Defined",
      revenueModelClarity: "Clear",
      competitionDensity: "Low",
      differentiationStrength: "Strong",
      goToMarketComplexity: "Low",
      keyCommercialRisks: [],
    };
    const exec: ExecutionProfile = {
      teamComplexity: "Solo",
      hiddenWorkLikelihood: "Low",
      scalabilityChallenges: [],
      operationalRisks: [],
    };

    const recommendation = determineRecommendation(90, tech, comm, exec);
    expect(recommendation).toBe("stop");
  });
});
