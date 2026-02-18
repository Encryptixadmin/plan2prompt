import type {
  CreateClarificationRequest,
  ClarificationDetectionResult,
} from "@shared/types/clarification";
import type { RequirementsDocument } from "@shared/types/requirements";
import type { PromptDocument } from "@shared/types/prompts";

export class ClarificationDetectionService {
  detectRequirementsGaps(
    doc: RequirementsDocument,
    ideaArtifactId: string,
    projectId: string
  ): ClarificationDetectionResult {
    const contracts: CreateClarificationRequest[] = [];
    const artifactId = doc.artifactId || doc.id;

    if (doc.functionalRequirements.length === 0) {
      contracts.push({
        projectId,
        originatingModule: "requirements",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: ideaArtifactId,
        upstreamArtifactVersion: 1,
        severity: "blocker",
        category: "missing_information",
        title: "No functional requirements generated",
        description: "The requirements document has zero functional requirements. The idea may lack sufficient detail to derive concrete features.",
        affectedEntities: { requirementIds: [] },
        requiredClarifications: [{
          field: "core_features",
          question: "What are the core features this application must provide?",
          expectedAnswerType: "long_text",
        }],
      });
    }

    if (doc.dataModels.length === 0 && (!doc.dataModel?.entities || doc.dataModel.entities.length === 0)) {
      contracts.push({
        projectId,
        originatingModule: "requirements",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: ideaArtifactId,
        upstreamArtifactVersion: 1,
        severity: "advisory",
        category: "data_model_gap",
        title: "No data model entities defined",
        description: "The requirements document has no data model entities. This may indicate the idea description lacks information about what data the system manages.",
        requiredClarifications: [{
          field: "data_entities",
          question: "What types of data will this application store and manage?",
          expectedAnswerType: "long_text",
        }],
      });
    }

    if (doc.architectureDecisions && doc.architectureDecisions.length === 0) {
      contracts.push({
        projectId,
        originatingModule: "requirements",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: ideaArtifactId,
        upstreamArtifactVersion: 1,
        severity: "advisory",
        category: "architecture_gap",
        title: "No architecture decisions documented",
        description: "No architecture decisions were generated. Key technical choices (database type, authentication method, deployment target) are undefined.",
        requiredClarifications: [{
          field: "tech_stack",
          question: "Are there preferred technologies or architectural patterns for this project?",
          expectedAnswerType: "long_text",
        }],
      });
    }

    const secNFRs = doc.nonFunctionalRequirements.filter(n => n.category === "compliance");
    const complianceItems = secNFRs.filter(n => n.description && !n.description.toLowerCase().includes("none identified"));
    if (complianceItems.length > 0 && doc.securityConsiderations.length === 0) {
      contracts.push({
        projectId,
        originatingModule: "requirements",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: ideaArtifactId,
        upstreamArtifactVersion: 1,
        severity: "advisory",
        category: "regulatory_gap",
        title: "Compliance requirements without security implementation",
        description: `Compliance requirements exist (${complianceItems.map(c => c.title).join(", ")}) but no security considerations address them.`,
        affectedEntities: { requirementIds: complianceItems.map(c => c.id) },
        requiredClarifications: [{
          field: "compliance_details",
          question: "What specific compliance standards or regulations must this application meet?",
          expectedAnswerType: "long_text",
        }],
      });
    }

    const unmitigated = (doc.riskTraceability || []).filter(r => r.coverageStatus === "unmitigated");
    if (unmitigated.length >= 2) {
      contracts.push({
        projectId,
        originatingModule: "requirements",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: ideaArtifactId,
        upstreamArtifactVersion: 1,
        severity: "advisory",
        category: "scope_conflict",
        title: `${unmitigated.length} unmitigated risks remain`,
        description: `The following risks from idea analysis have no requirement coverage: ${unmitigated.map(r => r.riskDescription).join("; ")}`,
        affectedEntities: { ideaRiskIds: unmitigated.map(r => r.riskId) },
        requiredClarifications: [{
          field: "risk_acceptance",
          question: "Should these unmitigated risks be accepted, or should additional requirements be created to address them?",
          expectedAnswerType: "select",
          options: ["Accept risks as-is", "Create additional requirements", "Revise the idea to remove these risks"],
        }],
      });
    }

    return {
      hasBlockers: contracts.some(c => c.severity === "blocker"),
      contracts,
    };
  }

  detectPromptGaps(
    doc: PromptDocument,
    requirementsArtifactId: string,
    projectId: string
  ): ClarificationDetectionResult {
    const contracts: CreateClarificationRequest[] = [];
    const artifactId = doc.artifactId || doc.id;

    if (doc.prompts.length === 0) {
      contracts.push({
        projectId,
        originatingModule: "prompts",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: requirementsArtifactId,
        upstreamArtifactVersion: 1,
        severity: "blocker",
        category: "missing_information",
        title: "No build prompts generated",
        description: "Zero build prompts were generated from the requirements document. The requirements may lack sufficient structure.",
        requiredClarifications: [{
          field: "requirements_structure",
          question: "Does the requirements document contain functional requirements and architecture decisions?",
          expectedAnswerType: "boolean",
        }],
      });
      return { hasBlockers: true, contracts };
    }

    const allReqsCovered = doc.prompts.flatMap(p => p.requirementsCovered || []);
    const hasDataStep = doc.prompts.some(p => 
      p.tags?.includes("database") || p.tags?.includes("schema") ||
      p.title.toLowerCase().includes("database") || p.title.toLowerCase().includes("data model")
    );
    const hasAuthCoverage = doc.prompts.some(p =>
      p.title.toLowerCase().includes("auth") || 
      (p.requirementsCovered || []).some(r => r.toLowerCase().includes("auth")) ||
      p.prompt.toLowerCase().includes("authentication")
    );

    if (!hasDataStep) {
      contracts.push({
        projectId,
        originatingModule: "prompts",
        currentArtifactId: artifactId,
        currentArtifactVersion: 1,
        upstreamArtifactId: requirementsArtifactId,
        upstreamArtifactVersion: 1,
        severity: "advisory",
        category: "data_model_gap",
        title: "No database setup step in build prompts",
        description: "The generated prompts do not include a database schema setup step. If the application requires persistent storage, this is a gap.",
        requiredClarifications: [{
          field: "needs_database",
          question: "Does this application require a database for persistent storage?",
          expectedAnswerType: "boolean",
        }],
      });
    }

    if (!hasAuthCoverage) {
      const hasSecurityReqs = doc.prompts.some(p =>
        p.tags?.includes("security") || p.title.toLowerCase().includes("security")
      );
      if (hasSecurityReqs) {
        contracts.push({
          projectId,
          originatingModule: "prompts",
          currentArtifactId: artifactId,
          currentArtifactVersion: 1,
          upstreamArtifactId: requirementsArtifactId,
          upstreamArtifactVersion: 1,
          severity: "advisory",
          category: "architecture_gap",
          title: "Security step exists but no authentication coverage",
          description: "Security-related build steps exist but none specifically address authentication. The requirements may reference authentication without specifying the approach.",
          requiredClarifications: [{
            field: "auth_approach",
            question: "What authentication method should this application use?",
            expectedAnswerType: "select",
            options: ["Email/password", "OAuth (Google, GitHub, etc.)", "API key", "No authentication needed"],
          }],
        });
      }
    }

    return {
      hasBlockers: contracts.some(c => c.severity === "blocker"),
      contracts,
    };
  }

  detectExecutionEscalation(
    failureHash: string,
    occurrenceCount: number,
    stepNumber: number,
    promptArtifactId: string,
    projectId: string
  ): CreateClarificationRequest | null {
    if (occurrenceCount < 3) return null;

    return {
      projectId,
      originatingModule: "execution",
      currentArtifactId: promptArtifactId,
      currentArtifactVersion: 1,
      upstreamArtifactId: promptArtifactId,
      upstreamArtifactVersion: 1,
      severity: "blocker",
      category: "execution_failure",
      title: `Repeated failure at step ${stepNumber} (${occurrenceCount} occurrences)`,
      description: `The same failure (hash: ${failureHash}) has occurred ${occurrenceCount} times at step ${stepNumber}. This suggests an issue in the upstream requirements or prompt that cannot be resolved by retrying.`,
      affectedEntities: { promptStepIds: [`step-${stepNumber}`] },
      requiredClarifications: [
        {
          field: "failure_action",
          question: `Step ${stepNumber} has failed ${occurrenceCount} times with the same error. What should be done?`,
          expectedAnswerType: "select",
          options: [
            "Regenerate requirements with more detail",
            "Regenerate prompts for a different IDE",
            "Skip this step and continue",
            "Revise the original idea",
          ],
        },
      ],
    };
  }
}

export const clarificationDetectionService = new ClarificationDetectionService();
