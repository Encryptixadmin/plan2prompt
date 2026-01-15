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
