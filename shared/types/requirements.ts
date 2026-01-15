/**
 * Requirements Module Type Definitions
 * 
 * Types for converting validated ideas into structured requirements documents.
 */

// Functional requirement
export interface FunctionalRequirement {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "must-have" | "should-have" | "nice-to-have";
  acceptanceCriteria: string[];
  dependencies?: string[];
}

// Non-functional requirement
export interface NonFunctionalRequirement {
  id: string;
  category: "performance" | "security" | "scalability" | "reliability" | "usability" | "maintainability" | "compatibility";
  title: string;
  description: string;
  metric?: string;
  target?: string;
}

// Architecture component
export interface ArchitectureComponent {
  name: string;
  type: "frontend" | "backend" | "database" | "service" | "external" | "infrastructure";
  description: string;
  technologies?: string[];
  responsibilities: string[];
  interfaces?: string[];
}

// Architecture overview
export interface ArchitectureOverview {
  pattern: string;
  description: string;
  components: ArchitectureComponent[];
  dataFlow: string;
  deploymentNotes?: string;
}

// Data model entity
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

// API endpoint contract
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

// API contracts
export interface APIContracts {
  baseUrl: string;
  version: string;
  authentication: string;
  endpoints: APIEndpoint[];
}

// UI/UX principles
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

// Security consideration
export interface SecurityConsideration {
  category: "authentication" | "authorization" | "data-protection" | "input-validation" | "infrastructure" | "compliance";
  title: string;
  description: string;
  implementation: string;
  priority: "critical" | "high" | "medium" | "low";
}

// Complete requirements document
export interface RequirementsDocument {
  id: string;
  ideaArtifactId: string;
  ideaTitle: string;
  functionalRequirements: FunctionalRequirement[];
  nonFunctionalRequirements: NonFunctionalRequirement[];
  architecture: ArchitectureOverview;
  dataModels: DataModelEntity[];
  apiContracts: APIContracts;
  uiuxPrinciples: UIUXPrinciples;
  securityConsiderations: SecurityConsideration[];
  summary: string;
  version: string;
  createdAt: string;
  artifactId?: string;
}

// Requirements module API request
export interface GenerateRequirementsRequest {
  ideaArtifactId: string;
}

// Requirements module API response
export interface GenerateRequirementsResponse {
  requirements: RequirementsDocument;
  artifactPath: string;
}
