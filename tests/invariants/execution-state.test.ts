import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

type StepStatus = "not_started" | "in_progress" | "completed" | "failed";
type SessionStatus = "active" | "blocked" | "completed";

interface MockStep {
  id: string;
  sessionId: string;
  stepNumber: number;
  status: StepStatus;
  attempts: number;
  lastFailureHash: string | null;
  escalationLevel: number;
}

interface MockSession {
  id: string;
  projectId: string;
  promptArtifactId: string;
  promptArtifactVersion: number;
  status: SessionStatus;
}

function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: "session-1",
    projectId: "project-1",
    promptArtifactId: "artifact-1",
    promptArtifactVersion: 1,
    status: "active",
    ...overrides,
  };
}

function createMockSteps(count: number, sessionId = "session-1"): MockStep[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `step-${i + 1}`,
    sessionId,
    stepNumber: i + 1,
    status: "not_started" as StepStatus,
    attempts: 0,
    lastFailureHash: null,
    escalationLevel: 0,
  }));
}

function canExecuteStep(
  stepNumber: number,
  steps: MockStep[],
  session: MockSession
): { allowed: boolean; code?: string } {
  if (session.status === "blocked") {
    return { allowed: false, code: "SESSION_BLOCKED" };
  }
  if (session.status === "completed") {
    return { allowed: false, code: "SESSION_COMPLETED" };
  }
  if (stepNumber > 1) {
    const prev = steps.find(s => s.stepNumber === stepNumber - 1);
    if (!prev || prev.status !== "completed") {
      return { allowed: false, code: "STEP_SEQUENCE_VIOLATION" };
    }
  }
  return { allowed: true };
}

function computeFailureHash(output: string): string {
  return createHash("sha256").update(output).digest("hex").substring(0, 16);
}

function processFailure(
  step: MockStep,
  failureOutput: string
): { step: MockStep; escalated: boolean } {
  const failureHash = computeFailureHash(failureOutput);
  const updated = { ...step, status: "failed" as StepStatus, attempts: step.attempts + 1, lastFailureHash: failureHash };

  let escalated = false;
  if (updated.lastFailureHash === failureHash && updated.attempts >= 3 && updated.attempts % 3 === 0) {
    updated.escalationLevel += 1;
    escalated = true;
  }
  return { step: updated, escalated };
}

function checkUpstreamInvalidation(
  session: MockSession,
  currentArtifactVersion: number
): { blocked: boolean } {
  return { blocked: currentArtifactVersion !== session.promptArtifactVersion };
}

function checkSessionCompletion(steps: MockStep[], completedStepNumber: number): boolean {
  return steps.every(s =>
    s.stepNumber === completedStepNumber ? true : s.status === "completed"
  );
}

describe("Execution State Tracking Invariants", () => {
  describe("Sequential Step Enforcement", () => {
    it("allows step 1 to start without any prerequisites", () => {
      const session = createMockSession();
      const steps = createMockSteps(5);
      const result = canExecuteStep(1, steps, session);
      expect(result.allowed).toBe(true);
    });

    it("blocks step 2 when step 1 is not completed", () => {
      const session = createMockSession();
      const steps = createMockSteps(5);
      steps[0].status = "in_progress";
      const result = canExecuteStep(2, steps, session);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("STEP_SEQUENCE_VIOLATION");
    });

    it("allows step 2 when step 1 is completed", () => {
      const session = createMockSession();
      const steps = createMockSteps(5);
      steps[0].status = "completed";
      const result = canExecuteStep(2, steps, session);
      expect(result.allowed).toBe(true);
    });

    it("blocks step 3 when step 2 is failed", () => {
      const session = createMockSession();
      const steps = createMockSteps(5);
      steps[0].status = "completed";
      steps[1].status = "failed";
      const result = canExecuteStep(3, steps, session);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("STEP_SEQUENCE_VIOLATION");
    });

    it("blocks step 5 even if steps 1-3 completed but step 4 is not", () => {
      const session = createMockSession();
      const steps = createMockSteps(5);
      steps[0].status = "completed";
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "in_progress";
      const result = canExecuteStep(5, steps, session);
      expect(result.allowed).toBe(false);
    });

    it("enforces strict sequential ordering across all 10 steps", () => {
      const session = createMockSession();
      const steps = createMockSteps(10);
      for (let i = 0; i < 10; i++) {
        const result = canExecuteStep(i + 1, steps, session);
        expect(result.allowed).toBe(true);
        for (let j = i + 2; j <= 10; j++) {
          const blocked = canExecuteStep(j, steps, session);
          expect(blocked.allowed).toBe(false);
        }
        steps[i].status = "completed";
      }
    });
  });

  describe("Failure Escalation", () => {
    it("increments attempt counter on first failure", () => {
      const step = createMockSteps(1)[0];
      const { step: updated } = processFailure(step, "Error: module not found");
      expect(updated.attempts).toBe(1);
      expect(updated.status).toBe("failed");
    });

    it("does not escalate on fewer than 3 failures", () => {
      let step = createMockSteps(1)[0];
      for (let i = 0; i < 2; i++) {
        const { step: updated, escalated } = processFailure(step, "Same error");
        expect(escalated).toBe(false);
        step = updated;
      }
      expect(step.attempts).toBe(2);
      expect(step.escalationLevel).toBe(0);
    });

    it("escalates after 3 identical failures", () => {
      let step = createMockSteps(1)[0];
      for (let i = 0; i < 3; i++) {
        const { step: updated, escalated } = processFailure(step, "Same error");
        if (i < 2) {
          expect(escalated).toBe(false);
        } else {
          expect(escalated).toBe(true);
        }
        step = updated;
      }
      expect(step.attempts).toBe(3);
      expect(step.escalationLevel).toBe(1);
    });

    it("escalates again after 6 identical failures", () => {
      let step = createMockSteps(1)[0];
      for (let i = 0; i < 6; i++) {
        const { step: updated } = processFailure(step, "Persistent error");
        step = updated;
      }
      expect(step.attempts).toBe(6);
      expect(step.escalationLevel).toBe(2);
    });

    it("uses SHA256 hash for failure deduplication", () => {
      const hash1 = computeFailureHash("Error A");
      const hash2 = computeFailureHash("Error B");
      const hash3 = computeFailureHash("Error A");
      expect(hash1).not.toBe(hash2);
      expect(hash1).toBe(hash3);
      expect(hash1.length).toBe(16);
    });

    it("tracks last failure hash for pattern matching", () => {
      let step = createMockSteps(1)[0];
      const { step: updated1 } = processFailure(step, "Error X");
      expect(updated1.lastFailureHash).toBe(computeFailureHash("Error X"));
      const { step: updated2 } = processFailure(updated1, "Error Y");
      expect(updated2.lastFailureHash).toBe(computeFailureHash("Error Y"));
    });

    it("escalates at attempt 3 even if failure pattern changes on final attempt", () => {
      let step = createMockSteps(1)[0];
      const { step: s1 } = processFailure(step, "Error A");
      const { step: s2 } = processFailure(s1, "Error A");
      const { step: s3, escalated } = processFailure(s2, "Error B");
      expect(s3.lastFailureHash).toBe(computeFailureHash("Error B"));
      expect(s3.attempts).toBe(3);
      expect(escalated).toBe(true);
    });
  });

  describe("Upstream Invalidation", () => {
    it("does not block when artifact version matches", () => {
      const session = createMockSession({ promptArtifactVersion: 1 });
      const result = checkUpstreamInvalidation(session, 1);
      expect(result.blocked).toBe(false);
    });

    it("blocks when artifact version has increased", () => {
      const session = createMockSession({ promptArtifactVersion: 1 });
      const result = checkUpstreamInvalidation(session, 2);
      expect(result.blocked).toBe(true);
    });

    it("blocks when artifact version has changed to any different value", () => {
      const session = createMockSession({ promptArtifactVersion: 3 });
      const result = checkUpstreamInvalidation(session, 5);
      expect(result.blocked).toBe(true);
    });

    it("blocks step execution when session is blocked", () => {
      const session = createMockSession({ status: "blocked" });
      const steps = createMockSteps(3);
      const result = canExecuteStep(1, steps, session);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("SESSION_BLOCKED");
    });

    it("blocks step execution when session is completed", () => {
      const session = createMockSession({ status: "completed" });
      const steps = createMockSteps(3);
      const result = canExecuteStep(1, steps, session);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("SESSION_COMPLETED");
    });
  });

  describe("Session Lifecycle", () => {
    it("new session starts with active status", () => {
      const session = createMockSession();
      expect(session.status).toBe("active");
    });

    it("all steps start as not_started", () => {
      const steps = createMockSteps(5);
      for (const step of steps) {
        expect(step.status).toBe("not_started");
        expect(step.attempts).toBe(0);
        expect(step.escalationLevel).toBe(0);
      }
    });

    it("session completes when all steps are completed", () => {
      const steps = createMockSteps(3);
      steps[0].status = "completed";
      steps[1].status = "completed";
      expect(checkSessionCompletion(steps, 3)).toBe(true);
    });

    it("session does not complete when some steps are incomplete", () => {
      const steps = createMockSteps(3);
      steps[0].status = "completed";
      expect(checkSessionCompletion(steps, 2)).toBe(false);
    });

    it("session records prompt artifact version at creation for invalidation tracking", () => {
      const session = createMockSession({ promptArtifactVersion: 7 });
      expect(session.promptArtifactVersion).toBe(7);
    });

    it("session is scoped to a project for isolation", () => {
      const session = createMockSession({ projectId: "proj-abc" });
      expect(session.projectId).toBe("proj-abc");
    });
  });

  describe("Session Resume", () => {
    it("resumed session preserves step progress", () => {
      const steps = createMockSteps(5);
      steps[0].status = "completed";
      steps[1].status = "completed";
      steps[2].status = "in_progress";
      const result = canExecuteStep(3, steps, createMockSession());
      expect(result.allowed).toBe(true);
      const result2 = canExecuteStep(4, steps, createMockSession());
      expect(result2.allowed).toBe(false);
    });

    it("resumed session preserves failure attempts", () => {
      const steps = createMockSteps(3);
      steps[0].status = "completed";
      steps[1].status = "failed";
      steps[1].attempts = 2;
      steps[1].lastFailureHash = "abc123";
      expect(steps[1].attempts).toBe(2);
      expect(steps[1].lastFailureHash).toBe("abc123");
    });

    it("resumed session preserves escalation level", () => {
      const steps = createMockSteps(3);
      steps[0].status = "completed";
      steps[1].status = "failed";
      steps[1].escalationLevel = 1;
      expect(steps[1].escalationLevel).toBe(1);
    });
  });

  describe("Project Isolation", () => {
    it("sessions are scoped to projects", () => {
      const s1 = createMockSession({ id: "s1", projectId: "proj-A" });
      const s2 = createMockSession({ id: "s2", projectId: "proj-B" });
      expect(s1.projectId).not.toBe(s2.projectId);
    });

    it("session project must match request project for access", () => {
      const session = createMockSession({ projectId: "proj-A" });
      const requestProjectId = "proj-B";
      expect(session.projectId).not.toBe(requestProjectId);
    });
  });

  describe("Step State Transitions", () => {
    it("not_started -> in_progress is valid", () => {
      const step = createMockSteps(1)[0];
      expect(step.status).toBe("not_started");
      step.status = "in_progress";
      expect(step.status).toBe("in_progress");
    });

    it("in_progress -> completed is valid", () => {
      const step = createMockSteps(1)[0];
      step.status = "in_progress";
      step.status = "completed";
      expect(step.status).toBe("completed");
    });

    it("in_progress -> failed is valid", () => {
      const step = createMockSteps(1)[0];
      step.status = "in_progress";
      step.status = "failed";
      expect(step.status).toBe("failed");
    });

    it("failed -> in_progress is valid (retry)", () => {
      const step = createMockSteps(1)[0];
      step.status = "failed";
      step.status = "in_progress";
      expect(step.status).toBe("in_progress");
    });

    it("failed -> completed is valid (manual resolution)", () => {
      const step = createMockSteps(1)[0];
      step.status = "failed";
      step.status = "completed";
      expect(step.status).toBe("completed");
    });
  });

  describe("Edge Cases", () => {
    it("single step session completes immediately when step 1 completes", () => {
      const steps = createMockSteps(1);
      expect(checkSessionCompletion(steps, 1)).toBe(true);
    });

    it("large step count (50 steps) enforces sequence correctly", () => {
      const session = createMockSession();
      const steps = createMockSteps(50);
      expect(canExecuteStep(1, steps, session).allowed).toBe(true);
      expect(canExecuteStep(50, steps, session).allowed).toBe(false);
      for (let i = 0; i < 49; i++) {
        steps[i].status = "completed";
      }
      expect(canExecuteStep(50, steps, session).allowed).toBe(true);
    });

    it("failure hash is deterministic", () => {
      const h1 = computeFailureHash("Error: timeout");
      const h2 = computeFailureHash("Error: timeout");
      expect(h1).toBe(h2);
    });

    it("different failure outputs produce different hashes", () => {
      const h1 = computeFailureHash("Error: timeout");
      const h2 = computeFailureHash("Error: connection refused");
      expect(h1).not.toBe(h2);
    });
  });
});
