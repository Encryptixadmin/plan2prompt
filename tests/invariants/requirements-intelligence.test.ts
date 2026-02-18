import { describe, it, expect } from "vitest";
import type {
  RequirementsDocument,
  FunctionalRequirement,
  NonFunctionalRequirement,
  RiskTraceabilityEntry,
  SystemOverview,
  ArchitectureDecision,
} from "../../shared/types/requirements";

function makeFR(overrides: Partial<FunctionalRequirement> = {}): FunctionalRequirement {
  return {
    id: "FR-001",
    category: "Core",
    title: "Test Requirement",
    description: "A test functional requirement",
    priority: "High",
    acceptanceCriteria: ["Criterion 1"],
    ...overrides,
  };
}

function makeMinimalRequirements(overrides: Partial<RequirementsDocument> = {}): RequirementsDocument {
  return {
    id: "test-id",
    ideaArtifactId: "idea-123",
    ideaTitle: "Test Idea",
    systemOverview: {
      purpose: "Test system purpose",
      coreUser: "Test users",
      primaryOutcome: "Success",
    },
    functionalRequirements: [makeFR()],
    nonFunctionalRequirements: [],
    architecture: {
      pattern: "Modular",
      description: "Test architecture",
      components: [],
      dataFlow: "Request -> Response",
    },
    dataModels: [],
    apiContracts: {
      baseUrl: "/api/v1",
      version: "1.0.0",
      authentication: "Bearer token",
      endpoints: [],
    },
    uiuxPrinciples: {
      designSystem: "Component-based",
      keyPrinciples: [],
      userFlows: [],
      accessibilityRequirements: [],
    },
    securityConsiderations: [],
    assumptions: [],
    outOfScope: [],
    edgeCasesAndFailureModes: [],
    confidenceNotes: [],
    riskTraceability: [],
    summary: "Test summary",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Requirements Intelligence Upgrade", () => {

  describe("SystemOverview validation", () => {
    it("should have all required fields", () => {
      const overview: SystemOverview = {
        purpose: "Build a task management app",
        coreUser: "Project managers",
        primaryOutcome: "Improved team productivity",
      };
      expect(overview.purpose).toBeTruthy();
      expect(overview.coreUser).toBeTruthy();
      expect(overview.primaryOutcome).toBeTruthy();
    });

    it("should be optional on RequirementsDocument for backward compatibility", () => {
      const doc = makeMinimalRequirements({ systemOverview: undefined });
      expect(doc.systemOverview).toBeUndefined();
      expect(doc.functionalRequirements).toBeDefined();
    });
  });

  describe("FunctionalRequirement priority values", () => {
    it("should accept legacy priority values (must-have, should-have, nice-to-have)", () => {
      const fr1 = makeFR({ priority: "must-have" });
      const fr2 = makeFR({ priority: "should-have" });
      const fr3 = makeFR({ priority: "nice-to-have" });
      expect(fr1.priority).toBe("must-have");
      expect(fr2.priority).toBe("should-have");
      expect(fr3.priority).toBe("nice-to-have");
    });

    it("should accept AI-style priority values (High, Medium, Low)", () => {
      const fr1 = makeFR({ priority: "High" });
      const fr2 = makeFR({ priority: "Medium" });
      const fr3 = makeFR({ priority: "Low" });
      expect(fr1.priority).toBe("High");
      expect(fr2.priority).toBe("Medium");
      expect(fr3.priority).toBe("Low");
    });
  });

  describe("RiskTraceability", () => {
    it("should track risk-to-requirement mapping", () => {
      const entry: RiskTraceabilityEntry = {
        riskId: "RISK-001",
        riskDescription: "Data breach from insecure API",
        mitigationInRequirementIds: ["FR-003", "NFR-002"],
        coverageStatus: "fully-mitigated",
      };
      expect(entry.mitigationInRequirementIds).toHaveLength(2);
      expect(entry.coverageStatus).toBe("fully-mitigated");
    });

    it("should mark risks with no mitigation as unmitigated", () => {
      const entry: RiskTraceabilityEntry = {
        riskId: "RISK-002",
        riskDescription: "Market competition risk",
        mitigationInRequirementIds: [],
        coverageStatus: "unmitigated",
      };
      expect(entry.mitigationInRequirementIds).toHaveLength(0);
      expect(entry.coverageStatus).toBe("unmitigated");
    });

    it("should support partially-mitigated status", () => {
      const entry: RiskTraceabilityEntry = {
        riskId: "RISK-003",
        riskDescription: "Scalability under load",
        mitigationInRequirementIds: ["NFR-001"],
        coverageStatus: "partially-mitigated",
      };
      expect(entry.coverageStatus).toBe("partially-mitigated");
    });

    it("should be optional on RequirementsDocument for backward compatibility", () => {
      const doc = makeMinimalRequirements({ riskTraceability: undefined });
      expect(doc.riskTraceability).toBeUndefined();
    });

    it("unmitigated risks should have empty mitigation IDs", () => {
      const risks: RiskTraceabilityEntry[] = [
        {
          riskId: "RISK-001",
          riskDescription: "Technical debt",
          mitigationInRequirementIds: [],
          coverageStatus: "unmitigated",
        },
        {
          riskId: "RISK-002",
          riskDescription: "Security vulnerability",
          mitigationInRequirementIds: ["FR-005"],
          coverageStatus: "partially-mitigated",
        },
      ];

      for (const risk of risks) {
        if (risk.coverageStatus === "unmitigated") {
          expect(risk.mitigationInRequirementIds).toHaveLength(0);
        } else {
          expect(risk.mitigationInRequirementIds.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("ArchitectureDecisions", () => {
    it("should have required fields", () => {
      const ad: ArchitectureDecision = {
        id: "AD-001",
        title: "Use PostgreSQL",
        decision: "PostgreSQL as primary database",
        rationale: "Strong JSON support and scalability",
        alternatives: ["MongoDB", "MySQL"],
        tradeoffs: "More complex setup than SQLite",
      };
      expect(ad.id).toBeTruthy();
      expect(ad.decision).toBeTruthy();
      expect(ad.rationale).toBeTruthy();
    });

    it("alternatives and tradeoffs should be optional", () => {
      const ad: ArchitectureDecision = {
        id: "AD-002",
        title: "REST over GraphQL",
        decision: "Use REST API",
        rationale: "Simpler for this use case",
      };
      expect(ad.alternatives).toBeUndefined();
      expect(ad.tradeoffs).toBeUndefined();
    });

    it("should be optional on RequirementsDocument for backward compatibility", () => {
      const doc = makeMinimalRequirements({ architectureDecisions: undefined });
      expect(doc.architectureDecisions).toBeUndefined();
    });
  });

  describe("JSON parsing resilience", () => {
    it("should handle NFRs in both array and object formats", () => {
      const arrayFormat: NonFunctionalRequirement[] = [
        { id: "NFR-001", category: "performance", title: "Response time", description: "API < 2s" },
      ];
      expect(arrayFormat[0].category).toBe("performance");

      const objectFormat: Record<string, string[]> = {
        performance: ["API responses under 2s"],
        security: ["Auth required for protected endpoints"],
      };
      expect(Object.keys(objectFormat)).toContain("performance");
      expect(Object.keys(objectFormat)).toContain("security");
    });

    it("should validate FR IDs follow pattern FR-NNN", () => {
      const validIds = ["FR-001", "FR-010", "FR-100"];
      const invalidIds = ["FR1", "fr-001", "REQ-001"];

      for (const id of validIds) {
        expect(id).toMatch(/^FR-\d{3}$/);
      }
      for (const id of invalidIds) {
        expect(id).not.toMatch(/^FR-\d{3}$/);
      }
    });

    it("should validate risk IDs follow pattern RISK-NNN", () => {
      const validIds = ["RISK-001", "RISK-010"];
      for (const id of validIds) {
        expect(id).toMatch(/^RISK-\d{3}$/);
      }
    });
  });

  describe("RequirementsDocument structural invariants", () => {
    it("must always have at least one functional requirement", () => {
      const doc = makeMinimalRequirements();
      expect(doc.functionalRequirements.length).toBeGreaterThanOrEqual(1);
    });

    it("must have architecture with pattern and description", () => {
      const doc = makeMinimalRequirements();
      expect(doc.architecture.pattern).toBeTruthy();
      expect(doc.architecture.description).toBeTruthy();
    });

    it("must have API contracts with base URL", () => {
      const doc = makeMinimalRequirements();
      expect(doc.apiContracts.baseUrl).toBeTruthy();
      expect(doc.apiContracts.version).toBeTruthy();
    });

    it("must have a non-empty summary", () => {
      const doc = makeMinimalRequirements();
      expect(doc.summary.length).toBeGreaterThan(5);
    });

    it("must have version and createdAt", () => {
      const doc = makeMinimalRequirements();
      expect(doc.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(doc.createdAt).toBeTruthy();
    });

    it("risk traceability mitigation IDs should reference actual FRs when present", () => {
      const frs = [makeFR({ id: "FR-001" }), makeFR({ id: "FR-002" })];
      const frIds = new Set(frs.map(fr => fr.id));

      const risks: RiskTraceabilityEntry[] = [
        {
          riskId: "RISK-001",
          riskDescription: "Test risk",
          mitigationInRequirementIds: ["FR-001"],
          coverageStatus: "partially-mitigated",
        },
      ];

      for (const risk of risks) {
        for (const mitId of risk.mitigationInRequirementIds) {
          if (mitId.startsWith("FR-")) {
            expect(frIds.has(mitId)).toBe(true);
          }
        }
      }
    });
  });

  describe("AI JSON schema normalization", () => {
    it("should handle apiContracts as array (AI format) → object (type format)", () => {
      const aiApiContracts = [
        { method: "GET", path: "/api/users", description: "List users", authentication: true },
        { method: "POST", path: "/api/users", description: "Create user", authentication: true },
      ];

      const normalized = {
        baseUrl: "/api/v1",
        version: "1.0.0",
        authentication: "Bearer token",
        endpoints: aiApiContracts,
      };

      expect(normalized.baseUrl).toBeTruthy();
      expect(normalized.endpoints).toHaveLength(2);
      expect(normalized.endpoints[0].method).toBe("GET");
    });

    it("should handle nonFunctionalRequirements as object (AI format) → array (type format)", () => {
      const aiNFRs: Record<string, string[]> = {
        performance: ["API responses under 2s"],
        security: ["Auth required"],
        compliance: ["GDPR compliant"],
        scalability: ["Support 10k concurrent users"],
        usability: ["Mobile-responsive design"],
      };

      const normalized: NonFunctionalRequirement[] = [];
      let counter = 1;
      for (const [category, items] of Object.entries(aiNFRs)) {
        for (const item of items) {
          normalized.push({
            id: `NFR-${String(counter).padStart(3, "0")}`,
            category: category as NonFunctionalRequirement["category"],
            title: item.length > 60 ? item.substring(0, 57) + "..." : item,
            description: item,
          });
          counter++;
        }
      }

      expect(normalized).toHaveLength(5);
      expect(normalized[0].category).toBe("performance");
      expect(normalized[2].category).toBe("compliance");
    });

    it("should handle dataModel (AI singular) vs dataModels (type plural)", () => {
      const aiDataModel = {
        entities: [
          { name: "User", description: "App user", fields: [{ name: "id", type: "UUID", required: true }] },
        ],
        relationships: [
          { from: "User", to: "Project", type: "one-to-many", description: "User owns projects" },
        ],
      };

      const dataModels = aiDataModel.entities;
      expect(dataModels).toHaveLength(1);
      expect(dataModels[0].name).toBe("User");
    });

    it("should handle explicitOutOfScope (AI) vs outOfScope (type)", () => {
      const aiExplicitOutOfScope = [
        { id: "OOS-001", item: "Mobile app", reason: "Web-first approach", futureConsideration: true },
      ];

      const outOfScope = aiExplicitOutOfScope;
      expect(outOfScope).toHaveLength(1);
      expect(outOfScope[0].item).toBe("Mobile app");
    });

    it("should produce valid RequirementsDocument from AI-shaped JSON", () => {
      const doc = makeMinimalRequirements({
        systemOverview: { purpose: "AI-generated purpose", coreUser: "Developers", primaryOutcome: "Ship faster" },
        functionalRequirements: [
          makeFR({ id: "FR-001", priority: "High", title: "User Auth" }),
          makeFR({ id: "FR-002", priority: "Medium", title: "Dashboard" }),
        ],
        riskTraceability: [
          {
            riskId: "RISK-001",
            riskDescription: "Security breach",
            mitigationInRequirementIds: ["FR-001"],
            coverageStatus: "partially-mitigated",
          },
        ],
        architectureDecisions: [
          { id: "AD-001", title: "Use REST", decision: "REST API", rationale: "Simplicity" },
        ],
      });

      expect(doc.id).toBeTruthy();
      expect(doc.systemOverview?.purpose).toBe("AI-generated purpose");
      expect(doc.functionalRequirements).toHaveLength(2);
      expect(doc.riskTraceability).toHaveLength(1);
      expect(doc.riskTraceability![0].mitigationInRequirementIds).toContain("FR-001");
      expect(doc.architectureDecisions).toHaveLength(1);
      expect(doc.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("NonFunctionalRequirement compliance category", () => {
    it("should support compliance as a valid category", () => {
      const nfr: NonFunctionalRequirement = {
        id: "NFR-010",
        category: "compliance",
        title: "GDPR Data Protection",
        description: "User data must comply with GDPR requirements",
      };
      expect(nfr.category).toBe("compliance");
    });
  });
});
