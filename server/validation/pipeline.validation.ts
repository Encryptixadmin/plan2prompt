export type PipelineStage = "DRAFT_IDEA" | "VALIDATED_IDEA" | "LOCKED_REQUIREMENTS" | "PROMPTS_GENERATED";

const STAGE_ORDER: Record<PipelineStage, number> = {
  "DRAFT_IDEA": 0,
  "VALIDATED_IDEA": 1,
  "LOCKED_REQUIREMENTS": 2,
  "PROMPTS_GENERATED": 3,
};

export interface StageValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
    hint?: string;
  };
}

export function validateRequirementsGenerationStage(currentStage: string | undefined): StageValidationResult {
  if (currentStage !== "VALIDATED_IDEA") {
    return {
      valid: false,
      error: {
        code: "PIPELINE_VIOLATION",
        message: "Requirements can only be generated from validated ideas.",
        hint: currentStage
          ? `Current stage: ${currentStage}. Complete idea validation first.`
          : "Stage metadata missing.",
      },
    };
  }
  return { valid: true };
}

export function validatePromptGenerationStage(currentStage: string | undefined): StageValidationResult {
  if (currentStage !== "LOCKED_REQUIREMENTS") {
    return {
      valid: false,
      error: {
        code: "PIPELINE_VIOLATION",
        message: "Build prompts require locked, up-to-date requirements.",
        hint: currentStage
          ? `Current stage: ${currentStage}. Complete the Requirements Module first.`
          : "Stage metadata missing.",
      },
    };
  }
  return { valid: true };
}

export function validateNotOutdated(isOutdated: boolean, reason?: string): StageValidationResult {
  if (isOutdated) {
    return {
      valid: false,
      error: {
        code: "PIPELINE_VIOLATION",
        message: "Build prompts require locked, up-to-date requirements.",
        hint: reason || "Source artifact has been updated.",
      },
    };
  }
  return { valid: true };
}
