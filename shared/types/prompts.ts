/**
 * Prompt Module Type Definitions
 * 
 * Types for generating sequential, IDE-specific build prompts.
 */

// Supported IDE types
export type IDEType = "replit" | "cursor" | "lovable" | "antigravity" | "warp" | "other";

// IDE metadata
export interface IDEInfo {
  id: IDEType;
  name: string;
  description: string;
  features: string[];
  limitations: string[];
}

// Prerequisite check for a prompt step
export interface PromptPrerequisite {
  stepNumber: number;
  description: string;
  verificationCheck: string;
}

// Failure recovery branch
export interface FailureRecoveryBranch {
  symptom: string;
  likelyCause: string;
  recoveryAction: string;
  shouldRetry: boolean;
}

// Verification checkpoint
export interface VerificationCheckpoint {
  whatToVerify: string;
  successCriteria: string;
  whenToStop: string;
}

// Integrity level for execution safety
export type IntegrityLevel = "safe" | "caution" | "critical";

// Single build prompt
export interface BuildPrompt {
  step: number;
  title: string;
  objective: string;
  prompt: string;
  expectedOutcome: string;
  waitInstruction: string;
  requirementsCovered: string[];
  dependencies: number[];
  estimatedTime?: string;
  tags?: string[];
  prerequisites?: PromptPrerequisite[];
  verificationCheckpoint?: VerificationCheckpoint;
  failureRecovery?: FailureRecoveryBranch[];
  scopeGuardrails?: string[];
  stopConditions?: string[];
  ideConstraints?: string[];
  isIdempotent?: boolean;
  integrityLevel?: IntegrityLevel;
}

// Complete prompt document
export interface PromptDocument {
  id: string;
  requirementsArtifactId: string;
  ideaTitle: string;
  ide: IDEType;
  ideName: string;
  prompts: BuildPrompt[];
  summary: string;
  totalSteps: number;
  estimatedTotalTime: string;
  createdAt: string;
  artifactId?: string;
  sourceArtifactVersion?: number;
}

// Prompt generation request
export interface GeneratePromptsRequest {
  requirementsArtifactId: string;
  ide: IDEType;
}

// Prompt generation response
export interface GeneratePromptsResponse {
  prompts: PromptDocument;
  artifactPath: string;
}

// === FEEDBACK LOOP TYPES ===

// Failure Category Taxonomy (fixed enum - do not extend without governance)
export type FailureCategory =
  | "environment"
  | "dependency"
  | "configuration"
  | "syntax"
  | "runtime"
  | "tooling"
  | "permission"
  | "network"
  | "unknown";

// Scope of failure pattern applicability
export type FailureScope = "single_step" | "multiple_steps" | "environment_wide";

// Instruction type for feedback events
export type FeedbackInstructionType = "retry_step" | "stop_execution" | "regenerate_prompts";

// Structured Failure Pattern (known failure definition)
export interface FailurePatternDefinition {
  id: string;
  category: FailureCategory;
  name: string;
  detectionHints: string[]; // string contains or regex patterns
  cause: string;
  recoverySteps: string[];
  retryAllowed: boolean;
  regenerateSuggested: boolean;
  appliesTo: FailureScope;
}

// Prompt Feedback Event (write-once metrics log)
export interface PromptFeedbackEvent {
  id: string;
  timestamp: string;
  // Context
  userId: string;
  projectId: string;
  promptArtifactId: string;
  promptStepNumber: number;
  ide: IDEType;
  // Classification
  classification: "known_failure" | "unknown_failure";
  failurePatternId?: string;
  // Outcome
  instructionType: FeedbackInstructionType;
  // Meta (no raw output stored)
  rawOutputHash: string;
}

// Feedback request from user
export interface PromptFeedbackRequest {
  promptDocumentId: string;
  stepNumber: number;
  ide: IDEType;
  rawIdeOutput: string;
}

// Classification result
export type FeedbackClassification = "KNOWN_FAILURE" | "UNKNOWN_FAILURE";

// Known failure response
export interface KnownFailureResponse {
  classification: "KNOWN_FAILURE";
  failurePatternName: string;
  whyThisOccurs: string;
  recoverySteps: string[];
  instruction: "STOP. RETRY THIS STEP ONLY.";
  shouldRetry: boolean;
}

// Unknown failure response
export interface UnknownFailureResponse {
  classification: "UNKNOWN_FAILURE";
  statement: "This failure is unclassified. The system cannot determine the cause from the provided output.";
  instruction: "STOP. DO NOT CONTINUE.";
  suggestRegeneration: boolean;
  regenerationNote?: string;
}

// Combined response type
export type PromptFeedbackResponse = KnownFailureResponse | UnknownFailureResponse;

// Feedback audit log entry (transient, not stored long-term)
export interface FeedbackAuditEntry {
  id: string;
  timestamp: string;
  promptDocumentId: string;
  stepNumber: number;
  ide: IDEType;
  classification: FeedbackClassification;
  failurePatternName?: string;
}

// IDE options for UI
export const IDE_OPTIONS: IDEInfo[] = [
  {
    id: "replit",
    name: "Replit",
    description: "Browser-based IDE with AI assistance",
    features: ["AI Agent", "Instant deployment", "Collaborative editing", "Built-in database"],
    limitations: ["Some system-level access restricted"],
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-first code editor built on VS Code",
    features: ["AI code completion", "Chat with codebase", "Multi-file editing", "Local development"],
    limitations: ["Requires local environment setup"],
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "AI-powered app builder for rapid prototyping",
    features: ["Visual UI generation", "Fast iteration", "Component library", "Deployment"],
    limitations: ["Best for frontend-focused apps"],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    description: "AI development platform",
    features: ["Natural language coding", "Rapid prototyping", "Full-stack support"],
    limitations: ["Newer platform with evolving features"],
  },
  {
    id: "warp",
    name: "Warp",
    description: "Modern terminal with AI capabilities",
    features: ["AI command assistance", "Blocks workflow", "Team collaboration"],
    limitations: ["Terminal-focused, pair with code editor"],
  },
  {
    id: "other",
    name: "Other / Generic",
    description: "Generic prompts for any AI-assisted IDE",
    features: ["Universal instructions", "Adaptable format"],
    limitations: ["May need adjustment for specific IDE"],
  },
];
