/**
 * Pipeline Stage Definitions
 * 
 * The platform follows a linear, artifact-driven pipeline:
 * Idea → Requirements → Build Prompts
 * 
 * Each stage represents a milestone in the development process.
 * Users must complete each stage before proceeding to the next.
 */

export type PipelineStage = 
  | "DRAFT_IDEA"           // Idea submitted but not yet analyzed
  | "VALIDATED_IDEA"       // Idea analyzed by AI consensus
  | "LOCKED_REQUIREMENTS"  // Requirements generated and finalized
  | "PROMPTS_GENERATED";   // Build prompts created

export interface PipelineStageInfo {
  stage: PipelineStage;
  label: string;
  description: string;
  nextStage: PipelineStage | null;
  previousStage: PipelineStage | null;
  allowedActions: string[];
}

export const PIPELINE_STAGES: Record<PipelineStage, PipelineStageInfo> = {
  DRAFT_IDEA: {
    stage: "DRAFT_IDEA",
    label: "Draft Idea",
    description: "Your idea is ready to be validated by AI analysis",
    nextStage: "VALIDATED_IDEA",
    previousStage: null,
    allowedActions: ["analyze", "edit", "delete"]
  },
  VALIDATED_IDEA: {
    stage: "VALIDATED_IDEA",
    label: "Validated Idea",
    description: "Your idea has been analyzed. Ready to generate requirements.",
    nextStage: "LOCKED_REQUIREMENTS",
    previousStage: "DRAFT_IDEA",
    allowedActions: ["generate_requirements", "view", "re-analyze"]
  },
  LOCKED_REQUIREMENTS: {
    stage: "LOCKED_REQUIREMENTS",
    label: "Requirements Ready",
    description: "Requirements are finalized. Ready to generate build prompts.",
    nextStage: "PROMPTS_GENERATED",
    previousStage: "VALIDATED_IDEA",
    allowedActions: ["generate_prompts", "view", "regenerate"]
  },
  PROMPTS_GENERATED: {
    stage: "PROMPTS_GENERATED",
    label: "Prompts Ready",
    description: "Build prompts are ready. Copy them to your IDE to start building.",
    nextStage: null,
    previousStage: "LOCKED_REQUIREMENTS",
    allowedActions: ["copy", "view", "regenerate", "download"]
  }
};

export function getStageInfo(stage: PipelineStage): PipelineStageInfo {
  return PIPELINE_STAGES[stage];
}

export function canTransitionTo(current: PipelineStage, target: PipelineStage): boolean {
  const currentInfo = PIPELINE_STAGES[current];
  return currentInfo.nextStage === target;
}

export function getStageOrder(stage: PipelineStage): number {
  const order: Record<PipelineStage, number> = {
    DRAFT_IDEA: 0,
    VALIDATED_IDEA: 1,
    LOCKED_REQUIREMENTS: 2,
    PROMPTS_GENERATED: 3
  };
  return order[stage];
}

export function isStageComplete(stage: PipelineStage, targetStage: PipelineStage): boolean {
  return getStageOrder(stage) >= getStageOrder(targetStage);
}

export interface PipelineArtifact {
  id: string;
  title: string;
  stage: PipelineStage;
  createdAt: string;
  updatedAt: string;
  childArtifactId?: string;
}
