import type {
  FailurePatternDefinition,
  PromptFeedbackResponse,
  KnownFailureResponse,
  UnknownFailureResponse,
  FeedbackInstructionType,
} from "@shared/types/prompts";
import {
  FAILURE_PATTERN_TAXONOMY,
  UNKNOWN_FAILURE_PATTERN,
} from "./failure-taxonomy";

export interface ClassificationResult {
  pattern: FailurePatternDefinition;
  instructionType: FeedbackInstructionType;
  response: PromptFeedbackResponse;
}

class ClassifierService {
  classifyFailure(rawOutput: string): ClassificationResult {
    const normalizedOutput = rawOutput.toLowerCase().trim();

    let bestMatch: FailurePatternDefinition | null = null;
    let bestScore = 0;

    for (const pattern of FAILURE_PATTERN_TAXONOMY) {
      const score = this.calculateMatchScore(normalizedOutput, pattern);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (bestMatch && bestScore >= 2) {
      return this.buildKnownResult(bestMatch);
    }

    return this.buildUnknownResult();
  }

  private calculateMatchScore(
    normalizedOutput: string,
    pattern: FailurePatternDefinition
  ): number {
    let score = 0;

    for (const hint of pattern.detectionHints) {
      if (hint.includes(".*") || hint.includes("\\d")) {
        try {
          const regex = new RegExp(hint, "i");
          if (regex.test(normalizedOutput)) {
            score += 2;
          }
        } catch {
          if (normalizedOutput.includes(hint.toLowerCase())) {
            score += 1;
          }
        }
      } else {
        if (normalizedOutput.includes(hint.toLowerCase())) {
          score += 1;
        }
      }
    }

    return score;
  }

  private buildKnownResult(pattern: FailurePatternDefinition): ClassificationResult {
    const instructionType: FeedbackInstructionType = pattern.retryAllowed
      ? "retry_step"
      : pattern.regenerateSuggested
      ? "regenerate_prompts"
      : "stop_execution";

    const response: KnownFailureResponse = {
      classification: "KNOWN_FAILURE",
      failurePatternName: pattern.name,
      whyThisOccurs: pattern.cause,
      recoverySteps: pattern.recoverySteps,
      instruction: "STOP. RETRY THIS STEP ONLY.",
      shouldRetry: pattern.retryAllowed,
    };

    return {
      pattern,
      instructionType,
      response,
    };
  }

  private buildUnknownResult(): ClassificationResult {
    const response: UnknownFailureResponse = {
      classification: "UNKNOWN_FAILURE",
      statement:
        "This failure is unclassified. The system cannot determine the cause from the provided output.",
      instruction: "STOP. DO NOT CONTINUE.",
      suggestRegeneration: false,
    };

    return {
      pattern: UNKNOWN_FAILURE_PATTERN,
      instructionType: "stop_execution",
      response,
    };
  }

  getPatternById(id: string): FailurePatternDefinition | null {
    if (id === "UNKNOWN_UNCLASSIFIED") {
      return UNKNOWN_FAILURE_PATTERN;
    }
    return FAILURE_PATTERN_TAXONOMY.find((p) => p.id === id) || null;
  }

  getAllPatterns(): FailurePatternDefinition[] {
    return [...FAILURE_PATTERN_TAXONOMY, UNKNOWN_FAILURE_PATTERN];
  }
}

export const classifierService = new ClassifierService();
