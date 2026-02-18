import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import type {
  ClarificationContract,
  CreateClarificationRequest,
  ClarificationCategory,
  ClarificationSeverity,
  ClarificationOriginModule,
  ClarificationQuestion,
  ClarificationDetectionResult,
} from "../../shared/types/clarification";
import type { RequirementsDocument } from "../../shared/types/requirements";
import type { PromptDocument, BuildPrompt } from "../../shared/types/prompts";
import { ClarificationService } from "../../server/services/clarification.service";
import { ClarificationDetectionService } from "../../server/services/clarification-detection.service";

const clarificationService = new ClarificationService();
const detectionService = new ClarificationDetectionService();

function computeHash(request: CreateClarificationRequest): string {
  return clarificationService.computeHash(request);
}

function createClarificationRequest(
  overrides: Partial<CreateClarificationRequest> = {}
): CreateClarificationRequest {
  return {
    projectId: "proj-1",
    originatingModule: "requirements",
    currentArtifactId: "req-artifact-1",
    currentArtifactVersion: 1,
    upstreamArtifactId: "idea-artifact-1",
    upstreamArtifactVersion: 1,
    severity: "advisory",
    category: "missing_information",
    title: "Test clarification",
    description: "Test description",
    requiredClarifications: [{
      field: "test_field",
      question: "Test question?",
      expectedAnswerType: "short_text",
    }],
    ...overrides,
  };
}

function createMinimalRequirementsDoc(
  overrides: Partial<RequirementsDocument> = {}
): RequirementsDocument {
  return {
    id: "test-req-1",
    ideaArtifactId: "test-idea-1",
    ideaTitle: "Test App",
    functionalRequirements: [],
    nonFunctionalRequirements: [],
    architecture: { pattern: "MVC", description: "Standard MVC", components: [], dataFlow: "" },
    dataModels: [],
    apiContracts: { baseUrl: "/api/v1", version: "1.0.0", authentication: "Bearer token", endpoints: [] },
    uiuxPrinciples: { designSystem: "Material", keyPrinciples: [], userFlows: [], accessibilityRequirements: [] },
    securityConsiderations: [],
    assumptions: [],
    outOfScope: [],
    edgeCasesAndFailureModes: [],
    confidenceNotes: [],
    summary: "Test summary",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMinimalPromptDoc(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return {
    id: "test-prompt-1",
    artifactId: "prompt-artifact-1",
    requirementsArtifactId: "req-artifact-1",
    ideaTitle: "Test App",
    ide: "replit",
    ideName: "Replit",
    totalSteps: 0,
    estimatedTotalTime: "1 hour",
    prompts: [],
    summary: "Test summary",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function detectRequirementsGaps(
  doc: RequirementsDocument,
  ideaArtifactId: string,
  projectId: string
): ClarificationDetectionResult {
  return detectionService.detectRequirementsGaps(doc, ideaArtifactId, projectId);
}

function detectPromptGaps(
  doc: PromptDocument,
  requirementsArtifactId: string,
  projectId: string
): ClarificationDetectionResult {
  return detectionService.detectPromptGaps(doc, requirementsArtifactId, projectId);
}

function detectExecutionEscalation(
  failureHash: string,
  occurrenceCount: number,
  stepNumber: number,
  promptArtifactId: string,
  projectId: string
): CreateClarificationRequest | null {
  return detectionService.detectExecutionEscalation(failureHash, occurrenceCount, stepNumber, promptArtifactId, projectId);
}

describe("Clarification Contract System", () => {

  describe("Hash Determinism", () => {
    it("should produce identical hashes for identical contracts", () => {
      const req1 = createClarificationRequest();
      const req2 = createClarificationRequest();
      expect(computeHash(req1)).toBe(computeHash(req2));
    });

    it("should produce different hashes for different titles", () => {
      const req1 = createClarificationRequest({ title: "Gap A" });
      const req2 = createClarificationRequest({ title: "Gap B" });
      expect(computeHash(req1)).not.toBe(computeHash(req2));
    });

    it("should produce different hashes for different categories", () => {
      const req1 = createClarificationRequest({ category: "missing_information" });
      const req2 = createClarificationRequest({ category: "architecture_gap" });
      expect(computeHash(req1)).not.toBe(computeHash(req2));
    });

    it("should produce different hashes for different modules", () => {
      const req1 = createClarificationRequest({ originatingModule: "requirements" });
      const req2 = createClarificationRequest({ originatingModule: "prompts" });
      expect(computeHash(req1)).not.toBe(computeHash(req2));
    });

    it("should produce different hashes for different upstream artifacts", () => {
      const req1 = createClarificationRequest({ upstreamArtifactId: "idea-1" });
      const req2 = createClarificationRequest({ upstreamArtifactId: "idea-2" });
      expect(computeHash(req1)).not.toBe(computeHash(req2));
    });

    it("should be 16 characters (truncated SHA256)", () => {
      const hash = computeHash(createClarificationRequest());
      expect(hash.length).toBe(16);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it("should not include severity in hash (severity changes don't create new contracts)", () => {
      const req1 = createClarificationRequest({ severity: "advisory" });
      const req2 = createClarificationRequest({ severity: "blocker" });
      expect(computeHash(req1)).toBe(computeHash(req2));
    });

    it("should not include description in hash (description updates don't create duplicates)", () => {
      const req1 = createClarificationRequest({ description: "Short" });
      const req2 = createClarificationRequest({ description: "Much longer description with details" });
      expect(computeHash(req1)).toBe(computeHash(req2));
    });
  });

  describe("Upward-Only Direction", () => {
    it("requirements clarifications target idea module (upstream)", () => {
      const req = createClarificationRequest({
        originatingModule: "requirements",
        currentArtifactId: "req-artifact-1",
        upstreamArtifactId: "idea-artifact-1",
      });
      expect(req.originatingModule).toBe("requirements");
      expect(req.upstreamArtifactId).not.toBe(req.currentArtifactId);
    });

    it("prompts clarifications target requirements module (upstream)", () => {
      const req = createClarificationRequest({
        originatingModule: "prompts",
        currentArtifactId: "prompt-artifact-1",
        upstreamArtifactId: "req-artifact-1",
      });
      expect(req.originatingModule).toBe("prompts");
      expect(req.upstreamArtifactId).not.toBe(req.currentArtifactId);
    });

    it("execution failures escalate to upstream artifact", () => {
      const result = detectExecutionEscalation("hash123", 3, 5, "prompt-1", "proj-1");
      expect(result).not.toBeNull();
      expect(result!.originatingModule).toBe("execution");
      expect(result!.severity).toBe("blocker");
    });
  });

  describe("Requirements Gap Detection", () => {
    it("should detect missing functional requirements as blocker", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "idea-1", "proj-1");
      expect(result.hasBlockers).toBe(true);
      const blocker = result.contracts.find(c => c.severity === "blocker");
      expect(blocker).toBeDefined();
      expect(blocker!.category).toBe("missing_information");
      expect(blocker!.title).toContain("functional requirements");
    });

    it("should NOT flag missing FRs when FRs exist", () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [{
          id: "FR-001",
          category: "Core",
          title: "User Login",
          description: "Users can log in",
          priority: "must-have",
          acceptanceCriteria: ["Login form works"],
        }],
      });
      const result = detectRequirementsGaps(doc, "idea-1", "proj-1");
      const missingFRs = result.contracts.find(c => c.title.includes("functional requirements"));
      expect(missingFRs).toBeUndefined();
    });

    it("should detect missing data model as advisory", () => {
      const doc = createMinimalRequirementsDoc({ dataModels: [] });
      const result = detectRequirementsGaps(doc, "idea-1", "proj-1");
      const dataGap = result.contracts.find(c => c.category === "data_model_gap");
      expect(dataGap).toBeDefined();
      expect(dataGap!.severity).toBe("advisory");
    });

    it("should detect multiple unmitigated risks (>=2) as scope conflict", () => {
      const doc = createMinimalRequirementsDoc();
      (doc as any).riskTraceability = [
        { riskId: "R1", riskDescription: "Tech risk", coverageStatus: "unmitigated", coveringRequirementIds: [] },
        { riskId: "R2", riskDescription: "Market risk", coverageStatus: "unmitigated", coveringRequirementIds: [] },
      ];
      const result = detectRequirementsGaps(doc, "idea-1", "proj-1");
      const scopeConflict = result.contracts.find(c => c.category === "scope_conflict");
      expect(scopeConflict).toBeDefined();
      expect(scopeConflict!.affectedEntities?.ideaRiskIds).toHaveLength(2);
    });

    it("should NOT flag scope conflict for 1 unmitigated risk", () => {
      const doc = createMinimalRequirementsDoc();
      (doc as any).riskTraceability = [
        { riskId: "R1", riskDescription: "Minor risk", coverageStatus: "unmitigated", coveringRequirementIds: [] },
      ];
      const result = detectRequirementsGaps(doc, "idea-1", "proj-1");
      const scopeConflict = result.contracts.find(c => c.category === "scope_conflict");
      expect(scopeConflict).toBeUndefined();
    });

    it("should set correct upstream artifact to idea", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "idea-artifact-42", "proj-1");
      result.contracts.forEach(c => {
        expect(c.upstreamArtifactId).toBe("idea-artifact-42");
        expect(c.originatingModule).toBe("requirements");
      });
    });
  });

  describe("Prompt Gap Detection", () => {
    it("should detect zero prompts as blocker", () => {
      const doc = createMinimalPromptDoc({ prompts: [] });
      const result = detectPromptGaps(doc, "req-1", "proj-1");
      expect(result.hasBlockers).toBe(true);
      expect(result.contracts).toHaveLength(1);
      expect(result.contracts[0].severity).toBe("blocker");
    });

    it("should detect missing database step as advisory", () => {
      const doc = createMinimalPromptDoc({
        prompts: [{
          step: 1,
          title: "Setup UI Framework",
          objective: "Setup UI",
          prompt: "Create React app",
          expectedOutcome: "App running",
          waitInstruction: "Wait",
          estimatedTime: "30 min",
          tags: ["frontend"],
          requirementsCovered: ["FR-001"],
        }] as BuildPrompt[],
      });
      const result = detectPromptGaps(doc, "req-1", "proj-1");
      const dbGap = result.contracts.find(c => c.category === "data_model_gap");
      expect(dbGap).toBeDefined();
      expect(dbGap!.severity).toBe("advisory");
    });

    it("should NOT flag database gap when database step exists", () => {
      const doc = createMinimalPromptDoc({
        prompts: [{
          step: 1,
          title: "Database Schema Setup",
          objective: "Setup DB",
          prompt: "Create database tables",
          expectedOutcome: "Tables created",
          waitInstruction: "Wait",
          estimatedTime: "30 min",
          tags: ["database"],
          requirementsCovered: [],
        }] as BuildPrompt[],
      });
      const result = detectPromptGaps(doc, "req-1", "proj-1");
      const dbGap = result.contracts.find(c => c.category === "data_model_gap");
      expect(dbGap).toBeUndefined();
    });

    it("should set correct upstream artifact to requirements", () => {
      const doc = createMinimalPromptDoc({ prompts: [] });
      const result = detectPromptGaps(doc, "req-artifact-99", "proj-1");
      result.contracts.forEach(c => {
        expect(c.upstreamArtifactId).toBe("req-artifact-99");
        expect(c.originatingModule).toBe("prompts");
      });
    });
  });

  describe("Execution Escalation", () => {
    it("should NOT escalate below 3 occurrences", () => {
      expect(detectExecutionEscalation("h1", 1, 3, "p1", "proj")).toBeNull();
      expect(detectExecutionEscalation("h1", 2, 3, "p1", "proj")).toBeNull();
    });

    it("should escalate at exactly 3 occurrences", () => {
      const result = detectExecutionEscalation("h1", 3, 5, "p1", "proj");
      expect(result).not.toBeNull();
      expect(result!.severity).toBe("blocker");
      expect(result!.category).toBe("execution_failure");
      expect(result!.originatingModule).toBe("execution");
    });

    it("should escalate above 3 occurrences", () => {
      const result = detectExecutionEscalation("h1", 10, 2, "p1", "proj");
      expect(result).not.toBeNull();
      expect(result!.severity).toBe("blocker");
    });

    it("should include step number in title and affected entities", () => {
      const result = detectExecutionEscalation("h1", 5, 7, "p1", "proj");
      expect(result!.title).toContain("step 7");
      expect(result!.affectedEntities?.promptStepIds).toContain("step-7");
    });

    it("should provide actionable resolution options", () => {
      const result = detectExecutionEscalation("h1", 3, 1, "p1", "proj");
      const q = result!.requiredClarifications[0];
      expect(q.expectedAnswerType).toBe("select");
      expect(q.options).toBeDefined();
      expect(q.options!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Contract Structure Invariants", () => {
    it("every contract must have at least one required clarification question", () => {
      const doc1 = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const reqResult = detectRequirementsGaps(doc1, "i1", "p1");
      reqResult.contracts.forEach(c => {
        expect(c.requiredClarifications.length).toBeGreaterThanOrEqual(1);
      });

      const doc2 = createMinimalPromptDoc({ prompts: [] });
      const promptResult = detectPromptGaps(doc2, "r1", "p1");
      promptResult.contracts.forEach(c => {
        expect(c.requiredClarifications.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("every question must have a field, question text, and answer type", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      result.contracts.forEach(c => {
        c.requiredClarifications.forEach(q => {
          expect(q.field).toBeTruthy();
          expect(q.question).toBeTruthy();
          expect(q.expectedAnswerType).toBeTruthy();
          expect(["short_text", "long_text", "select", "multi_select", "number", "boolean"]).toContain(q.expectedAnswerType);
        });
      });
    });

    it("select questions must have options", () => {
      const doc = createMinimalRequirementsDoc();
      (doc as any).riskTraceability = [
        { riskId: "R1", riskDescription: "A", coverageStatus: "unmitigated", coveringRequirementIds: [] },
        { riskId: "R2", riskDescription: "B", coverageStatus: "unmitigated", coveringRequirementIds: [] },
      ];
      const result = detectRequirementsGaps(doc, "i1", "p1");
      result.contracts.forEach(c => {
        c.requiredClarifications.forEach(q => {
          if (q.expectedAnswerType === "select") {
            expect(q.options).toBeDefined();
            expect(q.options!.length).toBeGreaterThanOrEqual(2);
          }
        });
      });
    });

    it("contract categories must be valid enum values", () => {
      const validCategories: ClarificationCategory[] = [
        "missing_information", "contradiction", "architecture_gap",
        "regulatory_gap", "data_model_gap", "scope_conflict", "execution_failure",
      ];
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      result.contracts.forEach(c => {
        expect(validCategories).toContain(c.category);
      });
    });

    it("contract severity must be advisory or blocker", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      result.contracts.forEach(c => {
        expect(["advisory", "blocker"]).toContain(c.severity);
      });
    });

    it("originating module must match detection context", () => {
      const reqDoc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const reqResult = detectRequirementsGaps(reqDoc, "i1", "p1");
      reqResult.contracts.forEach(c => {
        expect(c.originatingModule).toBe("requirements");
      });

      const promptDoc = createMinimalPromptDoc({ prompts: [] });
      const promptResult = detectPromptGaps(promptDoc, "r1", "p1");
      promptResult.contracts.forEach(c => {
        expect(c.originatingModule).toBe("prompts");
      });
    });
  });

  describe("De-duplication Invariants", () => {
    it("identical requests produce identical hashes", () => {
      const base = createClarificationRequest();
      const hashes = [
        computeHash(base),
        computeHash(base),
        computeHash(base),
      ];
      expect(new Set(hashes).size).toBe(1);
    });

    it("same detection run on same doc produces same hashes", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result1 = detectRequirementsGaps(doc, "i1", "p1");
      const result2 = detectRequirementsGaps(doc, "i1", "p1");

      const hashes1 = result1.contracts.map(c => computeHash(c));
      const hashes2 = result2.contracts.map(c => computeHash(c));
      expect(hashes1).toEqual(hashes2);
    });

    it("different projects produce different hashes (via different upstream IDs)", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result1 = detectRequirementsGaps(doc, "idea-A", "proj-1");
      const result2 = detectRequirementsGaps(doc, "idea-B", "proj-2");

      const hashes1 = result1.contracts.map(c => computeHash(c));
      const hashes2 = result2.contracts.map(c => computeHash(c));
      expect(hashes1).not.toEqual(hashes2);
    });
  });

  describe("Blocker Escalation Rules", () => {
    it("loop threshold is 3 occurrences", () => {
      expect(detectExecutionEscalation("h", 2, 1, "p", "proj")).toBeNull();
      expect(detectExecutionEscalation("h", 3, 1, "p", "proj")).not.toBeNull();
    });

    it("escalated contracts always have severity blocker", () => {
      const result = detectExecutionEscalation("h", 3, 1, "p", "proj");
      expect(result!.severity).toBe("blocker");
    });

    it("missing functional requirements are always blockers (not escalated, inherently blockers)", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      const frGap = result.contracts.find(c => c.title.includes("functional requirements"));
      expect(frGap!.severity).toBe("blocker");
    });

    it("zero prompts are always blockers", () => {
      const doc = createMinimalPromptDoc({ prompts: [] });
      const result = detectPromptGaps(doc, "r1", "p1");
      expect(result.hasBlockers).toBe(true);
      expect(result.contracts[0].severity).toBe("blocker");
    });

    it("data model gaps are advisory, not blockers", () => {
      const doc = createMinimalRequirementsDoc({ dataModels: [] });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      const dataGap = result.contracts.find(c => c.category === "data_model_gap");
      expect(dataGap!.severity).toBe("advisory");
    });
  });

  describe("hasBlockers Flag Consistency", () => {
    it("hasBlockers is true when any contract is a blocker", () => {
      const doc = createMinimalRequirementsDoc({ functionalRequirements: [] });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      const hasBl = result.contracts.some(c => c.severity === "blocker");
      expect(result.hasBlockers).toBe(hasBl);
    });

    it("hasBlockers is false when all contracts are advisory", () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [{
          id: "FR-001",
          category: "Core",
          title: "Test",
          description: "Test",
          priority: "must-have",
          acceptanceCriteria: [],
        }],
        dataModels: [],
      });
      const result = detectRequirementsGaps(doc, "i1", "p1");
      if (result.contracts.length > 0) {
        const allAdvisory = result.contracts.every(c => c.severity === "advisory");
        expect(result.hasBlockers).toBe(!allAdvisory);
      }
    });
  });
});
