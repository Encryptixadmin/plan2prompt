/**
 * Ideas Module Type Definitions
 * 
 * Types for the idea validation and refinement module.
 */

export type IdeaPurpose = "commercial" | "developer_tool" | "internal" | "open_source" | "learning";

// User input for idea submission
export interface IdeaInput {
  title: string;
  description: string;
  purpose?: IdeaPurpose;
  context?: {
    targetMarket?: string;
    skills?: string[];
    budget?: "low" | "medium" | "high" | "enterprise";
    timeline?: string;
    competitors?: string;
    workshopRefinement?: string;
    workshopResolution?: unknown;
    researchBrief?: string;
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

export type ComplexityLevel = "Low" | "Moderate" | "High" | "Very High";
export type DataComplexity = "Simple" | "Structured" | "Complex" | "Highly Regulated";
export type ComplianceExposure = "None" | "Low" | "Moderate" | "High";
export type ClarityLevel = "Defined" | "Partially Defined" | "Unclear";
export type RevenueModelClarity = "Clear" | "Emerging" | "Unclear";
export type CompetitionDensity = "Low" | "Moderate" | "High";
export type DifferentiationStrength = "Weak" | "Moderate" | "Strong";
export type TeamComplexity = "Solo" | "Small Team" | "Cross-Functional" | "Enterprise";
export type LikelihoodLevel = "Low" | "Moderate" | "High";
export type ViabilityBand = "Strong" | "Moderate" | "Weak" | "Critical Risk";

export interface TechnicalProfile {
  architectureComplexity: ComplexityLevel;
  integrationDifficulty: ComplexityLevel;
  dataComplexity: DataComplexity;
  complianceExposure: ComplianceExposure;
  estimatedMvpEffortWeeks: number;
  keyTechnicalRisks: string[];
}

export interface CommercialProfile {
  marketClarity: ClarityLevel;
  revenueModelClarity: RevenueModelClarity;
  competitionDensity: CompetitionDensity;
  differentiationStrength: DifferentiationStrength;
  goToMarketComplexity: ComplexityLevel;
  keyCommercialRisks: string[];
}

export interface ExecutionProfile {
  teamComplexity: TeamComplexity;
  hiddenWorkLikelihood: LikelihoodLevel;
  scalabilityChallenges: string[];
  operationalRisks: string[];
}

export interface ViabilityAssessment {
  overallViability: ViabilityBand;
  confidenceScore: number; // 0-100
  rationale: string;
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
  
  // Structured profiles (Intelligence Upgrade) - optional for backward compatibility
  technicalProfile?: TechnicalProfile;
  commercialProfile?: CommercialProfile;
  executionProfile?: ExecutionProfile;
  viabilityAssessment?: ViabilityAssessment;

  // Signal Sharpening Fields
  confidenceAssessment: ConfidenceAssessment;
  primaryRiskDrivers: RiskDriver[];
  scopeWarnings: ScopeWarning[];
  assumptionDependencies: AssumptionDependency[];
  failureModeNarrative: FailureModeNarrative;
  
  // Decision clarity
  recommendation: "proceed" | "revise" | "stop";
  recommendationRationale: string;
  
  // Project context
  projectId?: string;
  authorId?: string;
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
