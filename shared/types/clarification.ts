export type ClarificationOriginModule = "requirements" | "prompts" | "execution";

export type ClarificationCategory =
  | "missing_information"
  | "contradiction"
  | "architecture_gap"
  | "regulatory_gap"
  | "data_model_gap"
  | "scope_conflict"
  | "execution_failure";

export type ClarificationSeverity = "advisory" | "blocker";

export type ClarificationResolutionStatus = "pending" | "resolved" | "dismissed";

export type ClarificationAnswerType =
  | "short_text"
  | "long_text"
  | "select"
  | "multi_select"
  | "number"
  | "boolean";

export interface ClarificationQuestion {
  field: string;
  question: string;
  expectedAnswerType: ClarificationAnswerType;
  options?: string[];
}

export interface ClarificationAffectedEntities {
  requirementIds?: string[];
  promptStepIds?: string[];
  ideaRiskIds?: string[];
  assumptionIds?: string[];
}

export interface IntegrityContext {
  stepNumber: number;
  integrityLevel: "safe" | "caution" | "critical";
  isIdempotent: boolean;
  reexecutionCount: number;
  duplicateFailureDetected: boolean;
}

export interface ClarificationContract {
  id: string;
  projectId: string;
  timestamp: string;
  originatingModule: ClarificationOriginModule;
  currentArtifactId: string;
  currentArtifactVersion: number;
  upstreamArtifactId: string;
  upstreamArtifactVersion: number;
  severity: ClarificationSeverity;
  category: ClarificationCategory;
  title: string;
  description: string;
  affectedEntities?: ClarificationAffectedEntities;
  requiredClarifications: ClarificationQuestion[];
  resolutionStatus: ClarificationResolutionStatus;
  contractHash: string;
  occurrenceCount: number;
  resolvedAt?: string;
  resolutionData?: Record<string, unknown>;
  integrityContext?: IntegrityContext;
}

export interface CreateClarificationRequest {
  projectId: string;
  originatingModule: ClarificationOriginModule;
  currentArtifactId: string;
  currentArtifactVersion: number;
  upstreamArtifactId: string;
  upstreamArtifactVersion: number;
  severity: ClarificationSeverity;
  category: ClarificationCategory;
  title: string;
  description: string;
  affectedEntities?: ClarificationAffectedEntities;
  requiredClarifications: ClarificationQuestion[];
}

export interface ResolveClarificationRequest {
  clarificationId: string;
  resolutionData: Record<string, unknown>;
}

export interface ClarificationDetectionResult {
  hasBlockers: boolean;
  contracts: CreateClarificationRequest[];
}
