/**
 * Ideas Module Type Definitions
 * 
 * Types for the idea validation and refinement module.
 */

// User input for idea submission
export interface IdeaInput {
  title: string;
  description: string;
  context?: {
    targetMarket?: string;
    skills?: string[];
    budget?: "low" | "medium" | "high" | "enterprise";
    timeline?: string;
    competitors?: string;
  };
}

// Strength identified in the idea
export interface IdeaStrength {
  title: string;
  description: string;
  confidence: number;
}

// Weakness or concern about the idea
export interface IdeaWeakness {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  mitigation?: string;
}

// Risk flag
export interface IdeaRisk {
  category: "market" | "technical" | "financial" | "legal" | "competitive" | "execution";
  description: string;
  severity: "low" | "medium" | "high";
  recommendation?: string;
}

// Enhanced confidence assessment with rationale
export interface ConfidenceAssessment {
  score: number; // 0-100
  rationale: string; // Clear explanation of WHY this score
  keyFactors: string[]; // Specific factors that influenced the score
  limitations: string[]; // What the analysis could NOT assess
}

// Primary risk driver (ranked by impact)
export interface RiskDriver {
  rank: number;
  title: string;
  whyItMatters: string;
  failureTrigger: string; // What would trigger failure
  isControllable: boolean;
  controllabilityNote: string;
}

// Scope & complexity warning
export interface ScopeWarning {
  area: "technical" | "ux" | "operations" | "compliance" | "integration" | "data";
  warning: string;
  hiddenComplexity: string;
  underestimationRisk: "low" | "medium" | "high";
}

// Assumption dependency
export interface AssumptionDependency {
  assumption: string;
  status: "validated" | "unvalidated" | "risky";
  evidence?: string; // For validated assumptions
  validationMethod?: string; // How to validate unvalidated ones
  riskIfWrong?: string; // Consequence if assumption is false
}

// Failure mode narrative
export interface FailureModeNarrative {
  title: string;
  narrative: string;
  likelihood: "low" | "medium" | "high";
  preventionHint: string;
}

// Feasibility assessment
export interface IdeaFeasibility {
  score: number; // 0-100
  technical: {
    score: number;
    notes: string;
  };
  market: {
    score: number;
    notes: string;
  };
  financial: {
    score: number;
    notes: string;
  };
  timeline: {
    score: number;
    notes: string;
  };
}

// Next step recommendation
export interface IdeaNextStep {
  priority: number;
  action: string;
  description: string;
  effort: "low" | "medium" | "high";
}

// Complete idea analysis result
export interface IdeaAnalysis {
  id: string;
  input: IdeaInput;
  strengths: IdeaStrength[];
  weaknesses: IdeaWeakness[];
  feasibility: IdeaFeasibility;
  risks: IdeaRisk[];
  nextSteps: IdeaNextStep[];
  summary: string;
  overallScore: number; // 0-100
  consensusConfidence: number;
  providerAgreement: number;
  createdAt: string;
  artifactId?: string;
  
  // Signal Sharpening Fields (Step 6)
  confidenceAssessment: ConfidenceAssessment;
  primaryRiskDrivers: RiskDriver[];
  scopeWarnings: ScopeWarning[];
  assumptionDependencies: AssumptionDependency[];
  failureModeNarrative: FailureModeNarrative;
  
  // Decision clarity
  recommendation: "proceed" | "revise" | "stop";
  recommendationRationale: string;
}

// Ideas module API request
export interface AnalyzeIdeaRequest {
  idea: IdeaInput;
}

// Ideas module API response
export interface AnalyzeIdeaResponse {
  analysis: IdeaAnalysis;
  artifactPath: string;
}
