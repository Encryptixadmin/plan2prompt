/**
 * Guided Refinement Workshop Type Definitions
 * 
 * Types for the structured idea refinement workshop.
 */

export type WorkshopSectionType = 
  | "target_market_clarity"
  | "pain_urgency_validation"
  | "scope_boundaries"
  | "constraints_resources";

export type WorkshopQuestionType = 
  | "single_select"
  | "multi_select"
  | "short_text"
  | "banded_range";

export interface WorkshopQuestionOption {
  value: string;
  label: string;
}

export type RiskMappingType = 
  | "risk"           // Maps to IdeaRisk by category + index
  | "risk_driver"    // Maps to RiskDriver by rank
  | "scope_warning"  // Maps to ScopeWarning by area + index
  | "assumption";    // Maps to AssumptionDependency by index

export interface RiskMapping {
  type: RiskMappingType;
  riskCategory?: "market" | "technical" | "financial" | "legal" | "competitive" | "execution";
  riskIndex?: number;       // Position in risks array
  riskDriverRank?: number;  // RiskDriver.rank (unique identifier)
  scopeArea?: "technical" | "ux" | "operations" | "compliance" | "integration" | "data";
  scopeIndex?: number;      // Position in scopeWarnings array
  assumptionIndex?: number; // Position in assumptionDependencies array
  sourceText?: string;      // Original text from the risk/assumption for verification
}

export interface WorkshopQuestion {
  id: string;
  sectionType: WorkshopSectionType;
  questionType: WorkshopQuestionType;
  prompt: string;
  options?: WorkshopQuestionOption[];
  mapping?: RiskMapping;           // Structured reference to originating risk/assumption
  mappedRiskDriverId?: string;     // Legacy: string-based reference (deprecated)
  mappedAssumptionIndex?: number;  // Legacy: direct assumption index
  required: boolean;
}

export interface WorkshopSection {
  type: WorkshopSectionType;
  title: string;
  description: string;
  questions: WorkshopQuestion[];
  triggered: boolean;
  triggerReason?: string;
}

export interface WorkshopAnswer {
  questionId: string;
  value: string | string[];
}

export interface WorkshopSession {
  id: string;
  originalAnalysisId: string;
  originalIdeaInput: {
    title: string;
    description: string;
  };
  sections: WorkshopSection[];
  answers: WorkshopAnswer[];
  resolvedRiskIds: string[];
  status: "in_progress" | "completed" | "abandoned";
  createdAt: string;
  completedAt?: string;
}

export interface GenerateWorkshopRequest {
  analysisId: string;
}

export interface GenerateWorkshopResponse {
  session: WorkshopSession;
}

export interface SubmitWorkshopRequest {
  sessionId: string;
  answers: WorkshopAnswer[];
}

export interface SubmitWorkshopResponse {
  session: WorkshopSession;
  reanalysisTriggered: boolean;
}

export interface WorkshopReanalysisContext {
  originalIdea: {
    title: string;
    description: string;
  };
  workshopAnswers: WorkshopAnswer[];
  resolvedAssumptions: string[];
  clarifiedMarket?: string;
  validatedPainPoints?: string[];
  scopeBoundaries?: {
    included: string[];
    excluded: string[];
  };
  constraints?: {
    budget?: string;
    timeline?: string;
    teamSize?: string;
  };
}

export interface WorkshopComparisonResult {
  previousScore: number;
  newScore: number;
  previousRecommendation: "proceed" | "revise" | "stop";
  newRecommendation: "proceed" | "revise" | "stop";
  improvements: string[];
  unresolvedIssues: string[];
}
