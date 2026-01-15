import { describe, it, expect } from "vitest";
import {
  validateRequirementsGenerationStage,
  validatePromptGenerationStage,
  validateNotOutdated,
} from "../../server/validation/pipeline.validation";

describe("Pipeline Sequencing Invariants", () => {
  it("1.1 Requirements generation MUST require VALIDATED_IDEA stage", () => {
    const draftResult = validateRequirementsGenerationStage("DRAFT_IDEA");
    expect(draftResult.valid).toBe(false);
    expect(draftResult.error?.code).toBe("PIPELINE_VIOLATION");

    const validatedResult = validateRequirementsGenerationStage("VALIDATED_IDEA");
    expect(validatedResult.valid).toBe(true);

    const lockedResult = validateRequirementsGenerationStage("LOCKED_REQUIREMENTS");
    expect(lockedResult.valid).toBe(false);
  });

  it("1.2 Prompt generation MUST require LOCKED_REQUIREMENTS stage", () => {
    const draftResult = validatePromptGenerationStage("DRAFT_IDEA");
    expect(draftResult.valid).toBe(false);
    expect(draftResult.error?.code).toBe("PIPELINE_VIOLATION");

    const validatedResult = validatePromptGenerationStage("VALIDATED_IDEA");
    expect(validatedResult.valid).toBe(false);

    const lockedResult = validatePromptGenerationStage("LOCKED_REQUIREMENTS");
    expect(lockedResult.valid).toBe(true);
  });

  it("1.3 Prompt generation MUST be blocked when artifact is outdated", () => {
    const outdatedResult = validateNotOutdated(true, "Source has newer version");
    expect(outdatedResult.valid).toBe(false);
    expect(outdatedResult.error?.code).toBe("PIPELINE_VIOLATION");

    const currentResult = validateNotOutdated(false);
    expect(currentResult.valid).toBe(true);
  });

  it("1.4 Backend MUST reject out-of-sequence API calls regardless of frontend", () => {
    const frontendBypassAttempt = validatePromptGenerationStage("DRAFT_IDEA");
    expect(frontendBypassAttempt.valid).toBe(false);
    expect(frontendBypassAttempt.error?.code).toBe("PIPELINE_VIOLATION");

    const frontendBypassAttempt2 = validateRequirementsGenerationStage(undefined);
    expect(frontendBypassAttempt2.valid).toBe(false);
    expect(frontendBypassAttempt2.error?.hint).toContain("metadata missing");
  });
});
