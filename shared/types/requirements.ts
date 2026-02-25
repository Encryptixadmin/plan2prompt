/**
 * Requirements Module Type Definitions
 * 
 * Types for converting validated ideas into structured requirements documents.
 */

export interface SystemOverview {
  purpose: string;
  coreUser: string;
  primaryOutcome: string;
}

export interface FunctionalRequirement {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "must-have" | "should-have" | "nice-to-have" | "High" | "Medium" | "Low";
  acceptanceCriteria: string[];
  dependencies?: string[];
  originatingRiskIds?: string[];
  originatingAssumptionIds?: string[];
}

export interface NonFunctionalRequirement {
  id: string;
  category: "performance" | "security" | "scalability" | "reliability" | "usability" | "maintainability" | "compatibility" | "compliance";
  title: string;
  description: string;
  metric?: string;
  target?: string;
}

export interface ArchitectureComponent {
  name: string;
  type: "frontend" | "backend" | "database" | "service" | "external" | "infrastructure";
  description: string;
  technologies?: string[];
  responsibilities: string[];
  interfaces?: string[];
}

export interface ArchitectureOverview {
  pattern: string;
  description: string;
  components: ArchitectureComponent[];
  dataFlow: string;
  deploymentNotes?: string;
}

export interface ArchitectureDecision {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  tradeoffs?: string;
}

export interface DataModelEntity {
  name: string;
  description: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    constraints?: string[];
  }[];
  relationships?: {
    entity: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
    description?: string;
  }[];
}

export interface DataModel {
  entities: DataModelEntity[];
  relationships: {
    from: string;
    to: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
    description?: string;
  }[];
}

export interface APIEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  authentication?: boolean;
  requestBody?: {
    contentType: string;
    schema: string;
  };
  responseBody?: {
    contentType: string;
    schema: string;
  };
  errorResponses?: {
    status: number;
    description: string;
  }[];
}

export interface APIContracts {
  baseUrl: string;
  version: string;
  authentication: string;
  endpoints: APIEndpoint[];
}

export interface UIUXPrinciples {
  designSystem: string;
  keyPrinciples: {
    principle: string;
    description: string;
  }[];
  userFlows: {
    name: string;
    description: string;
    steps: string[];
  }[];
  accessibilityRequirements: string[];
  responsiveBreakpoints?: string[];
}

export interface SecurityConsideration {
  category: "authentication" | "authorization" | "data-protection" | "input-validation" | "infrastructure" | "compliance";
  title: string;
  description: string;
  implementation: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface RequirementAssumption {
  id: string;
  category: "technical" | "user" | "operational" | "business" | "integration";
  statement: string;
  rationale: string;
  impact: string;
}

export interface OutOfScopeItem {
  id: string;
  item: string;
  reason: string;
  futureConsideration?: boolean;
}

export interface EdgeCaseFailureMode {
  id: string;
  scenario: string;
  category: "input" | "state" | "integration" | "resource" | "timing" | "user-behavior";
  likelihood: "rare" | "occasional" | "likely";
  expectedBehavior: string;
  recoveryAction?: string;
}

export interface ConfidenceNote {
  id: string;
  section: string;
  concern: string;
  confidenceLevel: "high" | "medium" | "low";
  reason: string;
  mitigationSuggestion?: string;
}

export interface RiskTraceabilityEntry {
  riskId: string;
  riskDescription: string;
  mitigationInRequirementIds: string[];
  coverageStatus: "fully-mitigated" | "partially-mitigated" | "unmitigated";
}

export interface RequirementsDocument {
  id: string;
  ideaArtifactId: string;
  ideaTitle: string;
  systemOverview?: SystemOverview;
  functionalRequirements: FunctionalRequirement[];
  nonFunctionalRequirements: NonFunctionalRequirement[];
  architecture: ArchitectureOverview;
  architectureDecisions?: ArchitectureDecision[];
  dataModels: DataModelEntity[];
  dataModel?: DataModel;
  apiContracts: APIContracts;
  uiuxPrinciples: UIUXPrinciples;
  securityConsiderations: SecurityConsideration[];
  assumptions: RequirementAssumption[];
  outOfScope: OutOfScopeItem[];
  edgeCasesAndFailureModes: EdgeCaseFailureMode[];
  confidenceNotes: ConfidenceNote[];
  riskTraceability?: RiskTraceabilityEntry[];
  summary: string;
  version: string;
  createdAt: string;
  artifactId?: string;
}

export interface GenerateRequirementsRequest {
  ideaArtifactId: string;
  clarificationContext?: string;
}

export interface GenerateRequirementsResponse {
  requirements: RequirementsDocument;
  artifactPath: string;
  clarifications?: any[];
}
