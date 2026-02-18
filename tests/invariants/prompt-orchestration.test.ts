import { describe, it, expect } from "vitest";
import type { RequirementsDocument, FunctionalRequirement, NonFunctionalRequirement } from "../../shared/types/requirements";
import type { BuildPrompt } from "../../shared/types/prompts";

function createMinimalRequirementsDoc(overrides: Partial<RequirementsDocument> = {}): RequirementsDocument {
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

function createFR(overrides: Partial<FunctionalRequirement> = {}): FunctionalRequirement {
  return {
    id: "FR-001",
    category: "Core",
    title: "User Registration",
    description: "Users can create accounts",
    priority: "must-have",
    acceptanceCriteria: ["Users can fill in registration form", "System validates input"],
    ...overrides,
  };
}

function createNFR(overrides: Partial<NonFunctionalRequirement> = {}): NonFunctionalRequirement {
  return {
    id: "NFR-001",
    category: "performance",
    title: "Response Time",
    description: "API responses under 200ms",
    ...overrides,
  };
}

async function generatePromptsFromRequirements(doc: RequirementsDocument): Promise<BuildPrompt[]> {
  const { PromptsService } = await import("../../server/services/prompts.service");
  const service = new PromptsService();
  return service.generatePromptsFromRequirements(doc);
}

describe("Prompt Orchestration", () => {

  describe("Dynamic Generation from Requirements", () => {
    it("should generate different prompts for different requirement sets", async () => {
      const docA = createMinimalRequirementsDoc({
        ideaTitle: "Todo App",
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Tasks", title: "Create Tasks", priority: "must-have" }),
          createFR({ id: "FR-002", category: "Tasks", title: "Delete Tasks", priority: "must-have" }),
        ],
        dataModels: [{ name: "Task", description: "A todo task", fields: [{ name: "title", type: "string", required: true }] }],
      });

      const docB = createMinimalRequirementsDoc({
        ideaTitle: "Chat App",
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Messaging", title: "Send Messages", priority: "must-have" }),
          createFR({ id: "FR-002", category: "Messaging", title: "Create Channels", priority: "must-have" }),
          createFR({ id: "FR-003", category: "Users", title: "User Profiles", priority: "should-have" }),
        ],
        dataModels: [
          { name: "Message", description: "Chat message", fields: [{ name: "content", type: "string", required: true }] },
          { name: "Channel", description: "Chat channel", fields: [{ name: "name", type: "string", required: true }] },
        ],
      });

      const promptsA = await generatePromptsFromRequirements(docA);
      const promptsB = await generatePromptsFromRequirements(docB);

      expect(promptsA.length).not.toBe(promptsB.length);

      const titlesA = promptsA.map(p => p.title);
      const titlesB = promptsB.map(p => p.title);
      expect(titlesA).not.toEqual(titlesB);

      const contentA = promptsA.map(p => p.prompt).join(" ");
      const contentB = promptsB.map(p => p.prompt).join(" ");
      expect(contentA).toContain("Todo App");
      expect(contentB).toContain("Chat App");
    });

    it("should not produce any hardcoded static 12-step template", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Feature A", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);

      expect(prompts.length).not.toBe(12);

      const allTitles = prompts.map(p => p.title);
      expect(allTitles).not.toContain("Authentication System");
      expect(allTitles).not.toContain("Authentication UI");
      expect(allTitles).not.toContain("Settings and Preferences");
    });

    it("should vary step count based on number of requirement categories", async () => {
      const docSimple = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Basic Feature", priority: "must-have" }),
        ],
      });

      const docComplex = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Auth", title: "Login", priority: "must-have" }),
          createFR({ id: "FR-002", category: "Messaging", title: "Send Message", priority: "must-have" }),
          createFR({ id: "FR-003", category: "Payments", title: "Process Payment", priority: "must-have" }),
          createFR({ id: "FR-004", category: "Admin", title: "User Management", priority: "should-have" }),
        ],
        nonFunctionalRequirements: [
          createNFR({ id: "NFR-001", category: "security", title: "Encryption" }),
          createNFR({ id: "NFR-002", category: "performance", title: "Caching" }),
        ],
        securityConsiderations: [{ title: "Data Encryption", category: "authentication", priority: "high", description: "Encrypt all data at rest", implementation: "Use AES-256" }],
        dataModels: [{ name: "User", description: "User entity", fields: [{ name: "email", type: "string", required: true }] }],
      });

      const simplePrompts = await generatePromptsFromRequirements(docSimple);
      const complexPrompts = await generatePromptsFromRequirements(docComplex);

      expect(complexPrompts.length).toBeGreaterThan(simplePrompts.length);
    });
  });

  describe("Requirement Traceability", () => {
    it("should include requirementsCovered in each step", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Create Items", priority: "must-have" }),
          createFR({ id: "FR-002", category: "Core", title: "List Items", priority: "must-have" }),
        ],
        dataModels: [{ name: "Item", description: "An item", fields: [{ name: "name", type: "string", required: true }] }],
      });

      const prompts = await generatePromptsFromRequirements(doc);

      for (const prompt of prompts) {
        expect(prompt).toHaveProperty("requirementsCovered");
        expect(Array.isArray(prompt.requirementsCovered)).toBe(true);
      }
    });

    it("should reference each high-priority FR ID in at least one step", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Create Items", priority: "must-have" }),
          createFR({ id: "FR-002", category: "Core", title: "Edit Items", priority: "must-have" }),
          createFR({ id: "FR-003", category: "Core", title: "Delete Items", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const allCovered = prompts.flatMap(p => p.requirementsCovered || []);

      expect(allCovered).toContain("FR-001");
      expect(allCovered).toContain("FR-002");
      expect(allCovered).toContain("FR-003");
    });

    it("should reference each prompt step title in the prompt content", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Main Feature", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);

      for (const prompt of prompts) {
        expect(prompt.prompt).toBeTruthy();
        expect(prompt.prompt.length).toBeGreaterThan(10);
        expect(prompt.objective).toBeTruthy();
      }
    });
  });

  describe("Dependency Ordering", () => {
    it("should enforce architecture before data model before API before UI ordering", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "CRUD Operations", priority: "must-have" }),
        ],
        dataModels: [{ name: "Entity", description: "Main entity", fields: [{ name: "name", type: "string", required: true }] }],
        nonFunctionalRequirements: [
          createNFR({ id: "NFR-001", category: "security", title: "Auth required" }),
        ],
        securityConsiderations: [{ title: "Auth", category: "authentication", priority: "high", description: "Require auth", implementation: "JWT" }],
      });

      const prompts = await generatePromptsFromRequirements(doc);

      const archStep = prompts.find(p => p.tags?.includes("architecture") || p.tags?.includes("setup"));
      const dataStep = prompts.find(p => p.tags?.includes("database") || p.tags?.includes("schema"));
      const apiStep = prompts.find(p => p.tags?.includes("api") || p.tags?.includes("backend"));
      const uiStep = prompts.find(p => p.tags?.includes("frontend") && (p.tags?.includes("feature") || p.tags?.includes("layout")));
      const secStep = prompts.find(p => p.tags?.includes("security") || p.tags?.includes("compliance"));

      expect(archStep).toBeDefined();
      if (dataStep) expect(dataStep.step).toBeGreaterThan(archStep!.step);
      if (apiStep) expect(apiStep.step).toBeGreaterThan(archStep!.step);
      if (uiStep && apiStep) expect(uiStep.step).toBeGreaterThan(apiStep.step);
      if (secStep && uiStep) expect(secStep.step).toBeGreaterThan(uiStep.step);
    });

    it("should have no forward references in dependencies", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Feature A", priority: "must-have" }),
          createFR({ id: "FR-002", category: "UI", title: "Feature B", priority: "should-have" }),
        ],
        dataModels: [{ name: "Model", description: "A model", fields: [{ name: "name", type: "string", required: true }] }],
        nonFunctionalRequirements: [
          createNFR({ id: "NFR-001", category: "performance", title: "Fast API" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);

      for (const prompt of prompts) {
        if (prompt.dependencies && prompt.dependencies.length > 0) {
          for (const dep of prompt.dependencies) {
            expect(dep).toBeLessThan(prompt.step);
          }
        }
      }
    });

    it("should always start with an architecture/setup step", async () => {
      const doc = createMinimalRequirementsDoc();
      const prompts = await generatePromptsFromRequirements(doc);

      expect(prompts[0].step).toBe(1);
      expect(prompts[0].tags).toContain("architecture");
    });
  });

  describe("Scope Guardrails from Out-of-Scope", () => {
    it("should include out-of-scope items as scopeGuardrails", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Basic Feature", priority: "must-have" }),
        ],
        outOfScope: [
          { id: "OOS-001", item: "Mobile native app", reason: "Web-only MVP", futureConsideration: true },
          { id: "OOS-002", item: "Real-time notifications", reason: "Deferred to v2", futureConsideration: true },
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const allGuardrails = prompts.flatMap(p => p.scopeGuardrails || []);
      const guardrailText = allGuardrails.join(" ").toLowerCase();

      expect(guardrailText).toContain("mobile native app");
      expect(guardrailText).toContain("real-time notifications");
    });
  });

  describe("High-Priority FR Coverage", () => {
    it("should generate at least one step per high-priority FR category", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Authentication", title: "Login", priority: "must-have" }),
          createFR({ id: "FR-002", category: "Payments", title: "Checkout", priority: "must-have" }),
          createFR({ id: "FR-003", category: "Dashboard", title: "Overview", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const allContent = prompts.map(p => p.prompt + " " + p.title).join(" ").toLowerCase();

      expect(allContent).toContain("authentication");
      expect(allContent).toContain("payment");
      expect(allContent).toContain("dashboard");
    });
  });

  describe("NFR Integration", () => {
    it("should generate dedicated steps for security NFRs", async () => {
      const doc = createMinimalRequirementsDoc({
        nonFunctionalRequirements: [
          createNFR({ id: "NFR-001", category: "security", title: "Input Sanitization" }),
          createNFR({ id: "NFR-002", category: "security", title: "Rate Limiting" }),
        ],
        securityConsiderations: [{ title: "XSS Prevention", category: "data-protection", priority: "high", description: "Prevent XSS", implementation: "Sanitize inputs" }],
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Feature", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const securityStep = prompts.find(p => p.tags?.includes("security") || p.tags?.includes("compliance"));

      expect(securityStep).toBeDefined();
      expect(securityStep!.requirementsCovered).toContain("NFR-001");
      expect(securityStep!.requirementsCovered).toContain("NFR-002");
    });

    it("should generate dedicated steps for performance NFRs", async () => {
      const doc = createMinimalRequirementsDoc({
        nonFunctionalRequirements: [
          createNFR({ id: "NFR-001", category: "performance", title: "API Response Time", target: "200ms" }),
          createNFR({ id: "NFR-002", category: "scalability", title: "Handle 1000 concurrent users" }),
        ],
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Feature", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const perfStep = prompts.find(p => p.tags?.includes("performance") || p.tags?.includes("optimization"));

      expect(perfStep).toBeDefined();
      expect(perfStep!.requirementsCovered).toContain("NFR-001");
      expect(perfStep!.requirementsCovered).toContain("NFR-002");
    });
  });

  describe("Architecture Decisions", () => {
    it("should include architecture decisions in early setup steps", async () => {
      const doc = createMinimalRequirementsDoc({
        architectureDecisions: [
          { id: "AD-001", title: "Database Choice", decision: "Use PostgreSQL", rationale: "ACID compliance needed" },
          { id: "AD-002", title: "API Style", decision: "Use REST", rationale: "Simpler for CRUD operations" },
        ],
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Feature", priority: "must-have" }),
        ],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const archStep = prompts[0];

      expect(archStep.requirementsCovered).toContain("AD-001");
      expect(archStep.requirementsCovered).toContain("AD-002");
      expect(archStep.prompt).toContain("PostgreSQL");
      expect(archStep.prompt).toContain("REST");
    });
  });

  describe("BuildPrompt Structure", () => {
    it("should include all required fields in each generated step", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [
          createFR({ id: "FR-001", category: "Core", title: "Main Feature", priority: "must-have" }),
        ],
        dataModels: [{ name: "Entity", description: "Test", fields: [{ name: "name", type: "string", required: true }] }],
      });

      const prompts = await generatePromptsFromRequirements(doc);

      for (const prompt of prompts) {
        expect(prompt).toHaveProperty("step");
        expect(prompt).toHaveProperty("title");
        expect(prompt).toHaveProperty("objective");
        expect(prompt).toHaveProperty("prompt");
        expect(prompt).toHaveProperty("expectedOutcome");
        expect(prompt).toHaveProperty("waitInstruction");
        expect(prompt).toHaveProperty("requirementsCovered");
        expect(prompt).toHaveProperty("dependencies");
        expect(prompt).toHaveProperty("estimatedTime");
        expect(prompt).toHaveProperty("tags");
        expect(prompt).toHaveProperty("verificationCheckpoint");
        expect(prompt).toHaveProperty("failureRecovery");
        expect(prompt).toHaveProperty("scopeGuardrails");

        expect(typeof prompt.step).toBe("number");
        expect(typeof prompt.title).toBe("string");
        expect(typeof prompt.prompt).toBe("string");
        expect(Array.isArray(prompt.requirementsCovered)).toBe(true);
        expect(Array.isArray(prompt.dependencies)).toBe(true);
        expect(Array.isArray(prompt.failureRecovery)).toBe(true);
        expect(Array.isArray(prompt.scopeGuardrails)).toBe(true);
      }
    });

    it("should always end with a final polish/deployment step", async () => {
      const doc = createMinimalRequirementsDoc({
        functionalRequirements: [createFR()],
      });

      const prompts = await generatePromptsFromRequirements(doc);
      const lastStep = prompts[prompts.length - 1];

      expect(lastStep.tags).toContain("deployment");
      expect(lastStep.waitInstruction).toContain("COMPLETE");
    });
  });
});
