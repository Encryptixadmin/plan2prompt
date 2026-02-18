import { randomUUID } from "crypto";
import type {
  RequirementsDocument,
  FunctionalRequirement,
  NonFunctionalRequirement,
  ArchitectureOverview,
  ArchitectureDecision,
  DataModelEntity,
  DataModel,
  APIContracts,
  APIEndpoint,
  UIUXPrinciples,
  SecurityConsideration,
  RequirementAssumption,
  OutOfScopeItem,
  EdgeCaseFailureMode,
  ConfidenceNote,
  SystemOverview,
  RiskTraceabilityEntry,
} from "@shared/types/requirements";
import { consensusService } from "./ai";
import { artifactService } from "./artifact.service";
import type { Artifact } from "@shared/types/artifact";
import type { PipelineStage } from "@shared/types/pipeline";
import type { UsageModule } from "@shared/schema";

export class RequirementsService {
  async generateRequirements(ideaArtifactId: string, projectId?: string, userId?: string): Promise<RequirementsDocument> {
    const ideaArtifact = await artifactService.getById(ideaArtifactId);
    if (!ideaArtifact) {
      throw new Error(`Idea artifact not found: ${ideaArtifactId}`);
    }

    const ideaTitle = this.extractIdeaTitle(ideaArtifact);
    const ideaDescription = this.extractIdeaDescription(ideaArtifact);

    const prompt = this.buildRequirementsPrompt(ideaArtifact);

    const usageContext = projectId
      ? { projectId, module: "requirements" as UsageModule, artifactId: ideaArtifactId, userId }
      : undefined;

    const consensus = await consensusService.getConsensus({
      prompt: {
        system: this.getSystemPrompt(),
        user: prompt,
        context: JSON.stringify({ artifactId: ideaArtifactId, title: ideaTitle }),
      },
    }, usageContext);

    const requirements = this.parseConsensusToRequirements(
      ideaArtifactId,
      ideaTitle,
      ideaDescription,
      consensus.providerResponses,
      consensus.confidence,
      ideaArtifact
    );

    return requirements;
  }

  async acceptRequirements(requirements: RequirementsDocument): Promise<RequirementsDocument> {
    const ideaArtifact = await artifactService.getById(requirements.ideaArtifactId);
    const sourceVersion = ideaArtifact?.metadata.version;
    
    const artifact = await this.saveAsArtifact(requirements, sourceVersion);
    requirements.artifactId = artifact.metadata.id;

    return requirements;
  }

  private extractIdeaTitle(artifact: Artifact): string {
    const titleMatch = artifact.metadata.title.match(/Ideas Reference: (.+)/);
    return titleMatch ? titleMatch[1] : artifact.metadata.title;
  }

  private extractIdeaDescription(artifact: Artifact): string {
    const overviewSection = artifact.sections.find(s => s.heading === "Idea Overview");
    if (overviewSection) {
      const descMatch = overviewSection.content.match(/\*\*Description:\*\* (.+)/);
      return descMatch ? descMatch[1] : "";
    }
    return "";
  }

  private extractIdeaAnalysisContext(artifact: Artifact): string {
    const sections: string[] = [];
    
    const analysisKeys = [
      "Strengths", "Weaknesses", "Risks", "Next Steps",
      "Technical Profile", "Commercial Profile", "Execution Profile",
      "Viability Assessment", "Risk Drivers", "Scope Warnings",
      "Assumption Dependencies", "Feasibility Assessment"
    ];

    for (const section of artifact.sections) {
      if (analysisKeys.some(k => section.heading.includes(k))) {
        sections.push(`## ${section.heading}\n${section.content}`);
      }
    }

    return sections.join("\n\n");
  }

  private buildRequirementsPrompt(artifact: Artifact): string {
    let prompt = `Generate comprehensive, structured requirements for the following validated idea.\n\n`;
    prompt += `# ${artifact.metadata.title}\n\n`;

    for (const section of artifact.sections) {
      prompt += `## ${section.heading}\n${section.content}\n\n`;
    }

    const analysisContext = this.extractIdeaAnalysisContext(artifact);
    if (analysisContext) {
      prompt += `\n# STRUCTURED IDEA ANALYSIS (use this to inform requirements)\n${analysisContext}\n`;
    }

    prompt += `\nYou MUST respond with ONLY valid JSON matching the schema defined in the system prompt. No narrative text, no markdown formatting, no code fences. Output raw JSON only.`;

    return prompt;
  }

  private getSystemPrompt(): string {
    return `You are an expert software architect and requirements engineer. Your task is to generate a structured requirements document as valid JSON.

CRITICAL RULES:
1. Output ONLY valid JSON. No markdown, no code fences, no explanation text.
2. Every field must be populated with idea-specific content derived from the input.
3. Do NOT use generic placeholders or template content.
4. Requirements must directly address the described product/idea.
5. Architecture, data models, and API contracts must be specific to the described system.

OUTPUT SCHEMA (follow exactly):
{
  "systemOverview": {
    "purpose": "What the system does (1-2 sentences)",
    "coreUser": "Primary user persona",
    "primaryOutcome": "What success looks like"
  },
  "functionalRequirements": [
    {
      "id": "FR-001",
      "category": "string",
      "title": "string",
      "description": "string",
      "priority": "High|Medium|Low",
      "acceptanceCriteria": ["testable criterion 1", "..."],
      "dependencies": ["FR-xxx"] 
    }
  ],
  "nonFunctionalRequirements": {
    "performance": ["specific performance requirement"],
    "security": ["specific security requirement"],
    "compliance": ["specific compliance requirement or 'None identified'"],
    "scalability": ["specific scalability requirement"],
    "usability": ["specific usability requirement"]
  },
  "dataModel": {
    "entities": [
      {
        "name": "EntityName",
        "description": "what it represents",
        "fields": [
          {"name": "fieldName", "type": "String|UUID|Integer|DateTime|Boolean|JSON|Enum", "required": true, "description": "purpose", "constraints": []}
        ],
        "relationships": [
          {"entity": "OtherEntity", "type": "one-to-one|one-to-many|many-to-many", "description": "relationship meaning"}
        ]
      }
    ],
    "relationships": [
      {"from": "Entity1", "to": "Entity2", "type": "one-to-many", "description": "relationship description"}
    ]
  },
  "apiContracts": [
    {
      "method": "GET|POST|PUT|PATCH|DELETE",
      "path": "/api/resource",
      "description": "what it does",
      "authentication": true,
      "requestBody": {"contentType": "application/json", "schema": "{ field: type }"},
      "responseBody": {"contentType": "application/json", "schema": "{ field: type }"},
      "errorResponses": [{"status": 400, "description": "reason"}]
    }
  ],
  "architectureDecisions": [
    {
      "id": "AD-001",
      "title": "decision title",
      "decision": "what was decided",
      "rationale": "why",
      "alternatives": ["what else was considered"],
      "tradeoffs": "key tradeoffs"
    }
  ],
  "assumptions": [
    {
      "id": "ASM-001",
      "category": "technical|user|operational|business|integration",
      "statement": "the assumption",
      "rationale": "why assumed",
      "impact": "what happens if wrong"
    }
  ],
  "explicitOutOfScope": [
    {
      "id": "OOS-001",
      "item": "what is excluded",
      "reason": "why excluded",
      "futureConsideration": true
    }
  ],
  "riskTraceability": [
    {
      "riskId": "RISK-001",
      "riskDescription": "the risk from idea analysis",
      "mitigationInRequirementIds": ["FR-001", "NFR-003"],
      "coverageStatus": "fully-mitigated|partially-mitigated|unmitigated"
    }
  ],
  "architecture": {
    "pattern": "architectural pattern name",
    "description": "architecture description",
    "components": [
      {
        "name": "ComponentName",
        "type": "frontend|backend|database|service|external|infrastructure",
        "description": "purpose",
        "technologies": ["tech1"],
        "responsibilities": ["resp1"],
        "interfaces": ["interface1"]
      }
    ],
    "dataFlow": "how data moves through system",
    "deploymentNotes": "deployment approach"
  },
  "uiuxPrinciples": {
    "designSystem": "design approach",
    "keyPrinciples": [{"principle": "name", "description": "detail"}],
    "userFlows": [{"name": "flow", "description": "desc", "steps": ["step1"]}],
    "accessibilityRequirements": ["requirement"]
  },
  "securityConsiderations": [
    {
      "category": "authentication|authorization|data-protection|input-validation|infrastructure|compliance",
      "title": "title",
      "description": "detail",
      "implementation": "how to implement",
      "priority": "critical|high|medium|low"
    }
  ],
  "edgeCasesAndFailureModes": [
    {
      "id": "ECF-001",
      "scenario": "what can go wrong",
      "category": "input|state|integration|resource|timing|user-behavior",
      "likelihood": "rare|occasional|likely",
      "expectedBehavior": "how system handles it",
      "recoveryAction": "how to recover"
    }
  ],
  "confidenceNotes": [
    {
      "id": "CN-001",
      "section": "which section",
      "concern": "what is uncertain",
      "confidenceLevel": "high|medium|low",
      "reason": "why uncertain",
      "mitigationSuggestion": "how to reduce uncertainty"
    }
  ],
  "summary": "Executive summary of the requirements document (2-3 sentences)"
}

IMPORTANT:
- Generate at least 8 functional requirements specific to this idea
- Generate at least 3 data model entities specific to this idea
- Generate at least 5 API endpoints specific to this idea
- All riskTraceability entries must reference actual FR/NFR IDs from the requirements
- If a risk has no mitigation requirement, set coverageStatus to "unmitigated" and add to explicitOutOfScope with a warning`;
  }

  private tryParseJSON(content: string): any | null {
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch {}

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }

    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {}
    }

    return null;
  }

  private parseConsensusToRequirements(
    ideaArtifactId: string,
    ideaTitle: string,
    ideaDescription: string,
    providerResponses: any[],
    confidence: number,
    ideaArtifact: Artifact
  ): RequirementsDocument {
    const id = randomUUID();

    const sorted = [...providerResponses].sort((a: any, b: any) => b.confidence - a.confidence);
    
    let parsed: any = null;
    for (const resp of sorted) {
      parsed = this.tryParseJSON(resp.content);
      if (parsed && parsed.functionalRequirements) break;
      parsed = null;
    }

    if (!parsed) {
      console.warn("[Requirements] No provider returned valid structured JSON. Attempting free-text extraction.");
      const primaryContent = sorted[0]?.content || "";
      parsed = this.extractFromFreeText(primaryContent, ideaTitle, ideaDescription);
    }

    const systemOverview = this.validateSystemOverview(parsed.systemOverview, ideaTitle, ideaDescription);
    const functionalRequirements = this.validateFunctionalRequirements(parsed.functionalRequirements || []);
    const nonFunctionalRequirements = this.validateNonFunctionalRequirements(parsed.nonFunctionalRequirements || parsed.nonFunctional || {});
    const architecture = this.validateArchitecture(parsed.architecture, ideaTitle);
    const architectureDecisions = this.validateArchitectureDecisions(parsed.architectureDecisions || []);
    const dataModels = this.validateDataModels(parsed.dataModel?.entities || parsed.dataModels || []);
    const dataModel = this.validateDataModel(parsed.dataModel);
    const apiContracts = this.validateAPIContracts(parsed.apiContracts, ideaTitle);
    const uiuxPrinciples = this.validateUIUXPrinciples(parsed.uiuxPrinciples);
    const securityConsiderations = this.validateSecurityConsiderations(parsed.securityConsiderations || []);
    const assumptions = this.validateAssumptions(parsed.assumptions || []);
    const outOfScope = this.validateOutOfScope(parsed.explicitOutOfScope || parsed.outOfScope || []);
    const edgeCasesAndFailureModes = this.validateEdgeCases(parsed.edgeCasesAndFailureModes || []);
    const confidenceNotes = this.validateConfidenceNotes(parsed.confidenceNotes || []);
    const riskTraceability = this.validateRiskTraceability(parsed.riskTraceability || [], functionalRequirements, ideaArtifact);

    this.populateOriginatingRiskIds(functionalRequirements, riskTraceability, assumptions);

    const summary = typeof parsed.summary === "string" && parsed.summary.length > 10
      ? parsed.summary
      : this.generateSummary(ideaTitle, confidence, functionalRequirements.length, dataModels.length, apiContracts.endpoints.length);

    return {
      id,
      ideaArtifactId,
      ideaTitle,
      systemOverview,
      functionalRequirements,
      nonFunctionalRequirements,
      architecture,
      architectureDecisions,
      dataModels,
      dataModel,
      apiContracts,
      uiuxPrinciples,
      securityConsiderations,
      assumptions,
      outOfScope,
      edgeCasesAndFailureModes,
      confidenceNotes,
      riskTraceability,
      summary,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
    };
  }

  private extractFromFreeText(content: string, ideaTitle: string, ideaDescription: string): any {
    return {
      systemOverview: {
        purpose: ideaDescription || `System for ${ideaTitle}`,
        coreUser: "Primary users of the application",
        primaryOutcome: "Successful delivery of core functionality",
      },
      functionalRequirements: [{
        id: "FR-001",
        category: "Core",
        title: "Primary Feature",
        description: `Core functionality for ${ideaTitle}. AI analysis returned unstructured output; re-generate for better results.`,
        priority: "High",
        acceptanceCriteria: ["Feature operates correctly for valid inputs", "Appropriate error handling"],
      }],
      nonFunctionalRequirements: {
        performance: ["API responses under 2s for standard operations"],
        security: ["Authentication required for all protected endpoints"],
        compliance: ["None identified"],
        scalability: ["Support for expected initial user load"],
        usability: ["Responsive design for desktop and mobile"],
      },
      dataModel: { entities: [], relationships: [] },
      apiContracts: [],
      architectureDecisions: [],
      assumptions: [],
      explicitOutOfScope: [],
      riskTraceability: [],
      architecture: null,
      uiuxPrinciples: null,
      securityConsiderations: [],
      edgeCasesAndFailureModes: [],
      confidenceNotes: [{
        id: "CN-001",
        section: "All Sections",
        concern: "AI analysis returned unstructured output",
        confidenceLevel: "low",
        reason: "Could not parse structured JSON from AI providers",
        mitigationSuggestion: "Re-generate requirements with a more detailed idea description",
      }],
      summary: `Requirements for "${ideaTitle}" generated from unstructured AI output. Consider re-generating for better structured results.`,
    };
  }

  private validateSystemOverview(raw: any, ideaTitle: string, ideaDescription: string): SystemOverview {
    if (!raw || typeof raw !== "object") {
      return {
        purpose: ideaDescription || `System for ${ideaTitle}`,
        coreUser: "Primary users of the application",
        primaryOutcome: "Successful delivery of core functionality",
      };
    }
    return {
      purpose: String(raw.purpose || ideaDescription || `System for ${ideaTitle}`),
      coreUser: String(raw.coreUser || "Primary users"),
      primaryOutcome: String(raw.primaryOutcome || "Successful delivery of core functionality"),
    };
  }

  private validateFunctionalRequirements(raw: any[]): FunctionalRequirement[] {
    if (!Array.isArray(raw)) return [];

    const validPriorities = ["must-have", "should-have", "nice-to-have", "High", "Medium", "Low"];

    return raw.slice(0, 30).map((fr, i) => ({
      id: String(fr.id || `FR-${String(i + 1).padStart(3, "0")}`),
      category: String(fr.category || "General"),
      title: String(fr.title || "Untitled Requirement"),
      description: String(fr.description || ""),
      priority: (validPriorities.includes(fr.priority) ? fr.priority : "Medium") as FunctionalRequirement["priority"],
      acceptanceCriteria: Array.isArray(fr.acceptanceCriteria) ? fr.acceptanceCriteria.map(String) : [],
      dependencies: Array.isArray(fr.dependencies) ? fr.dependencies.map(String) : undefined,
      originatingRiskIds: Array.isArray(fr.originatingRiskIds) ? fr.originatingRiskIds.map(String) : [],
      originatingAssumptionIds: Array.isArray(fr.originatingAssumptionIds) ? fr.originatingAssumptionIds.map(String) : [],
    })).filter(fr => fr.description.length > 0);
  }

  private validateNonFunctionalRequirements(raw: any): NonFunctionalRequirement[] {
    if (Array.isArray(raw)) {
      const validCategories = ["performance", "security", "scalability", "reliability", "usability", "maintainability", "compatibility", "compliance"];
      return raw.slice(0, 20).map((nfr, i) => ({
        id: String(nfr.id || `NFR-${String(i + 1).padStart(3, "0")}`),
        category: (validCategories.includes(nfr.category) ? nfr.category : "performance") as NonFunctionalRequirement["category"],
        title: String(nfr.title || "Untitled NFR"),
        description: String(nfr.description || ""),
        metric: nfr.metric ? String(nfr.metric) : undefined,
        target: nfr.target ? String(nfr.target) : undefined,
      })).filter(nfr => nfr.description.length > 0);
    }

    if (typeof raw === "object" && raw !== null) {
      const results: NonFunctionalRequirement[] = [];
      let counter = 1;

      const categoryMap: Record<string, NonFunctionalRequirement["category"]> = {
        performance: "performance",
        security: "security",
        compliance: "compliance",
        scalability: "scalability",
        usability: "usability",
        reliability: "reliability",
        maintainability: "maintainability",
        compatibility: "compatibility",
      };

      for (const [key, items] of Object.entries(raw)) {
        const category = categoryMap[key] || "performance";
        if (Array.isArray(items)) {
          for (const item of items) {
            const desc = typeof item === "string" ? item : String(item?.description || item);
            if (desc && desc !== "None identified") {
              results.push({
                id: `NFR-${String(counter).padStart(3, "0")}`,
                category,
                title: desc.length > 60 ? desc.substring(0, 57) + "..." : desc,
                description: desc,
              });
              counter++;
            }
          }
        }
      }
      return results;
    }

    return [];
  }

  private validateArchitecture(raw: any, ideaTitle: string): ArchitectureOverview {
    if (!raw || typeof raw !== "object") {
      return {
        pattern: "To be determined",
        description: `Architecture for ${ideaTitle} pending structured AI analysis.`,
        components: [],
        dataFlow: "To be determined",
      };
    }

    const validTypes = ["frontend", "backend", "database", "service", "external", "infrastructure"];

    return {
      pattern: String(raw.pattern || "Modular Architecture"),
      description: String(raw.description || `Architecture for ${ideaTitle}`),
      components: Array.isArray(raw.components) ? raw.components.map((c: any) => ({
        name: String(c.name || "Component"),
        type: (validTypes.includes(c.type) ? c.type : "service") as any,
        description: String(c.description || ""),
        technologies: Array.isArray(c.technologies) ? c.technologies.map(String) : undefined,
        responsibilities: Array.isArray(c.responsibilities) ? c.responsibilities.map(String) : [],
        interfaces: Array.isArray(c.interfaces) ? c.interfaces.map(String) : undefined,
      })) : [],
      dataFlow: String(raw.dataFlow || ""),
      deploymentNotes: raw.deploymentNotes ? String(raw.deploymentNotes) : undefined,
    };
  }

  private validateArchitectureDecisions(raw: any[]): ArchitectureDecision[] {
    if (!Array.isArray(raw)) return [];

    return raw.slice(0, 15).map((ad, i) => ({
      id: String(ad.id || `AD-${String(i + 1).padStart(3, "0")}`),
      title: String(ad.title || "Untitled Decision"),
      decision: String(ad.decision || ""),
      rationale: String(ad.rationale || ""),
      alternatives: Array.isArray(ad.alternatives) ? ad.alternatives.map(String) : undefined,
      tradeoffs: ad.tradeoffs ? String(ad.tradeoffs) : undefined,
    })).filter(ad => ad.decision.length > 0);
  }

  private validateDataModels(raw: any[]): DataModelEntity[] {
    if (!Array.isArray(raw)) return [];

    return raw.slice(0, 20).map(dm => ({
      name: String(dm.name || "Entity"),
      description: String(dm.description || ""),
      fields: Array.isArray(dm.fields) ? dm.fields.map((f: any) => ({
        name: String(f.name || "field"),
        type: String(f.type || "String"),
        required: Boolean(f.required),
        description: f.description ? String(f.description) : undefined,
        constraints: Array.isArray(f.constraints) ? f.constraints.map(String) : undefined,
      })) : [],
      relationships: Array.isArray(dm.relationships) ? dm.relationships.map((r: any) => ({
        entity: String(r.entity || ""),
        type: (["one-to-one", "one-to-many", "many-to-many"].includes(r.type) ? r.type : "one-to-many") as any,
        description: r.description ? String(r.description) : undefined,
      })) : undefined,
    })).filter(dm => dm.name && dm.name !== "Entity");
  }

  private validateDataModel(raw: any): DataModel | undefined {
    if (!raw || typeof raw !== "object") return undefined;

    return {
      entities: this.validateDataModels(raw.entities || []),
      relationships: Array.isArray(raw.relationships) ? raw.relationships.map((r: any) => ({
        from: String(r.from || ""),
        to: String(r.to || ""),
        type: (["one-to-one", "one-to-many", "many-to-many"].includes(r.type) ? r.type : "one-to-many") as any,
        description: r.description ? String(r.description) : undefined,
      })) : [],
    };
  }

  private validateAPIContracts(raw: any, ideaTitle: string): APIContracts {
    if (Array.isArray(raw)) {
      return {
        baseUrl: "/api/v1",
        version: "1.0.0",
        authentication: "Bearer token in Authorization header",
        endpoints: this.validateEndpoints(raw),
      };
    }

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return {
        baseUrl: String(raw.baseUrl || "/api/v1"),
        version: String(raw.version || "1.0.0"),
        authentication: String(raw.authentication || "Bearer token"),
        endpoints: this.validateEndpoints(raw.endpoints || []),
      };
    }

    return {
      baseUrl: "/api/v1",
      version: "1.0.0",
      authentication: "Bearer token in Authorization header",
      endpoints: [],
    };
  }

  private validateEndpoints(raw: any[]): APIEndpoint[] {
    if (!Array.isArray(raw)) return [];

    const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

    return raw.slice(0, 30).map(ep => ({
      method: (validMethods.includes(ep.method) ? ep.method : "GET") as APIEndpoint["method"],
      path: String(ep.path || "/api/unknown"),
      description: String(ep.description || ""),
      authentication: ep.authentication !== false,
      requestBody: ep.requestBody ? {
        contentType: String(ep.requestBody.contentType || "application/json"),
        schema: String(ep.requestBody.schema || "{}"),
      } : undefined,
      responseBody: ep.responseBody ? {
        contentType: String(ep.responseBody.contentType || "application/json"),
        schema: String(ep.responseBody.schema || "{}"),
      } : undefined,
      errorResponses: Array.isArray(ep.errorResponses) ? ep.errorResponses.map((e: any) => ({
        status: Number(e.status) || 500,
        description: String(e.description || ""),
      })) : undefined,
    })).filter(ep => ep.description.length > 0);
  }

  private validateUIUXPrinciples(raw: any): UIUXPrinciples {
    if (!raw || typeof raw !== "object") {
      return {
        designSystem: "Component-based design system",
        keyPrinciples: [],
        userFlows: [],
        accessibilityRequirements: [],
      };
    }

    return {
      designSystem: String(raw.designSystem || "Component-based design system"),
      keyPrinciples: Array.isArray(raw.keyPrinciples) ? raw.keyPrinciples.map((p: any) => ({
        principle: String(p.principle || ""),
        description: String(p.description || ""),
      })).filter((p: any) => p.principle) : [],
      userFlows: Array.isArray(raw.userFlows) ? raw.userFlows.map((f: any) => ({
        name: String(f.name || ""),
        description: String(f.description || ""),
        steps: Array.isArray(f.steps) ? f.steps.map(String) : [],
      })).filter((f: any) => f.name) : [],
      accessibilityRequirements: Array.isArray(raw.accessibilityRequirements) ? raw.accessibilityRequirements.map(String) : [],
      responsiveBreakpoints: Array.isArray(raw.responsiveBreakpoints) ? raw.responsiveBreakpoints.map(String) : undefined,
    };
  }

  private validateSecurityConsiderations(raw: any[]): SecurityConsideration[] {
    if (!Array.isArray(raw)) return [];

    const validCategories = ["authentication", "authorization", "data-protection", "input-validation", "infrastructure", "compliance"];
    const validPriorities = ["critical", "high", "medium", "low"];

    return raw.slice(0, 15).map(sc => ({
      category: (validCategories.includes(sc.category) ? sc.category : "infrastructure") as SecurityConsideration["category"],
      title: String(sc.title || "Security Consideration"),
      description: String(sc.description || ""),
      implementation: String(sc.implementation || ""),
      priority: (validPriorities.includes(sc.priority) ? sc.priority : "medium") as SecurityConsideration["priority"],
    })).filter(sc => sc.description.length > 0);
  }

  private validateAssumptions(raw: any[]): RequirementAssumption[] {
    if (!Array.isArray(raw)) return [];

    const validCategories = ["technical", "user", "operational", "business", "integration"];

    return raw.slice(0, 15).map((a, i) => ({
      id: String(a.id || `ASM-${String(i + 1).padStart(3, "0")}`),
      category: (validCategories.includes(a.category) ? a.category : "technical") as RequirementAssumption["category"],
      statement: String(a.statement || ""),
      rationale: String(a.rationale || ""),
      impact: String(a.impact || ""),
    })).filter(a => a.statement.length > 0);
  }

  private validateOutOfScope(raw: any[]): OutOfScopeItem[] {
    if (!Array.isArray(raw)) return [];

    return raw.slice(0, 15).map((o, i) => ({
      id: String(o.id || `OOS-${String(i + 1).padStart(3, "0")}`),
      item: String(o.item || ""),
      reason: String(o.reason || ""),
      futureConsideration: Boolean(o.futureConsideration),
    })).filter(o => o.item.length > 0);
  }

  private validateEdgeCases(raw: any[]): EdgeCaseFailureMode[] {
    if (!Array.isArray(raw)) return [];

    const validCategories = ["input", "state", "integration", "resource", "timing", "user-behavior"];
    const validLikelihoods = ["rare", "occasional", "likely"];

    return raw.slice(0, 15).map((e, i) => ({
      id: String(e.id || `ECF-${String(i + 1).padStart(3, "0")}`),
      scenario: String(e.scenario || ""),
      category: (validCategories.includes(e.category) ? e.category : "input") as EdgeCaseFailureMode["category"],
      likelihood: (validLikelihoods.includes(e.likelihood) ? e.likelihood : "occasional") as EdgeCaseFailureMode["likelihood"],
      expectedBehavior: String(e.expectedBehavior || ""),
      recoveryAction: e.recoveryAction ? String(e.recoveryAction) : undefined,
    })).filter(e => e.scenario.length > 0);
  }

  private validateConfidenceNotes(raw: any[]): ConfidenceNote[] {
    if (!Array.isArray(raw)) return [];

    const validLevels = ["high", "medium", "low"];

    return raw.slice(0, 10).map((c, i) => ({
      id: String(c.id || `CN-${String(i + 1).padStart(3, "0")}`),
      section: String(c.section || "General"),
      concern: String(c.concern || ""),
      confidenceLevel: (validLevels.includes(c.confidenceLevel) ? c.confidenceLevel : "medium") as ConfidenceNote["confidenceLevel"],
      reason: String(c.reason || ""),
      mitigationSuggestion: c.mitigationSuggestion ? String(c.mitigationSuggestion) : undefined,
    })).filter(c => c.concern.length > 0);
  }

  private validateRiskTraceability(
    raw: any[],
    functionalRequirements: FunctionalRequirement[],
    ideaArtifact: Artifact
  ): RiskTraceabilityEntry[] {
    const frIds = new Set(functionalRequirements.map(fr => fr.id));

    if (Array.isArray(raw) && raw.length > 0) {
      return raw.slice(0, 20).map((rt, i) => {
        const mitigationIds = Array.isArray(rt.mitigationInRequirementIds)
          ? rt.mitigationInRequirementIds.map(String)
          : [];

        const validMitigationIds = mitigationIds.filter((reqId: string) => frIds.has(reqId) || reqId.startsWith("NFR-"));
        
        const validStatuses = ["fully-mitigated", "partially-mitigated", "unmitigated"];
        let coverageStatus = validStatuses.includes(rt.coverageStatus) ? rt.coverageStatus : "unmitigated";
        
        if (validMitigationIds.length === 0) coverageStatus = "unmitigated";
        else if (coverageStatus === "fully-mitigated" && validMitigationIds.length < 2) coverageStatus = "partially-mitigated";

        return {
          riskId: String(rt.riskId || `RISK-${String(i + 1).padStart(3, "0")}`),
          riskDescription: String(rt.riskDescription || ""),
          mitigationInRequirementIds: validMitigationIds,
          coverageStatus: coverageStatus as RiskTraceabilityEntry["coverageStatus"],
        };
      }).filter(rt => rt.riskDescription.length > 0);
    }

    const risks = this.extractIdeaRisks(ideaArtifact);
    if (risks.length === 0) return [];

    return risks.map((risk, i) => ({
      riskId: `RISK-${String(i + 1).padStart(3, "0")}`,
      riskDescription: risk,
      mitigationInRequirementIds: [],
      coverageStatus: "unmitigated" as const,
    }));
  }

  private populateOriginatingRiskIds(
    functionalRequirements: FunctionalRequirement[],
    riskTraceability: RiskTraceabilityEntry[],
    assumptions: RequirementAssumption[]
  ): void {
    const frRiskMap = new Map<string, string[]>();
    for (const rt of riskTraceability) {
      for (const reqId of rt.mitigationInRequirementIds) {
        if (!frRiskMap.has(reqId)) frRiskMap.set(reqId, []);
        frRiskMap.get(reqId)!.push(rt.riskId);
      }
    }

    const frAssumptionMap = new Map<string, string[]>();
    for (const assumption of assumptions) {
      for (const fr of functionalRequirements) {
        if (fr.description.toLowerCase().includes(assumption.statement.toLowerCase().split(" ").slice(0, 3).join(" "))) {
          if (!frAssumptionMap.has(fr.id)) frAssumptionMap.set(fr.id, []);
          frAssumptionMap.get(fr.id)!.push(assumption.id);
        }
      }
    }

    for (const fr of functionalRequirements) {
      fr.originatingRiskIds = frRiskMap.get(fr.id) || [];
      fr.originatingAssumptionIds = frAssumptionMap.get(fr.id) || [];
    }
  }

  private extractIdeaRisks(artifact: Artifact): string[] {
    const risksSection = artifact.sections.find(s => 
      s.heading === "Risks" || s.heading === "Risk Assessment" || s.heading.includes("Risk")
    );
    if (!risksSection) return [];

    const risks: string[] = [];
    const lines = risksSection.content.split("\n");
    for (const line of lines) {
      const match = line.match(/[-*]\s*\*?\*?(.+?)(?:\*?\*?\s*[-–:]|$)/);
      if (match && match[1].trim().length > 10) {
        risks.push(match[1].trim());
      }
    }
    return risks.slice(0, 10);
  }

  private generateSummary(
    ideaTitle: string,
    confidence: number,
    frCount: number,
    entityCount: number,
    endpointCount: number
  ): string {
    return `Requirements document for "${ideaTitle}" specifies ${frCount} functional requirements, ${entityCount} data entities, and ${endpointCount} API endpoints. Generated with ${Math.round(confidence * 100)}% AI consensus confidence.`;
  }

  private async saveAsArtifact(requirements: RequirementsDocument, sourceVersion?: number) {
    const sections = [
      {
        heading: "Executive Summary",
        level: 2 as const,
        content: requirements.summary,
      },
      {
        heading: "Document Information",
        level: 2 as const,
        content: `**Version:** ${requirements.version}\n**Source Idea:** ${requirements.ideaTitle}\n**Idea Artifact ID:** \`${requirements.ideaArtifactId}\`\n**Generated:** ${requirements.createdAt}`,
      },
    ];

    if (requirements.systemOverview) {
      sections.push({
        heading: "System Overview",
        level: 2 as const,
        content: `**Purpose:** ${requirements.systemOverview.purpose}\n**Core User:** ${requirements.systemOverview.coreUser}\n**Primary Outcome:** ${requirements.systemOverview.primaryOutcome}`,
      });
    }

    sections.push({
      heading: "Functional Requirements",
      level: 2 as const,
      content: requirements.functionalRequirements.map(fr =>
        `### ${fr.id}: ${fr.title}\n**Category:** ${fr.category} | **Priority:** ${fr.priority}\n\n${fr.description}\n\n**Acceptance Criteria:**\n${fr.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}${fr.dependencies ? `\n\n**Dependencies:** ${fr.dependencies.join(', ')}` : ''}`
      ).join('\n\n---\n\n'),
    });

    sections.push({
      heading: "Non-Functional Requirements",
      level: 2 as const,
      content: requirements.nonFunctionalRequirements.length > 0
        ? `| ID | Category | Title | Description |\n|-----|----------|-------|-------------|\n${requirements.nonFunctionalRequirements.map(nfr =>
            `| ${nfr.id} | ${nfr.category} | ${nfr.title} | ${nfr.description} |`
          ).join('\n')}`
        : "No non-functional requirements specified.",
    });

    if (requirements.architectureDecisions && requirements.architectureDecisions.length > 0) {
      sections.push({
        heading: "Architecture Decisions",
        level: 2 as const,
        content: requirements.architectureDecisions.map(ad =>
          `### ${ad.id}: ${ad.title}\n**Decision:** ${ad.decision}\n**Rationale:** ${ad.rationale}${ad.alternatives ? `\n**Alternatives Considered:** ${ad.alternatives.join(', ')}` : ''}${ad.tradeoffs ? `\n**Tradeoffs:** ${ad.tradeoffs}` : ''}`
        ).join('\n\n---\n\n'),
      });
    }

    sections.push({
      heading: "Architecture Overview",
      level: 2 as const,
      content: `**Pattern:** ${requirements.architecture.pattern}\n\n${requirements.architecture.description}\n\n### Components\n\n${requirements.architecture.components.map(c =>
        `#### ${c.name} (${c.type})\n${c.description}\n\n**Technologies:** ${c.technologies?.join(', ') || 'TBD'}\n\n**Responsibilities:**\n${c.responsibilities.map(r => `- ${r}`).join('\n')}`
      ).join('\n\n')}\n\n### Data Flow\n${requirements.architecture.dataFlow}${requirements.architecture.deploymentNotes ? `\n\n### Deployment Notes\n${requirements.architecture.deploymentNotes}` : ''}`,
    });

    sections.push({
      heading: "Data Models",
      level: 2 as const,
      content: requirements.dataModels.length > 0
        ? requirements.dataModels.map(dm =>
            `### ${dm.name}\n${dm.description}\n\n| Field | Type | Required | Description |\n|-------|------|----------|-------------|\n${dm.fields.map(f =>
              `| ${f.name} | ${f.type} | ${f.required ? 'Yes' : 'No'} | ${f.description || '-'} |`
            ).join('\n')}${dm.relationships ? `\n\n**Relationships:**\n${dm.relationships.map(r => `- ${r.type} with ${r.entity}${r.description ? `: ${r.description}` : ''}`).join('\n')}` : ''}`
          ).join('\n\n---\n\n')
        : "Data models pending structured AI analysis.",
    });

    sections.push({
      heading: "API Contracts",
      level: 2 as const,
      content: `**Base URL:** ${requirements.apiContracts.baseUrl}\n**Version:** ${requirements.apiContracts.version}\n**Authentication:** ${requirements.apiContracts.authentication}\n\n### Endpoints\n\n${requirements.apiContracts.endpoints.map(ep =>
        `#### ${ep.method} ${ep.path}\n${ep.description}\n\n**Authentication Required:** ${ep.authentication ? 'Yes' : 'No'}${ep.requestBody ? `\n\n**Request Body:** \`${ep.requestBody.schema}\`` : ''}${ep.responseBody ? `\n\n**Response:** \`${ep.responseBody.schema}\`` : ''}${ep.errorResponses ? `\n\n**Error Responses:**\n${ep.errorResponses.map(e => `- ${e.status}: ${e.description}`).join('\n')}` : ''}`
      ).join('\n\n---\n\n')}`,
    });

    sections.push({
      heading: "UI/UX Principles",
      level: 2 as const,
      content: `**Design System:** ${requirements.uiuxPrinciples.designSystem}\n\n### Key Principles\n${requirements.uiuxPrinciples.keyPrinciples.map(p => `- **${p.principle}:** ${p.description}`).join('\n')}\n\n### User Flows\n${requirements.uiuxPrinciples.userFlows.map(f => `#### ${f.name}\n${f.description}\n\n${f.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`).join('\n\n')}\n\n### Accessibility\n${requirements.uiuxPrinciples.accessibilityRequirements.map(r => `- ${r}`).join('\n')}`,
    });

    sections.push({
      heading: "Security Considerations",
      level: 2 as const,
      content: requirements.securityConsiderations.map(sc =>
        `### ${sc.title} (${sc.category})\n**Priority:** ${sc.priority}\n\n${sc.description}\n\n**Implementation:** ${sc.implementation}`
      ).join('\n\n---\n\n'),
    });

    sections.push({
      heading: "Assumptions",
      level: 2 as const,
      content: requirements.assumptions.map(a =>
        `### ${a.id}: ${a.statement}\n**Category:** ${a.category}\n**Rationale:** ${a.rationale}\n**Impact if Wrong:** ${a.impact}`
      ).join('\n\n'),
    });

    sections.push({
      heading: "Out of Scope",
      level: 2 as const,
      content: requirements.outOfScope.map(o =>
        `- **${o.id}: ${o.item}** — ${o.reason}${o.futureConsideration ? ' *(future consideration)*' : ''}`
      ).join('\n'),
    });

    if (requirements.riskTraceability && requirements.riskTraceability.length > 0) {
      sections.push({
        heading: "Risk Traceability",
        level: 2 as const,
        content: `| Risk ID | Description | Mitigation Requirements | Coverage |\n|---------|-------------|-------------------------|----------|\n${requirements.riskTraceability.map(rt =>
          `| ${rt.riskId} | ${rt.riskDescription} | ${rt.mitigationInRequirementIds.join(', ') || 'None'} | ${rt.coverageStatus} |`
        ).join('\n')}`,
      });
    }

    sections.push({
      heading: "Edge Cases and Failure Modes",
      level: 2 as const,
      content: requirements.edgeCasesAndFailureModes.map(e =>
        `### ${e.id}: ${e.scenario}\n**Category:** ${e.category} | **Likelihood:** ${e.likelihood}\n\n**Expected Behavior:** ${e.expectedBehavior}${e.recoveryAction ? `\n**Recovery:** ${e.recoveryAction}` : ''}`
      ).join('\n\n'),
    });

    sections.push({
      heading: "Confidence Notes",
      level: 2 as const,
      content: requirements.confidenceNotes.map(c =>
        `### ${c.id}: ${c.section}\n**Confidence:** ${c.confidenceLevel}\n\n${c.concern}\n\n**Reason:** ${c.reason}${c.mitigationSuggestion ? `\n**Mitigation:** ${c.mitigationSuggestion}` : ''}`
      ).join('\n\n'),
    });

    const projectId = (requirements as any).projectId;
    const authorId = (requirements as any).authorId;

    const artifact = await artifactService.create({
      title: `Requirements Reference: ${requirements.ideaTitle}`,
      module: "requirements",
      stage: "REQUIREMENTS_COMPLETE" as PipelineStage,
      sections,
      sourceArtifactId: requirements.ideaArtifactId,
      sourceArtifactVersion: sourceVersion,
      projectId,
      authorId,
    });

    return artifact;
  }
}

export const requirementsService = new RequirementsService();
