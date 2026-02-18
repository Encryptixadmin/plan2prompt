import { randomUUID } from "crypto";
import type {
  IDEType,
  BuildPrompt,
  PromptDocument,
  PromptPrerequisite,
  VerificationCheckpoint,
  FailureRecoveryBranch,
} from "@shared/types/prompts";
import type {
  RequirementsDocument,
  FunctionalRequirement,
  NonFunctionalRequirement,
  ArchitectureDecision,
  DataModelEntity,
  APIEndpoint,
  OutOfScopeItem,
  SecurityConsideration,
} from "@shared/types/requirements";
import { artifactService } from "./artifact.service";
import type { Artifact } from "@shared/types/artifact";
import type { PipelineStage } from "@shared/types/pipeline";

export class PromptsService {
  private ideNames: Record<IDEType, string> = {
    replit: "Replit",
    cursor: "Cursor",
    lovable: "Lovable",
    antigravity: "Antigravity",
    warp: "Warp",
    other: "Generic IDE",
  };

  async generatePrompts(
    requirementsArtifactId: string,
    ide: IDEType
  ): Promise<PromptDocument> {
    const artifact = await artifactService.getById(requirementsArtifactId);
    if (!artifact) {
      throw new Error(`Requirements artifact not found: ${requirementsArtifactId}`);
    }

    const sourceArtifactVersion = artifact.metadata.version;
    const ideaTitle = this.extractIdeaTitle(artifact);
    const requirementsDoc = this.extractRequirementsFromArtifact(artifact, ideaTitle);
    const basePrompts = this.generatePromptsFromRequirements(requirementsDoc);
    const prompts = basePrompts.map((p) => this.adaptPromptForIDE(p, ide));

    const document: PromptDocument = {
      id: randomUUID(),
      requirementsArtifactId,
      ideaTitle,
      ide,
      ideName: this.ideNames[ide],
      prompts,
      summary: this.generateSummary(ideaTitle, ide, prompts.length),
      totalSteps: prompts.length,
      estimatedTotalTime: this.calculateTotalTime(prompts),
      createdAt: new Date().toISOString(),
      sourceArtifactVersion,
    };

    const savedArtifact = await this.saveAsArtifact(document);
    document.artifactId = savedArtifact.metadata.id;

    return document;
  }

  private extractIdeaTitle(artifact: Artifact): string {
    const titleMatch = artifact.metadata.title.match(/Requirements Reference: (.+)/);
    return titleMatch ? titleMatch[1] : artifact.metadata.title;
  }

  private extractRequirementsFromArtifact(artifact: Artifact, ideaTitle: string): RequirementsDocument {
    const doc: RequirementsDocument = {
      id: artifact.metadata.id,
      ideaArtifactId: artifact.metadata.sourceArtifactId || "",
      ideaTitle,
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      architecture: { pattern: "", description: "", components: [], dataFlow: "" },
      dataModels: [],
      apiContracts: { baseUrl: "/api/v1", version: "1.0.0", authentication: "Bearer token", endpoints: [] },
      uiuxPrinciples: { designSystem: "", keyPrinciples: [], userFlows: [], accessibilityRequirements: [] },
      securityConsiderations: [],
      assumptions: [],
      outOfScope: [],
      edgeCasesAndFailureModes: [],
      confidenceNotes: [],
      summary: "",
      version: "1.0.0",
      createdAt: artifact.metadata.createdAt,
    };

    for (const section of artifact.sections) {
      const heading = section.heading.toLowerCase();

      if (heading.includes("functional requirement") && !heading.includes("non")) {
        doc.functionalRequirements = this.parseFRsFromMarkdown(section.content);
      } else if (heading.includes("non-functional") || heading.includes("nonfunctional")) {
        doc.nonFunctionalRequirements = this.parseNFRsFromMarkdown(section.content);
      } else if (heading.includes("architecture overview")) {
        doc.architecture = this.parseArchitectureFromMarkdown(section.content);
      } else if (heading.includes("architecture decision")) {
        doc.architectureDecisions = this.parseArchDecisionsFromMarkdown(section.content);
      } else if (heading.includes("data model")) {
        doc.dataModels = this.parseDataModelsFromMarkdown(section.content);
      } else if (heading.includes("api contract")) {
        doc.apiContracts = this.parseAPIFromMarkdown(section.content);
      } else if (heading.includes("security")) {
        doc.securityConsiderations = this.parseSecurityFromMarkdown(section.content);
      } else if (heading.includes("out of scope")) {
        doc.outOfScope = this.parseOutOfScopeFromMarkdown(section.content);
      } else if (heading.includes("system overview")) {
        doc.systemOverview = this.parseSystemOverviewFromMarkdown(section.content);
      } else if (heading.includes("ui") || heading.includes("ux")) {
        doc.uiuxPrinciples = this.parseUIUXFromMarkdown(section.content);
      } else if (heading.includes("executive summary") || heading === "summary") {
        doc.summary = section.content;
      }
    }

    return doc;
  }

  generatePromptsFromRequirements(doc: RequirementsDocument): BuildPrompt[] {
    const steps: BuildPrompt[] = [];
    let stepNum = 1;

    const outOfScopeGuardrails = (doc.outOfScope || []).map(o => `Do NOT implement: ${o.item} (${o.reason})`);

    const archStep = this.generateArchitectureStep(stepNum, doc, outOfScopeGuardrails);
    steps.push(archStep);
    const archStepNum = stepNum;
    stepNum++;

    if (doc.dataModels.length > 0 || (doc.dataModel?.entities && doc.dataModel.entities.length > 0)) {
      const dataStep = this.generateDataModelStep(stepNum, doc, archStepNum, outOfScopeGuardrails);
      steps.push(dataStep);
      stepNum++;
    }
    const dataStepNum = steps.length > 1 ? steps[steps.length - 1].step : archStepNum;

    const highFRs = doc.functionalRequirements.filter(fr => this.isHighPriority(fr));
    const medFRs = doc.functionalRequirements.filter(fr => !this.isHighPriority(fr));

    if (doc.apiContracts.endpoints.length > 0 || highFRs.length > 0) {
      const apiSteps = this.generateAPISteps(stepNum, doc, highFRs, dataStepNum, outOfScopeGuardrails);
      steps.push(...apiSteps);
      stepNum = steps[steps.length - 1].step + 1;
    }
    const lastApiStep = steps[steps.length - 1].step;

    if (doc.uiuxPrinciples.userFlows.length > 0 || highFRs.length > 0 || medFRs.length > 0) {
      const uiSteps = this.generateUISteps(stepNum, doc, highFRs, medFRs, lastApiStep, archStepNum, outOfScopeGuardrails);
      steps.push(...uiSteps);
      stepNum = steps[steps.length - 1].step + 1;
    }
    const lastUIStep = steps[steps.length - 1].step;

    const secNFRs = doc.nonFunctionalRequirements.filter(n => n.category === "security" || n.category === "compliance");
    if (secNFRs.length > 0 || doc.securityConsiderations.length > 0) {
      const secStep = this.generateSecurityStep(stepNum, doc, secNFRs, lastUIStep, outOfScopeGuardrails);
      steps.push(secStep);
      stepNum++;
    }

    const perfNFRs = doc.nonFunctionalRequirements.filter(n =>
      n.category === "performance" || n.category === "scalability" || n.category === "reliability"
    );
    if (perfNFRs.length > 0) {
      const perfStep = this.generatePerformanceStep(stepNum, doc, perfNFRs, steps[steps.length - 1].step, outOfScopeGuardrails);
      steps.push(perfStep);
      stepNum++;
    }

    const finalStep = this.generateFinalStep(stepNum, doc, steps[steps.length - 1].step, outOfScopeGuardrails);
    steps.push(finalStep);

    return steps;
  }

  private isHighPriority(fr: FunctionalRequirement): boolean {
    const p = fr.priority?.toLowerCase();
    return p === "must-have" || p === "high" || p === "critical";
  }

  private generateArchitectureStep(stepNum: number, doc: RequirementsDocument, guardrails: string[]): BuildPrompt {
    const decisions = doc.architectureDecisions || [];
    const reqsCovered: string[] = [];

    let prompt = `Set up the project architecture for "${doc.ideaTitle}".\n\n`;

    if (doc.systemOverview) {
      prompt += `## System Overview\n- Purpose: ${doc.systemOverview.purpose}\n- Core User: ${doc.systemOverview.coreUser}\n- Primary Outcome: ${doc.systemOverview.primaryOutcome}\n\n`;
    }

    if (doc.architecture.pattern) {
      prompt += `## Architecture Pattern: ${doc.architecture.pattern}\n${doc.architecture.description}\n\n`;
    }

    if (decisions.length > 0) {
      prompt += `## Architecture Decisions to Implement:\n`;
      for (const ad of decisions) {
        prompt += `- **${ad.title}:** ${ad.decision} (Rationale: ${ad.rationale})\n`;
        reqsCovered.push(ad.id);
      }
      prompt += `\n`;
    }

    if (doc.architecture.components.length > 0) {
      prompt += `## Components to Create:\n`;
      for (const comp of doc.architecture.components) {
        prompt += `- **${comp.name}** (${comp.type}): ${comp.description}`;
        if (comp.technologies && comp.technologies.length > 0) {
          prompt += ` [${comp.technologies.join(", ")}]`;
        }
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    prompt += `Initialize the project structure, install dependencies, and verify the development server starts.\n\nDo NOT implement any features yet.`;

    const usabilityNFRs = doc.nonFunctionalRequirements.filter(n => n.category === "maintainability" || n.category === "compatibility");
    for (const nfr of usabilityNFRs) {
      reqsCovered.push(nfr.id);
    }

    return {
      step: stepNum,
      title: "Architecture & Project Setup",
      objective: `Set up the project structure following the ${doc.architecture.pattern || "defined"} architecture pattern`,
      prompt,
      expectedOutcome: "Project structure created with dependencies installed and development server running",
      waitInstruction: "STOP here. Verify the project compiles and the dev server starts before proceeding.",
      requirementsCovered: reqsCovered,
      dependencies: [],
      estimatedTime: "10-15 minutes",
      tags: ["setup", "architecture"],
      verificationCheckpoint: {
        whatToVerify: "Development server starts without errors",
        successCriteria: "No compilation errors, server runs, project structure matches architecture decisions",
        whenToStop: "If dependencies fail to install or server won't start",
      },
      failureRecovery: [
        { symptom: "npm install fails with dependency conflicts", likelyCause: "Incompatible package versions", recoveryAction: "Delete node_modules and package-lock.json, then run npm install again.", shouldRetry: true },
        { symptom: "TypeScript compilation errors on fresh project", likelyCause: "Missing or misconfigured tsconfig.json", recoveryAction: "Ensure tsconfig.json exists with correct compiler options.", shouldRetry: true },
      ],
      scopeGuardrails: [
        "Do NOT add feature-specific code",
        "Do NOT create database schemas yet",
        ...guardrails.slice(0, 3),
      ],
    };
  }

  private generateDataModelStep(stepNum: number, doc: RequirementsDocument, archStep: number, guardrails: string[]): BuildPrompt {
    const entities = doc.dataModels.length > 0 ? doc.dataModels : (doc.dataModel?.entities || []);
    const reqsCovered: string[] = [];
    const dataRelatedFRs = doc.functionalRequirements.filter(fr => {
      const desc = (fr.description + " " + fr.title).toLowerCase();
      return desc.includes("data") || desc.includes("store") || desc.includes("database") ||
        desc.includes("model") || desc.includes("entity") || desc.includes("record") ||
        desc.includes("create") || desc.includes("save") || desc.includes("persist");
    });
    for (const fr of dataRelatedFRs) {
      if (!reqsCovered.includes(fr.id)) reqsCovered.push(fr.id);
    }

    let prompt = `Set up the database schema for "${doc.ideaTitle}".\n\n`;
    prompt += `Create the following data models using an ORM:\n\n`;

    for (const entity of entities) {
      prompt += `### ${entity.name}\n${entity.description}\n\n`;
      prompt += `| Field | Type | Required |\n|-------|------|----------|\n`;
      for (const field of entity.fields) {
        prompt += `| ${field.name} | ${field.type} | ${field.required ? "Yes" : "No"} |\n`;
      }
      if (entity.relationships && entity.relationships.length > 0) {
        prompt += `\nRelationships:\n`;
        for (const rel of entity.relationships) {
          prompt += `- ${rel.type} with ${rel.entity}${rel.description ? `: ${rel.description}` : ""}\n`;
        }
      }
      prompt += `\n`;
    }

    if (doc.dataModel?.relationships && doc.dataModel.relationships.length > 0) {
      prompt += `### Cross-Entity Relationships\n`;
      for (const rel of doc.dataModel.relationships) {
        prompt += `- ${rel.from} → ${rel.to} (${rel.type})${rel.description ? `: ${rel.description}` : ""}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Run the migration to create these tables.\n\nDo NOT implement any API endpoints yet.`;

    return {
      step: stepNum,
      title: "Database Schema Setup",
      objective: `Create ${entities.length} data model entities with relationships`,
      prompt,
      expectedOutcome: "Database tables created successfully with proper relationships and constraints",
      waitInstruction: "STOP here. Verify database tables exist with correct columns before proceeding.",
      requirementsCovered: reqsCovered,
      dependencies: [archStep],
      estimatedTime: "10-15 minutes",
      tags: ["database", "schema"],
      prerequisites: [{ stepNumber: archStep, description: "Project initialized with working development environment", verificationCheck: "Development server starts without errors" }],
      verificationCheckpoint: {
        whatToVerify: "All tables exist with correct columns and relationships",
        successCriteria: "Can connect to database and query table structure. Foreign keys are properly configured.",
        whenToStop: "If database connection fails or migration throws errors",
      },
      failureRecovery: [
        { symptom: "Database connection refused", likelyCause: "Database not running or connection string incorrect", recoveryAction: "Verify DATABASE_URL is set correctly. Check that PostgreSQL is running.", shouldRetry: true },
        { symptom: "Migration fails with syntax error", likelyCause: "ORM schema syntax incorrect", recoveryAction: "Check ORM documentation for correct column type syntax.", shouldRetry: true },
      ],
      scopeGuardrails: [
        "Do NOT add seed data",
        "Do NOT create API endpoints",
        ...guardrails.filter(g => g.toLowerCase().includes("data") || g.toLowerCase().includes("database")).slice(0, 2),
      ],
    };
  }

  private generateAPISteps(stepNum: number, doc: RequirementsDocument, highFRs: FunctionalRequirement[], dataStep: number, guardrails: string[]): BuildPrompt[] {
    const steps: BuildPrompt[] = [];

    const frGroups = this.groupFRsByCategory(highFRs);
    const endpoints = doc.apiContracts.endpoints;

    for (const [category, frs] of Object.entries(frGroups)) {
      const reqsCovered = frs.map(fr => fr.id);
      const relevantEndpoints = this.findRelevantEndpoints(endpoints, frs);

      let prompt = `Implement the ${category} backend API for "${doc.ideaTitle}".\n\n`;
      prompt += `## Requirements to Implement:\n`;
      for (const fr of frs) {
        prompt += `\n### ${fr.id}: ${fr.title}\n${fr.description}\n`;
        prompt += `**Priority:** ${fr.priority}\n`;
        if (fr.acceptanceCriteria.length > 0) {
          prompt += `**Acceptance Criteria:**\n${fr.acceptanceCriteria.map(ac => `- ${ac}`).join("\n")}\n`;
        }
      }

      if (relevantEndpoints.length > 0) {
        prompt += `\n## API Endpoints:\n`;
        for (const ep of relevantEndpoints) {
          prompt += `- **${ep.method} ${ep.path}**: ${ep.description}`;
          if (ep.authentication) prompt += ` [Auth Required]`;
          prompt += `\n`;
        }
      }

      const relevantNFRs = doc.nonFunctionalRequirements.filter(n =>
        n.category === "performance" || n.category === "reliability"
      );
      if (relevantNFRs.length > 0) {
        prompt += `\n## Non-Functional Constraints:\n`;
        for (const nfr of relevantNFRs) {
          prompt += `- ${nfr.description}\n`;
          reqsCovered.push(nfr.id);
        }
      }

      prompt += `\nAll endpoints should include proper error handling and input validation.\nDo NOT create any frontend UI yet.`;

      const apiGuardrails = guardrails.filter(g => {
        const lower = g.toLowerCase();
        return lower.includes("api") || lower.includes("backend") || lower.includes("endpoint");
      });

      steps.push({
        step: stepNum,
        title: `${category} API`,
        objective: `Implement ${frs.length} ${category} requirement(s) with ${relevantEndpoints.length} API endpoints`,
        prompt,
        expectedOutcome: `${category} API endpoints working and tested with proper validation`,
        waitInstruction: `STOP here. Test all ${category} API endpoints before proceeding.`,
        requirementsCovered: reqsCovered,
        dependencies: [dataStep],
        estimatedTime: `${Math.max(15, frs.length * 10)}-${Math.max(25, frs.length * 15)} minutes`,
        tags: ["backend", "api", category.toLowerCase()],
        prerequisites: [{ stepNumber: dataStep, description: "Database schema exists with required tables", verificationCheck: "Query tables and confirm they exist with correct columns" }],
        verificationCheckpoint: {
          whatToVerify: `All ${category} API endpoints respond correctly`,
          successCriteria: frs.map(fr => fr.acceptanceCriteria[0] || `${fr.title} works correctly`).join(". "),
          whenToStop: "If database operations fail or validation doesn't catch invalid data",
        },
        failureRecovery: [
          { symptom: "Foreign key constraint error", likelyCause: "Referenced record doesn't exist", recoveryAction: "Ensure parent records exist before creating child records. Check cascade settings.", shouldRetry: true },
          { symptom: "Validation passes invalid data", likelyCause: "Schema not strict enough", recoveryAction: "Add .strict() to Zod schema. Ensure schema.parse() is called before database operations.", shouldRetry: true },
        ],
        scopeGuardrails: [
          "Do NOT create frontend UI",
          ...apiGuardrails.slice(0, 2),
        ],
      });
      stepNum++;
    }

    if (steps.length === 0) {
      const reqsCovered: string[] = highFRs.map(fr => fr.id);
      let prompt = `Implement the core backend API for "${doc.ideaTitle}".\n\n`;

      if (highFRs.length > 0) {
        prompt += `## Requirements:\n`;
        for (const fr of highFRs) {
          prompt += `- **${fr.id}: ${fr.title}** - ${fr.description}\n`;
          if (fr.acceptanceCriteria.length > 0) {
            prompt += `  Acceptance Criteria: ${fr.acceptanceCriteria.join("; ")}\n`;
          }
        }
        prompt += `\n`;
      }

      if (endpoints.length > 0) {
        prompt += `## API Endpoints:\n`;
        for (const ep of endpoints) {
          prompt += `- **${ep.method} ${ep.path}**: ${ep.description}\n`;
        }
      }

      prompt += `\nAll endpoints should require authentication and include proper error handling.\nDo NOT create any frontend UI yet.`;

      steps.push({
        step: stepNum,
        title: "Core API Backend",
        objective: "Implement core API endpoints",
        prompt,
        expectedOutcome: "Core API endpoints working and tested",
        waitInstruction: "STOP here. Test all API endpoints before proceeding.",
        requirementsCovered: reqsCovered,
        dependencies: [dataStep],
        estimatedTime: "20-30 minutes",
        tags: ["backend", "api"],
        verificationCheckpoint: {
          whatToVerify: "All API endpoints respond correctly",
          successCriteria: "CRUD operations work. Authentication enforced. Error responses correct.",
          whenToStop: "If endpoints return errors for valid requests",
        },
        failureRecovery: [
          { symptom: "API returns 500 errors", likelyCause: "Unhandled exception in route handler", recoveryAction: "Add try/catch blocks. Check database queries and validation.", shouldRetry: true },
        ],
        scopeGuardrails: ["Do NOT create frontend UI"],
      });
      stepNum++;
    }

    return steps;
  }

  private generateUISteps(
    stepNum: number,
    doc: RequirementsDocument,
    highFRs: FunctionalRequirement[],
    medFRs: FunctionalRequirement[],
    lastApiStep: number,
    archStep: number,
    guardrails: string[]
  ): BuildPrompt[] {
    const steps: BuildPrompt[] = [];

    const layoutStep: BuildPrompt = {
      step: stepNum,
      title: "Frontend Layout & Navigation",
      objective: "Set up frontend routing, layouts, and core UI components",
      prompt: this.buildLayoutPrompt(doc),
      expectedOutcome: "Frontend routes and layouts working with navigation",
      waitInstruction: "STOP here. Verify all routes work and navigation is functional before proceeding.",
      requirementsCovered: doc.nonFunctionalRequirements.filter(n => n.category === "usability").map(n => n.id),
      dependencies: [archStep],
      estimatedTime: "15-20 minutes",
      tags: ["frontend", "layout", "routing"],
      verificationCheckpoint: {
        whatToVerify: "All routes accessible and layouts render correctly",
        successCriteria: "Navigate to each route without errors. Theme toggle works if applicable.",
        whenToStop: "If router throws errors or layouts break on route change",
      },
      failureRecovery: [
        { symptom: "Routes show blank page", likelyCause: "Router not configured correctly", recoveryAction: "Ensure RouterProvider wraps the app. Check route paths.", shouldRetry: true },
      ],
      scopeGuardrails: [
        "Do NOT implement business logic",
        "Do NOT add API calls yet",
        ...guardrails.filter(g => g.toLowerCase().includes("ui") || g.toLowerCase().includes("frontend")).slice(0, 2),
      ],
    };
    steps.push(layoutStep);
    stepNum++;

    const allFeatureFRs = [...highFRs, ...medFRs];
    const featureGroups = this.groupFRsByCategory(allFeatureFRs);

    for (const [category, frs] of Object.entries(featureGroups)) {
      const reqsCovered = frs.map(fr => fr.id);

      let prompt = `Implement the ${category} feature UI for "${doc.ideaTitle}".\n\n`;
      prompt += `## Requirements:\n`;
      for (const fr of frs) {
        prompt += `\n### ${fr.id}: ${fr.title}\n${fr.description}\n`;
        if (fr.acceptanceCriteria.length > 0) {
          prompt += `Acceptance Criteria:\n${fr.acceptanceCriteria.map(ac => `- ${ac}`).join("\n")}\n`;
        }
      }

      const relFlows = doc.uiuxPrinciples.userFlows.filter(f =>
        frs.some(fr => f.name.toLowerCase().includes(fr.category.toLowerCase()) || f.name.toLowerCase().includes(fr.title.toLowerCase().split(" ")[0]))
      );
      if (relFlows.length > 0) {
        prompt += `\n## User Flows:\n`;
        for (const flow of relFlows) {
          prompt += `### ${flow.name}\n${flow.description}\nSteps: ${flow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
        }
      }

      prompt += `\nConnect to the backend API endpoints. Handle loading, error, and empty states.`;

      steps.push({
        step: stepNum,
        title: `${category} Feature UI`,
        objective: `Implement UI for ${frs.length} ${category} requirement(s)`,
        prompt,
        expectedOutcome: `${category} features accessible and functional through the UI`,
        waitInstruction: `STOP here. Test the ${category} feature flow through the UI before proceeding.`,
        requirementsCovered: reqsCovered,
        dependencies: [lastApiStep, steps[steps.length - 1].step],
        estimatedTime: `${Math.max(15, frs.length * 8)}-${Math.max(25, frs.length * 12)} minutes`,
        tags: ["frontend", "feature", category.toLowerCase()],
        verificationCheckpoint: {
          whatToVerify: `${category} features work end-to-end`,
          successCriteria: frs.map(fr => fr.acceptanceCriteria[0] || `${fr.title} works via UI`).join(". "),
          whenToStop: "If API calls fail or UI doesn't render correctly",
        },
        failureRecovery: [
          { symptom: "API calls return CORS errors", likelyCause: "Backend CORS not configured", recoveryAction: "Add CORS middleware to Express with appropriate origin.", shouldRetry: true },
          { symptom: "Data doesn't update after mutations", likelyCause: "Query cache not invalidated", recoveryAction: "Add queryClient.invalidateQueries in mutation onSuccess callback.", shouldRetry: true },
        ],
        scopeGuardrails: guardrails.filter(g => g.toLowerCase().includes("ui") || g.toLowerCase().includes("feature")).slice(0, 3),
      });
      stepNum++;
    }

    if (Object.keys(featureGroups).length === 0) {
      const allFrIds = [...highFRs, ...medFRs].map(fr => fr.id);
      steps.push({
        step: stepNum,
        title: "Core Feature UI",
        objective: "Implement the main feature interface",
        prompt: `Implement the core feature UI for "${doc.ideaTitle}".\n\nConnect to backend API. Handle loading, error, and empty states.`,
        expectedOutcome: "Core features accessible through the UI",
        waitInstruction: "STOP here. Test the feature flow through the UI.",
        requirementsCovered: allFrIds,
        dependencies: [lastApiStep, steps[steps.length - 1].step],
        estimatedTime: "20-30 minutes",
        tags: ["frontend", "feature"],
        verificationCheckpoint: {
          whatToVerify: "Core features work end-to-end",
          successCriteria: "Features are accessible, data flows correctly between frontend and backend",
          whenToStop: "If critical features don't render or API integration fails",
        },
        failureRecovery: [],
        scopeGuardrails: [],
      });
      stepNum++;
    }

    return steps;
  }

  private generateSecurityStep(stepNum: number, doc: RequirementsDocument, secNFRs: NonFunctionalRequirement[], lastStep: number, guardrails: string[]): BuildPrompt {
    const reqsCovered = secNFRs.map(n => n.id);

    let prompt = `Implement security hardening for "${doc.ideaTitle}".\n\n`;

    if (doc.securityConsiderations.length > 0) {
      prompt += `## Security Considerations:\n`;
      for (const sc of doc.securityConsiderations) {
        prompt += `\n### ${sc.title} (${sc.category}, Priority: ${sc.priority})\n${sc.description}\n**Implementation:** ${sc.implementation}\n`;
      }
    }

    if (secNFRs.length > 0) {
      prompt += `\n## Security/Compliance Requirements:\n`;
      for (const nfr of secNFRs) {
        prompt += `- **${nfr.id}:** ${nfr.description}\n`;
      }
    }

    prompt += `\nImplement the above security measures. Review OWASP Top 10 checklist.`;

    return {
      step: stepNum,
      title: "Security & Compliance",
      objective: `Implement ${doc.securityConsiderations.length} security considerations and ${secNFRs.length} compliance requirements`,
      prompt,
      expectedOutcome: "Security measures implemented and verified",
      waitInstruction: "STOP here. Run a security audit before proceeding.",
      requirementsCovered: reqsCovered,
      dependencies: [lastStep],
      estimatedTime: "15-25 minutes",
      tags: ["security", "compliance"],
      verificationCheckpoint: {
        whatToVerify: "Security headers present, authentication enforced, input validation working",
        successCriteria: "Check response headers. Verify protected routes reject unauthenticated requests. Test input sanitization.",
        whenToStop: "If security measures break existing functionality",
      },
      failureRecovery: [
        { symptom: "CSP blocks inline styles or scripts", likelyCause: "CSP too restrictive", recoveryAction: "Adjust CSP directives. Use nonce for inline scripts if needed.", shouldRetry: true },
        { symptom: "Rate limiting triggers on normal use", likelyCause: "Limits too aggressive", recoveryAction: "Increase limits for standard endpoints. Use sliding window.", shouldRetry: true },
      ],
      scopeGuardrails: guardrails.filter(g => g.toLowerCase().includes("security") || g.toLowerCase().includes("auth")).slice(0, 3),
    };
  }

  private generatePerformanceStep(stepNum: number, doc: RequirementsDocument, perfNFRs: NonFunctionalRequirement[], lastStep: number, guardrails: string[]): BuildPrompt {
    const reqsCovered = perfNFRs.map(n => n.id);

    let prompt = `Implement performance optimizations for "${doc.ideaTitle}".\n\n`;
    prompt += `## Performance Requirements:\n`;
    for (const nfr of perfNFRs) {
      prompt += `- **${nfr.id}:** ${nfr.description}${nfr.target ? ` (Target: ${nfr.target})` : ""}\n`;
    }

    prompt += `\nOptimize the application to meet these targets. Focus on:\n`;
    prompt += `- Database query optimization\n- Frontend bundle optimization\n- Caching strategies\n- Loading state improvements\n`;

    return {
      step: stepNum,
      title: "Performance & Optimization",
      objective: `Meet ${perfNFRs.length} performance/scalability requirements`,
      prompt,
      expectedOutcome: "Application meets performance targets",
      waitInstruction: "STOP here. Verify performance improvements before proceeding.",
      requirementsCovered: reqsCovered,
      dependencies: [lastStep],
      estimatedTime: "15-25 minutes",
      tags: ["performance", "optimization"],
      verificationCheckpoint: {
        whatToVerify: "Performance targets are met",
        successCriteria: perfNFRs.map(n => n.description).join(". "),
        whenToStop: "If optimizations introduce regressions",
      },
      failureRecovery: [
        { symptom: "Optimization causes visual regression", likelyCause: "Lazy loading or code splitting breaks component", recoveryAction: "Add Suspense boundaries. Ensure critical CSS is not deferred.", shouldRetry: true },
      ],
      scopeGuardrails: guardrails.filter(g => g.toLowerCase().includes("performance") || g.toLowerCase().includes("optimization")).slice(0, 2),
    };
  }

  private generateFinalStep(stepNum: number, doc: RequirementsDocument, lastStep: number, guardrails: string[]): BuildPrompt {
    const uncoveredNFRs = doc.nonFunctionalRequirements.filter(n =>
      n.category === "usability" || n.category === "maintainability"
    );
    const reqsCovered = uncoveredNFRs.map(n => n.id);

    let prompt = `Polish and finalize "${doc.ideaTitle}".\n\n`;
    prompt += `## Final Checklist:\n`;
    prompt += `1. Error handling: Global error boundary, user-friendly messages, 404 page\n`;
    prompt += `2. Loading states: Skeleton loaders, button loading states\n`;
    prompt += `3. Accessibility: Keyboard navigation, ARIA labels, color contrast\n`;
    prompt += `4. Responsive design: Mobile-friendly layouts\n`;

    if (doc.uiuxPrinciples.accessibilityRequirements.length > 0) {
      prompt += `\n## Accessibility Requirements:\n`;
      for (const req of doc.uiuxPrinciples.accessibilityRequirements) {
        prompt += `- ${req}\n`;
      }
    }

    if (uncoveredNFRs.length > 0) {
      prompt += `\n## Remaining NFRs:\n`;
      for (const nfr of uncoveredNFRs) {
        prompt += `- ${nfr.description}\n`;
      }
    }

    prompt += `\nTest the application thoroughly. The application is now ready for deployment.`;

    return {
      step: stepNum,
      title: "Polish, Testing & Deployment Readiness",
      objective: "Add finishing touches, error handling, accessibility, and prepare for deployment",
      prompt,
      expectedOutcome: "Application handles all edge cases gracefully and is deployment-ready",
      waitInstruction: "COMPLETE! The application is ready for deployment.",
      requirementsCovered: reqsCovered,
      dependencies: [lastStep],
      estimatedTime: "20-30 minutes",
      tags: ["polish", "testing", "deployment"],
      verificationCheckpoint: {
        whatToVerify: "Application handles errors gracefully and works on mobile",
        successCriteria: "Error boundary catches crashes. 404 page works. Mobile navigation functional. Keyboard accessible.",
        whenToStop: "If errors cause white screen or mobile layout is broken",
      },
      failureRecovery: [
        { symptom: "Error boundary shows for minor errors", likelyCause: "Error boundary too high in component tree", recoveryAction: "Move error boundary closer to error-prone components.", shouldRetry: true },
      ],
      scopeGuardrails: [
        "Do NOT set up CI/CD pipelines",
        "Do NOT add monitoring/alerting",
        ...guardrails.slice(0, 2),
      ],
    };
  }

  private buildLayoutPrompt(doc: RequirementsDocument): string {
    let prompt = `Set up the frontend foundation for "${doc.ideaTitle}".\n\n`;

    prompt += `## Design System: ${doc.uiuxPrinciples.designSystem || "Component-based"}\n\n`;

    if (doc.uiuxPrinciples.keyPrinciples.length > 0) {
      prompt += `## Design Principles:\n`;
      for (const p of doc.uiuxPrinciples.keyPrinciples) {
        prompt += `- **${p.principle}:** ${p.description}\n`;
      }
      prompt += `\n`;
    }

    prompt += `## Setup:\n`;
    prompt += `1. Configure client-side routing\n`;
    prompt += `2. Create layout components (header, sidebar, main content)\n`;
    prompt += `3. Set up theme (light/dark mode)\n`;
    prompt += `4. Create core UI components\n\n`;

    if (doc.uiuxPrinciples.userFlows.length > 0) {
      prompt += `## User Flows (routes to create):\n`;
      for (const flow of doc.uiuxPrinciples.userFlows) {
        prompt += `- ${flow.name}: ${flow.description}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Do NOT implement any business logic or API calls yet.`;
    return prompt;
  }

  private groupFRsByCategory(frs: FunctionalRequirement[]): Record<string, FunctionalRequirement[]> {
    const groups: Record<string, FunctionalRequirement[]> = {};
    for (const fr of frs) {
      const cat = fr.category || "Core";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(fr);
    }
    return groups;
  }

  private findRelevantEndpoints(endpoints: APIEndpoint[], frs: FunctionalRequirement[]): APIEndpoint[] {
    if (endpoints.length === 0 || frs.length === 0) return endpoints;

    const keywords = frs.flatMap(fr => [
      ...fr.title.toLowerCase().split(/\s+/),
      ...fr.category.toLowerCase().split(/\s+/),
    ]).filter(w => w.length > 3);

    return endpoints.filter(ep => {
      const epText = `${ep.path} ${ep.description}`.toLowerCase();
      return keywords.some(kw => epText.includes(kw));
    });
  }

  private adaptPromptForIDE(prompt: BuildPrompt, ide: IDEType): BuildPrompt {
    const adapted = { ...prompt };

    switch (ide) {
      case "replit":
        adapted.prompt = this.adaptForReplit(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Check the Replit preview panel to verify.`;
        break;
      case "cursor":
        adapted.prompt = this.adaptForCursor(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Use Cursor's terminal to verify.`;
        break;
      case "lovable":
        adapted.prompt = this.adaptForLovable(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Check the Lovable preview.`;
        break;
      case "antigravity":
        adapted.prompt = this.adaptForAntigravity(prompt.prompt);
        break;
      case "warp":
        adapted.prompt = this.adaptForWarp(prompt.prompt);
        adapted.waitInstruction = `${prompt.waitInstruction} Verify in your code editor.`;
        break;
      case "other":
      default:
        break;
    }

    return adapted;
  }

  private adaptForReplit(prompt: string): string {
    return `[REPLIT AGENT PROMPT]\n\n${prompt}\n\nREPLIT-SPECIFIC NOTES:\n- Use the Replit database integration if available\n- The server should bind to 0.0.0.0:5000\n- Use the packager tool for dependencies\n- Workflows will auto-restart after changes`;
  }

  private adaptForCursor(prompt: string): string {
    return `[CURSOR PROMPT]\n\n${prompt}\n\nCURSOR-SPECIFIC NOTES:\n- Use @codebase to reference existing code\n- Use Cmd+K for inline edits\n- Use the Composer for multi-file changes\n- Run terminal commands as needed`;
  }

  private adaptForLovable(prompt: string): string {
    return `[LOVABLE PROMPT]\n\n${prompt}\n\nLOVABLE-SPECIFIC NOTES:\n- Focus on UI components first\n- Use Lovable's component library\n- Preview changes in real-time\n- Backend may need separate setup`;
  }

  private adaptForAntigravity(prompt: string): string {
    return `[ANTIGRAVITY PROMPT]\n\n${prompt}\n\nANTIGRAVITY-SPECIFIC NOTES:\n- Use natural language descriptions\n- Let the AI handle file organization\n- Review generated code carefully`;
  }

  private adaptForWarp(prompt: string): string {
    return `[WARP + CODE EDITOR PROMPT]\n\n${prompt}\n\nWARP-SPECIFIC NOTES:\n- Use Warp AI for command suggestions\n- Use blocks for organized terminal output\n- Pair with your preferred code editor\n- Use Warp's workflows for repetitive tasks`;
  }

  private calculateTotalTime(prompts: BuildPrompt[]): string {
    let minTotal = 0;
    let maxTotal = 0;

    for (const prompt of prompts) {
      if (prompt.estimatedTime) {
        const match = prompt.estimatedTime.match(/(\d+)-(\d+)/);
        if (match) {
          minTotal += parseInt(match[1]);
          maxTotal += parseInt(match[2]);
        }
      }
    }

    const minHours = Math.floor(minTotal / 60);
    const maxHours = Math.floor(maxTotal / 60);

    if (minHours > 0) {
      return `${minHours}-${maxHours} hours`;
    }
    return `${minTotal}-${maxTotal} minutes`;
  }

  private generateSummary(ideaTitle: string, ide: IDEType, stepCount: number): string {
    return `This document contains ${stepCount} sequential prompts for building "${ideaTitle}" using ${this.ideNames[ide]}. Each prompt is derived from the requirements document and includes prerequisites, verification checkpoints, failure recovery guidance, scope guardrails, and requirement traceability. Prompts are copy-paste ready, dependency-aware, and failure-safe.`;
  }

  private formatPromptContent(prompt: BuildPrompt): string {
    let content = `**Objective:** ${prompt.objective}\n**Estimated Time:** ${prompt.estimatedTime || "15-20 minutes"}\n`;

    if (prompt.requirementsCovered && prompt.requirementsCovered.length > 0) {
      content += `**Requirements Covered:** ${prompt.requirementsCovered.join(", ")}\n`;
    }

    if (prompt.dependencies && prompt.dependencies.length > 0) {
      content += `**Dependencies:** Steps ${prompt.dependencies.join(", ")}\n`;
    }

    if (prompt.prerequisites && prompt.prerequisites.length > 0) {
      content += `\n### Prerequisites\n`;
      content += `Before starting this step, verify:\n\n`;
      for (const prereq of prompt.prerequisites) {
        content += `- **Step ${prereq.stepNumber}:** ${prereq.description}\n`;
        content += `  - *Check:* ${prereq.verificationCheck}\n`;
      }
    }

    content += `\n---\n\n### Prompt\n\n\`\`\`\n${prompt.prompt}\n\`\`\`\n`;

    if (prompt.scopeGuardrails && prompt.scopeGuardrails.length > 0) {
      content += `\n### Scope Guardrails\n`;
      content += `**What NOT to do in this step:**\n\n`;
      for (const guardrail of prompt.scopeGuardrails) {
        content += `- ${guardrail}\n`;
      }
    }

    if (prompt.stopConditions && prompt.stopConditions.length > 0) {
      content += `\n### Stop Conditions\n`;
      for (const cond of prompt.stopConditions) {
        content += `- ${cond}\n`;
      }
    }

    content += `\n### Expected Outcome\n${prompt.expectedOutcome}\n`;

    if (prompt.verificationCheckpoint) {
      content += `\n### Verification Checkpoint\n`;
      content += `**What to verify:** ${prompt.verificationCheckpoint.whatToVerify}\n\n`;
      content += `**Success looks like:** ${prompt.verificationCheckpoint.successCriteria}\n\n`;
      content += `**When to stop:** ${prompt.verificationCheckpoint.whenToStop}\n`;
    }

    if (prompt.failureRecovery && prompt.failureRecovery.length > 0) {
      content += `\n### If This Fails\n`;
      for (const failure of prompt.failureRecovery) {
        content += `\n**Symptom:** ${failure.symptom}\n`;
        content += `- *Likely cause:* ${failure.likelyCause}\n`;
        content += `- *Recovery:* ${failure.recoveryAction}\n`;
        content += `- *Action:* ${failure.shouldRetry ? "Fix and retry this step" : "Roll back and investigate"}\n`;
      }
    }

    content += `\n### ${prompt.waitInstruction}`;

    return content;
  }

  private async saveAsArtifact(document: PromptDocument) {
    const sections = [
      {
        heading: "Overview",
        level: 2 as const,
        content: `${document.summary}\n\n**Total Steps:** ${document.totalSteps}\n**Estimated Time:** ${document.estimatedTotalTime}\n**Target IDE:** ${document.ideName}\n**Source:** ${document.ideaTitle}`,
      },
      {
        heading: "Instructions",
        level: 2 as const,
        content: `1. Copy each prompt exactly as written\n2. Paste into your ${document.ideName} AI assistant\n3. Wait for the AI to complete the task\n4. Verify the expected outcome\n5. Follow the STOP/WAIT instruction before proceeding\n6. Only move to the next step after verification\n\n**Important:** Do not skip steps. Each prompt builds on the previous one.`,
      },
      ...document.prompts.map((prompt) => ({
        heading: `Step ${prompt.step}: ${prompt.title}`,
        level: 2 as const,
        content: this.formatPromptContent(prompt),
      })),
      {
        heading: "Completion Checklist",
        level: 2 as const,
        content: document.prompts.map((p) => `- [ ] Step ${p.step}: ${p.title}`).join("\n"),
      },
    ];

    const stage: PipelineStage = "PROMPTS_GENERATED";
    const artifact = await artifactService.create({
      title: `Build Prompts: ${document.ideaTitle} (${document.ideName})`,
      module: "prompts",
      sections,
      aiNotes: [
        {
          provider: "system",
          note: `Generated ${document.totalSteps} requirements-driven prompts for ${document.ideName}`,
          confidence: 0.95,
        },
      ],
      tags: ["prompts", "build", document.ide, "executable", "requirements-driven"],
      stage,
      sourceArtifactId: document.requirementsArtifactId,
      sourceArtifactVersion: document.sourceArtifactVersion,
    });

    return artifact;
  }

  getDefaultStepPrompt(stepNumber: number): BuildPrompt {
    return {
      step: stepNumber,
      title: `Step ${stepNumber}`,
      objective: "Complete this step of the build process",
      prompt: "",
      expectedOutcome: "Step completes successfully",
      waitInstruction: "STOP and verify before proceeding",
      requirementsCovered: [],
      dependencies: [],
      failureRecovery: [
        { symptom: "npm install fails with dependency conflicts", likelyCause: "Incompatible package versions or corrupt cache", recoveryAction: "Delete node_modules and package-lock.json, then run npm install again.", shouldRetry: true },
        { symptom: "TypeScript compilation errors", likelyCause: "Missing or misconfigured tsconfig.json", recoveryAction: "Ensure tsconfig.json exists with correct compiler options.", shouldRetry: true },
        { symptom: "Port already in use error", likelyCause: "Another process is using the port", recoveryAction: "Kill the process using the port or configure a different port.", shouldRetry: true },
        { symptom: "Database connection refused", likelyCause: "Database not running or connection string incorrect", recoveryAction: "Verify DATABASE_URL is set correctly.", shouldRetry: true },
      ],
    };
  }

  private parseFRsFromMarkdown(content: string): FunctionalRequirement[] {
    const frs: FunctionalRequirement[] = [];
    const frPattern = /###\s*(FR-\d+):\s*(.+?)(?=\n###|\n---|\n##|$)/gm;
    let match;
    while ((match = frPattern.exec(content)) !== null) {
      const id = match[1];
      const block = match[2];
      const titleMatch = block.match(/^(.+?)(?:\n|$)/);
      const title = titleMatch ? titleMatch[1].trim() : "Untitled";
      const catMatch = block.match(/\*\*Category:\*\*\s*(.+?)(?:\||$)/);
      const priMatch = block.match(/\*\*Priority:\*\*\s*(.+?)(?:\n|$)/);
      const descLines = block.split("\n").filter(l => l.trim() && !l.startsWith("**") && !l.startsWith("- "));
      const acMatch = block.match(/Acceptance Criteria:([\s\S]*?)(?=\n\*\*|\n###|$)/);
      const acceptanceCriteria = acMatch
        ? acMatch[1].split("\n").filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim())
        : [];

      frs.push({
        id,
        category: catMatch ? catMatch[1].trim() : "General",
        title,
        description: descLines.slice(1).join(" ").trim() || title,
        priority: (priMatch ? priMatch[1].trim() : "Medium") as FunctionalRequirement["priority"],
        acceptanceCriteria,
      });
    }
    return frs;
  }

  private parseNFRsFromMarkdown(content: string): NonFunctionalRequirement[] {
    const nfrs: NonFunctionalRequirement[] = [];
    const rows = content.match(/\|\s*(NFR-\d+)\s*\|(.+?)\|(.+?)\|(.+?)\|/g);
    if (rows) {
      for (const row of rows) {
        const cols = row.split("|").filter(c => c.trim());
        if (cols.length >= 4) {
          nfrs.push({
            id: cols[0].trim(),
            category: cols[1].trim().toLowerCase() as NonFunctionalRequirement["category"],
            title: cols[2].trim(),
            description: cols[3].trim(),
          });
        }
      }
    }
    return nfrs;
  }

  private parseArchitectureFromMarkdown(content: string): RequirementsDocument["architecture"] {
    const patternMatch = content.match(/\*\*Pattern:\*\*\s*(.+?)(?:\n|$)/);
    return {
      pattern: patternMatch ? patternMatch[1].trim() : "Modular",
      description: content.split("\n").find(l => l.trim() && !l.startsWith("**") && !l.startsWith("#")) || "",
      components: [],
      dataFlow: "",
    };
  }

  private parseArchDecisionsFromMarkdown(content: string): ArchitectureDecision[] {
    const decisions: ArchitectureDecision[] = [];
    const adPattern = /###\s*(AD-\d+):\s*(.+?)(?=\n###|$)/gm;
    let match;
    while ((match = adPattern.exec(content)) !== null) {
      const block = match[2];
      const decMatch = block.match(/\*\*Decision:\*\*\s*(.+?)(?:\n|$)/);
      const ratMatch = block.match(/\*\*Rationale:\*\*\s*(.+?)(?:\n|$)/);
      decisions.push({
        id: match[1],
        title: block.split("\n")[0]?.trim() || "",
        decision: decMatch ? decMatch[1].trim() : "",
        rationale: ratMatch ? ratMatch[1].trim() : "",
      });
    }
    return decisions;
  }

  private parseDataModelsFromMarkdown(content: string): DataModelEntity[] {
    const entities: DataModelEntity[] = [];
    const entityPattern = /###\s*(.+?)(?:\n|$)([\s\S]*?)(?=\n###|$)/g;
    let match;
    while ((match = entityPattern.exec(content)) !== null) {
      const name = match[1].trim();
      if (name === "Cross-Entity Relationships" || name.startsWith("|")) continue;
      entities.push({
        name,
        description: "",
        fields: [],
      });
    }
    return entities;
  }

  private parseAPIFromMarkdown(content: string): RequirementsDocument["apiContracts"] {
    const baseMatch = content.match(/\*\*Base URL:\*\*\s*`?(.+?)`?(?:\n|$)/);
    return {
      baseUrl: baseMatch ? baseMatch[1].trim() : "/api/v1",
      version: "1.0.0",
      authentication: "Bearer token",
      endpoints: [],
    };
  }

  private parseSecurityFromMarkdown(content: string): SecurityConsideration[] {
    return [];
  }

  private parseOutOfScopeFromMarkdown(content: string): OutOfScopeItem[] {
    const items: OutOfScopeItem[] = [];
    const lines = content.split("\n").filter(l => l.trim().startsWith("-"));
    let counter = 1;
    for (const line of lines) {
      const match = line.match(/-\s*\*\*(?:OOS-\d+:\s*)?(.+?)\*\*\s*[-—]\s*(.+?)(?:\s*\*\(.*?\)\*)?$/);
      if (match) {
        items.push({
          id: `OOS-${String(counter).padStart(3, "0")}`,
          item: match[1].trim(),
          reason: match[2].trim(),
          futureConsideration: line.includes("future consideration"),
        });
        counter++;
      }
    }
    return items;
  }

  private parseSystemOverviewFromMarkdown(content: string): RequirementsDocument["systemOverview"] {
    const purposeMatch = content.match(/\*\*Purpose:\*\*\s*(.+?)(?:\n|$)/);
    const userMatch = content.match(/\*\*Core User:\*\*\s*(.+?)(?:\n|$)/);
    const outcomeMatch = content.match(/\*\*Primary Outcome:\*\*\s*(.+?)(?:\n|$)/);
    return {
      purpose: purposeMatch ? purposeMatch[1].trim() : "",
      coreUser: userMatch ? userMatch[1].trim() : "",
      primaryOutcome: outcomeMatch ? outcomeMatch[1].trim() : "",
    };
  }

  private parseUIUXFromMarkdown(content: string): RequirementsDocument["uiuxPrinciples"] {
    return {
      designSystem: "",
      keyPrinciples: [],
      userFlows: [],
      accessibilityRequirements: [],
    };
  }
}

export const promptsService = new PromptsService();
