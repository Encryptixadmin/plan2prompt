import { describe, it, expect } from "vitest";
import { classifierService } from "../../server/services/classifier.service";

describe("Failure Classification Determinism Invariants", () => {
  it("4.1 Same raw output MUST always produce identical failurePatternId", () => {
    const knownOutput = "npm ERR! ERESOLVE could not resolve dependency conflict";
    const dbOutput = "Error: ECONNREFUSED connection refused to database";

    const r1 = classifierService.classifyFailure(knownOutput);
    const r2 = classifierService.classifyFailure(knownOutput);
    const r3 = classifierService.classifyFailure(dbOutput);
    const r4 = classifierService.classifyFailure(dbOutput);

    expect(r1.pattern.id).toBe(r2.pattern.id);
    expect(r3.pattern.id).toBe(r4.pattern.id);
    expect(r1.response.classification).toBe(r2.response.classification);
  });

  it("4.2 Unmatched output MUST always classify as UNKNOWN_UNCLASSIFIED", () => {
    const unknownOutput = "xyz123 completely random error that matches nothing abc789";

    const result = classifierService.classifyFailure(unknownOutput);

    expect(result.pattern.id).toBe("UNKNOWN_UNCLASSIFIED");
    expect(result.pattern.category).toBe("unknown");
    expect(result.response.classification).toBe("UNKNOWN_FAILURE");
  });
});
