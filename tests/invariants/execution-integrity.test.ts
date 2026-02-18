import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

type StepStatus = "not_started" | "in_progress" | "completed" | "failed";
type IntegrityLevel = "safe" | "caution" | "critical";

interface MockIntegrityStep {
  id: string;
  sessionId: string;
  stepNumber: number;
  status: StepStatus;
  attempts: number;
  lastFailureHash: string | null;
  escalationLevel: number;
  reexecutionCount: number;
  successHash: string | null;
  integrityOverrideConfirmed: "true" | "false";
  duplicateFailureDetected: "true" | "false";
}

interface PromptIntegrity {
  step: number;
  isIdempotent: boolean;
  integrityLevel: IntegrityLevel;
}

function createMockIntegrityStep(overrides: Partial<MockIntegrityStep> = {}): MockIntegrityStep {
  return {
    id: "step-1",
    sessionId: "session-1",
    stepNumber: 1,
    status: "not_started",
    attempts: 0,
    lastFailureHash: null,
    escalationLevel: 0,
    reexecutionCount: 0,
    successHash: null,
    integrityOverrideConfirmed: "false",
    duplicateFailureDetected: "false",
    ...overrides,
  };
}

function canRerunStep(
  step: MockIntegrityStep,
  prompt: PromptIntegrity,
  integrityOverride: boolean
): { allowed: boolean; reason?: string } {
  if (step.status !== "completed") {
    return { allowed: false, reason: "Step is not completed" };
  }

  if (prompt.isIdempotent) {
    return { allowed: true };
  }

  if (prompt.integrityLevel === "critical" && !integrityOverride) {
    return { allowed: false, reason: "INTEGRITY_RERUN_BLOCKED: critical non-idempotent step requires explicit confirmation" };
  }

  if (!prompt.isIdempotent && !integrityOverride) {
    return { allowed: false, reason: "INTEGRITY_RERUN_BLOCKED: non-idempotent step requires confirmation" };
  }

  return { allowed: true };
}

function computeFailureHash(output: string): string {
  return createHash("sha256")
    .update(output || "unknown")
    .digest("hex")
    .substring(0, 16);
}

function detectDuplicateFailure(
  step: MockIntegrityStep,
  newFailureHash: string
): boolean {
  return step.lastFailureHash === newFailureHash && step.attempts >= 1;
}

function shouldCreateClarification(
  step: MockIntegrityStep,
  isDuplicateFailure: boolean
): { create: boolean; severity: "advisory" | "blocker" } {
  if (!isDuplicateFailure) {
    return { create: false, severity: "advisory" };
  }
  const newAttempts = step.attempts + 1;
  return {
    create: true,
    severity: newAttempts >= 6 ? "blocker" : "advisory",
  };
}

function shouldEscalate(attempts: number): boolean {
  return attempts >= 3 && attempts % 3 === 0;
}

function shouldCreateBlockerAtEscalation(escalationLevel: number): boolean {
  return escalationLevel >= 2;
}

function computeSuccessHash(stepNumber: number, timestamp: number): string {
  return createHash("sha256")
    .update(`step-${stepNumber}-completed-${timestamp}`)
    .digest("hex")
    .substring(0, 16);
}

function assignIntegrityMetadata(title: string, prompt: string): { isIdempotent: boolean; integrityLevel: IntegrityLevel } {
  const combined = `${title.toLowerCase()} ${prompt.toLowerCase()}`;

  if (
    combined.includes("migration") ||
    combined.includes("schema") ||
    combined.includes("seed") ||
    combined.includes("database setup") ||
    combined.includes("data model")
  ) {
    return { isIdempotent: false, integrityLevel: "critical" };
  }

  if (
    combined.includes("scaffold") ||
    combined.includes("project setup") ||
    combined.includes("architecture") ||
    combined.includes("initialize") ||
    combined.includes("final integration") ||
    combined.includes("polish")
  ) {
    return { isIdempotent: true, integrityLevel: "safe" };
  }

  return { isIdempotent: false, integrityLevel: "caution" };
}

describe("Execution Integrity Controls", () => {
  describe("Integrity Metadata Assignment", () => {
    it("assigns critical + non-idempotent for migration steps", () => {
      const result = assignIntegrityMetadata("Database Migration", "Run the migration to create tables");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("critical");
    });

    it("assigns critical + non-idempotent for schema steps", () => {
      const result = assignIntegrityMetadata("Schema Setup", "Create the database schema");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("critical");
    });

    it("assigns critical + non-idempotent for seed data steps", () => {
      const result = assignIntegrityMetadata("Data Setup", "Seed the database with initial data");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("critical");
    });

    it("assigns critical + non-idempotent for data model steps", () => {
      const result = assignIntegrityMetadata("Data Model Implementation", "Create entities and relationships");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("critical");
    });

    it("assigns safe + idempotent for architecture steps", () => {
      const result = assignIntegrityMetadata("Project Architecture", "Set up the project structure");
      expect(result.isIdempotent).toBe(true);
      expect(result.integrityLevel).toBe("safe");
    });

    it("assigns safe + idempotent for scaffold steps", () => {
      const result = assignIntegrityMetadata("Scaffold Components", "Create the initial scaffold");
      expect(result.isIdempotent).toBe(true);
      expect(result.integrityLevel).toBe("safe");
    });

    it("assigns safe + idempotent for final integration steps", () => {
      const result = assignIntegrityMetadata("Final Integration & Polish", "Complete final integration and polish");
      expect(result.isIdempotent).toBe(true);
      expect(result.integrityLevel).toBe("safe");
    });

    it("assigns caution + non-idempotent for API steps", () => {
      const result = assignIntegrityMetadata("API Endpoints", "Implement REST endpoints for users");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("caution");
    });

    it("assigns caution + non-idempotent for UI steps", () => {
      const result = assignIntegrityMetadata("User Interface", "Build the dashboard UI");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("caution");
    });

    it("assigns caution for security steps", () => {
      const result = assignIntegrityMetadata("Security Hardening", "Implement authentication and authorization");
      expect(result.isIdempotent).toBe(false);
      expect(result.integrityLevel).toBe("caution");
    });
  });

  describe("Re-run Controls", () => {
    it("allows re-run for idempotent safe steps without confirmation", () => {
      const step = createMockIntegrityStep({ status: "completed" });
      const prompt: PromptIntegrity = { step: 1, isIdempotent: true, integrityLevel: "safe" };
      const result = canRerunStep(step, prompt, false);
      expect(result.allowed).toBe(true);
    });

    it("blocks re-run for non-idempotent caution steps without override", () => {
      const step = createMockIntegrityStep({ status: "completed" });
      const prompt: PromptIntegrity = { step: 1, isIdempotent: false, integrityLevel: "caution" };
      const result = canRerunStep(step, prompt, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("INTEGRITY_RERUN_BLOCKED");
    });

    it("allows re-run for non-idempotent steps with override", () => {
      const step = createMockIntegrityStep({ status: "completed" });
      const prompt: PromptIntegrity = { step: 1, isIdempotent: false, integrityLevel: "caution" };
      const result = canRerunStep(step, prompt, true);
      expect(result.allowed).toBe(true);
    });

    it("blocks re-run for critical non-idempotent steps without override", () => {
      const step = createMockIntegrityStep({ status: "completed" });
      const prompt: PromptIntegrity = { step: 1, isIdempotent: false, integrityLevel: "critical" };
      const result = canRerunStep(step, prompt, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("critical");
    });

    it("allows re-run for critical steps with explicit override", () => {
      const step = createMockIntegrityStep({ status: "completed" });
      const prompt: PromptIntegrity = { step: 1, isIdempotent: false, integrityLevel: "critical" };
      const result = canRerunStep(step, prompt, true);
      expect(result.allowed).toBe(true);
    });

    it("rejects re-run for non-completed steps", () => {
      const step = createMockIntegrityStep({ status: "in_progress" });
      const prompt: PromptIntegrity = { step: 1, isIdempotent: true, integrityLevel: "safe" };
      const result = canRerunStep(step, prompt, false);
      expect(result.allowed).toBe(false);
    });

    it("tracks reexecution count incrementally", () => {
      const step = createMockIntegrityStep({ reexecutionCount: 0 });
      step.reexecutionCount++;
      expect(step.reexecutionCount).toBe(1);
      step.reexecutionCount++;
      expect(step.reexecutionCount).toBe(2);
    });
  });

  describe("Success Hash Memory", () => {
    it("generates deterministic success hash for same inputs", () => {
      const h1 = computeSuccessHash(1, 1000000);
      const h2 = computeSuccessHash(1, 1000000);
      expect(h1).toBe(h2);
    });

    it("generates different hashes for different steps", () => {
      const h1 = computeSuccessHash(1, 1000000);
      const h2 = computeSuccessHash(2, 1000000);
      expect(h1).not.toBe(h2);
    });

    it("generates different hashes for different timestamps", () => {
      const h1 = computeSuccessHash(1, 1000000);
      const h2 = computeSuccessHash(1, 2000000);
      expect(h1).not.toBe(h2);
    });

    it("success hash is 16 characters", () => {
      const hash = computeSuccessHash(1, Date.now());
      expect(hash).toHaveLength(16);
    });

    it("success hash is stored on completed step", () => {
      const step = createMockIntegrityStep({ status: "completed" });
      const hash = computeSuccessHash(step.stepNumber, Date.now());
      step.successHash = hash;
      expect(step.successHash).toBe(hash);
      expect(step.successHash).toHaveLength(16);
    });
  });

  describe("Duplicate Failure Detection", () => {
    it("detects duplicate failure when hash matches previous", () => {
      const step = createMockIntegrityStep({
        attempts: 1,
        lastFailureHash: "abc123",
      });
      expect(detectDuplicateFailure(step, "abc123")).toBe(true);
    });

    it("does not detect duplicate for different hash", () => {
      const step = createMockIntegrityStep({
        attempts: 1,
        lastFailureHash: "abc123",
      });
      expect(detectDuplicateFailure(step, "def456")).toBe(false);
    });

    it("does not detect duplicate on first failure", () => {
      const step = createMockIntegrityStep({
        attempts: 0,
        lastFailureHash: null,
      });
      expect(detectDuplicateFailure(step, "abc123")).toBe(false);
    });

    it("creates advisory clarification on duplicate failure", () => {
      const step = createMockIntegrityStep({ attempts: 2 });
      const result = shouldCreateClarification(step, true);
      expect(result.create).toBe(true);
      expect(result.severity).toBe("advisory");
    });

    it("creates blocker clarification after 6+ attempts with duplicate", () => {
      const step = createMockIntegrityStep({ attempts: 5 });
      const result = shouldCreateClarification(step, true);
      expect(result.create).toBe(true);
      expect(result.severity).toBe("blocker");
    });

    it("does not create clarification without duplicate", () => {
      const step = createMockIntegrityStep({ attempts: 5 });
      const result = shouldCreateClarification(step, false);
      expect(result.create).toBe(false);
    });

    it("advisory threshold is below 6 attempts", () => {
      for (let i = 1; i < 5; i++) {
        const step = createMockIntegrityStep({ attempts: i });
        const result = shouldCreateClarification(step, true);
        expect(result.severity).toBe("advisory");
      }
    });

    it("blocker threshold is at 6+ attempts", () => {
      for (let i = 5; i < 10; i++) {
        const step = createMockIntegrityStep({ attempts: i });
        const result = shouldCreateClarification(step, true);
        expect(result.severity).toBe("blocker");
      }
    });
  });

  describe("Escalation Safety", () => {
    it("escalates at 3 cumulative failures", () => {
      expect(shouldEscalate(3)).toBe(true);
    });

    it("escalates at 6 cumulative failures", () => {
      expect(shouldEscalate(6)).toBe(true);
    });

    it("does not escalate at 1, 2, 4, 5 failures", () => {
      expect(shouldEscalate(1)).toBe(false);
      expect(shouldEscalate(2)).toBe(false);
      expect(shouldEscalate(4)).toBe(false);
      expect(shouldEscalate(5)).toBe(false);
    });

    it("creates blocker clarification at escalation level 2", () => {
      expect(shouldCreateBlockerAtEscalation(2)).toBe(true);
    });

    it("creates blocker clarification at escalation level 3", () => {
      expect(shouldCreateBlockerAtEscalation(3)).toBe(true);
    });

    it("does not create blocker at escalation level 1", () => {
      expect(shouldCreateBlockerAtEscalation(1)).toBe(false);
    });

    it("does not create blocker at escalation level 0", () => {
      expect(shouldCreateBlockerAtEscalation(0)).toBe(false);
    });
  });

  describe("Integrity Override Tracking", () => {
    it("defaults to no override", () => {
      const step = createMockIntegrityStep();
      expect(step.integrityOverrideConfirmed).toBe("false");
    });

    it("records override when confirmed", () => {
      const step = createMockIntegrityStep();
      step.integrityOverrideConfirmed = "true";
      expect(step.integrityOverrideConfirmed).toBe("true");
    });

    it("duplicate failure flag defaults to false", () => {
      const step = createMockIntegrityStep();
      expect(step.duplicateFailureDetected).toBe("false");
    });

    it("duplicate failure flag is set on detection", () => {
      const step = createMockIntegrityStep();
      step.duplicateFailureDetected = "true";
      expect(step.duplicateFailureDetected).toBe("true");
    });
  });

  describe("End-to-End Integrity Flow", () => {
    it("full lifecycle: assign → execute → complete → re-run with override", () => {
      const metadata = assignIntegrityMetadata("Data Model Setup", "Create database schema and run migration");
      expect(metadata.isIdempotent).toBe(false);
      expect(metadata.integrityLevel).toBe("critical");

      const step = createMockIntegrityStep({ status: "not_started" });
      step.status = "in_progress";
      step.status = "completed";
      const hash = computeSuccessHash(1, Date.now());
      step.successHash = hash;

      const rerunResult = canRerunStep(step, { step: 1, ...metadata }, false);
      expect(rerunResult.allowed).toBe(false);

      const overrideResult = canRerunStep(step, { step: 1, ...metadata }, true);
      expect(overrideResult.allowed).toBe(true);

      step.integrityOverrideConfirmed = "true";
      step.reexecutionCount++;
      expect(step.reexecutionCount).toBe(1);
    });

    it("full lifecycle: fail → duplicate → clarification → escalation → blocker", () => {
      const step = createMockIntegrityStep({ status: "in_progress" });
      const failureHash = computeFailureHash("Error: connection refused");

      step.lastFailureHash = failureHash;
      step.attempts = 1;
      step.status = "failed";

      const isDuplicate = detectDuplicateFailure(step, failureHash);
      expect(isDuplicate).toBe(true);
      step.attempts = 2;

      const clar1 = shouldCreateClarification(step, true);
      expect(clar1.create).toBe(true);
      expect(clar1.severity).toBe("advisory");

      step.attempts = 3;
      expect(shouldEscalate(step.attempts)).toBe(true);
      step.escalationLevel = 1;

      step.attempts = 6;
      expect(shouldEscalate(step.attempts)).toBe(true);
      step.escalationLevel = 2;

      expect(shouldCreateBlockerAtEscalation(step.escalationLevel)).toBe(true);
      const clar2 = shouldCreateClarification(step, true);
      expect(clar2.severity).toBe("blocker");
    });
  });
});
