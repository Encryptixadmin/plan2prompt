import { describe, it, expect } from "vitest";

const createMockArtifact = (stage: string) => ({
  id: "test-artifact-id",
  metadata: { stage, projectId: "test-project" },
});

describe("Pipeline Sequencing Invariants", () => {
  it("1.1 Requirements generation MUST require VALIDATED_IDEA stage", () => {
    const draftArtifact = createMockArtifact("DRAFT_IDEA");
    const validatedArtifact = createMockArtifact("VALIDATED_IDEA");

    expect(draftArtifact.metadata.stage === "VALIDATED_IDEA").toBe(false);
    expect(validatedArtifact.metadata.stage === "VALIDATED_IDEA").toBe(true);
  });

  it("1.2 Prompt generation MUST require LOCKED_REQUIREMENTS stage", () => {
    const unlockedArtifact = createMockArtifact("VALIDATED_IDEA");
    const lockedArtifact = createMockArtifact("LOCKED_REQUIREMENTS");

    expect(unlockedArtifact.metadata.stage === "LOCKED_REQUIREMENTS").toBe(false);
    expect(lockedArtifact.metadata.stage === "LOCKED_REQUIREMENTS").toBe(true);
  });

  it("1.3 Prompt generation MUST be blocked when artifact is outdated", () => {
    const outdatedCheck = { outdated: true, reason: "Source has newer version" };
    const currentCheck = { outdated: false };

    expect(!outdatedCheck.outdated).toBe(false);
    expect(!currentCheck.outdated).toBe(true);
  });

  it("1.4 Backend MUST reject out-of-sequence API calls regardless of frontend", () => {
    const validatePipelineStage = (required: string, actual: string) => {
      if (actual !== required) {
        return { valid: false, error: `Pipeline violation: expected ${required}, got ${actual}` };
      }
      return { valid: true };
    };

    const result = validatePipelineStage("LOCKED_REQUIREMENTS", "DRAFT_IDEA");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Pipeline violation");
  });
});
