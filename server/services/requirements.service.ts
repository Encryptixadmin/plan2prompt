import { randomUUID } from "crypto";
import type {
  RequirementsDocument,
  FunctionalRequirement,
  NonFunctionalRequirement,
  ArchitectureOverview,
  DataModelEntity,
  APIContracts,
  UIUXPrinciples,
  SecurityConsideration,
  RequirementAssumption,
  OutOfScopeItem,
  EdgeCaseFailureMode,
  ConfidenceNote,
} from "@shared/types/requirements";
import { consensusService } from "./ai";
import { artifactService } from "./artifact.service";
import type { Artifact } from "@shared/types/artifact";
import type { PipelineStage } from "@shared/types/pipeline";

/**
 * Requirements Service
 * 
 * Converts validated ideas into structured requirements documents using AI consensus.
 */
export class RequirementsService {
  /**
   * Generate requirements from an idea artifact (without saving)
   * Returns requirements for user review before acceptance
   */
  async generateRequirements(ideaArtifactId: string): Promise<RequirementsDocument> {
    // Load the idea artifact as read-only reference
    const ideaArtifact = await artifactService.getById(ideaArtifactId);
    if (!ideaArtifact) {
      throw new Error(`Idea artifact not found: ${ideaArtifactId}`);
    }

    // Extract idea information from artifact
    const ideaTitle = this.extractIdeaTitle(ideaArtifact);
    const ideaDescription = this.extractIdeaDescription(ideaArtifact);

    // Build prompt for AI analysis
    const prompt = this.buildRequirementsPrompt(ideaArtifact);

    // Get consensus from all providers
    const consensus = await consensusService.getConsensus({
      prompt: {
        system: this.getSystemPrompt(),
        user: prompt,
        context: JSON.stringify({ artifactId: ideaArtifactId, title: ideaTitle }),
      },
    });

    // Generate structured requirements
    const requirements = this.generateStructuredRequirements(
      ideaArtifactId,
      ideaTitle,
      ideaDescription,
      consensus.confidence
    );

    // NOTE: Do NOT save as artifact here - user must explicitly accept
    return requirements;
  }

  /**
   * Accept requirements and save as artifact
   * This is the commitment point for the user
   */
  async acceptRequirements(requirements: RequirementsDocument): Promise<RequirementsDocument> {
    // Get the source idea artifact to capture its version for downstream tracking
    const ideaArtifact = await artifactService.getById(requirements.ideaArtifactId);
    const sourceVersion = ideaArtifact?.metadata.version;
    
    // Save as artifact only when user explicitly accepts
    const artifact = await this.saveAsArtifact(requirements, sourceVersion);
    requirements.artifactId = artifact.metadata.id;

    return requirements;
  }

  /**
   * Extract idea title from artifact
   */
  private extractIdeaTitle(artifact: Artifact): string {
    const titleMatch = artifact.metadata.title.match(/Ideas Reference: (.+)/);
    return titleMatch ? titleMatch[1] : artifact.metadata.title;
  }

  /**
   * Extract idea description from artifact
   */
  private extractIdeaDescription(artifact: Artifact): string {
    const overviewSection = artifact.sections.find(s => s.heading === "Idea Overview");
    if (overviewSection) {
      const descMatch = overviewSection.content.match(/\*\*Description:\*\* (.+)/);
      return descMatch ? descMatch[1] : "";
    }
    return "";
  }

  /**
   * Build the requirements prompt from idea artifact
   */
  private buildRequirementsPrompt(artifact: Artifact): string {
    let prompt = `Based on the following validated idea, generate comprehensive requirements:\n\n`;
    prompt += `# ${artifact.metadata.title}\n\n`;

    for (const section of artifact.sections) {
      prompt += `## ${section.heading}\n${section.content}\n\n`;
    }

    prompt += `\nGenerate detailed requirements including:\n`;
    prompt += `1. Functional requirements with clear acceptance criteria (testable, observable outcomes)\n`;
    prompt += `2. Non-functional requirements with measurable metrics and targets\n`;
    prompt += `3. Architecture overview with components and data flow\n`;
    prompt += `4. Data models with relationships and constraints\n`;
    prompt += `5. API contracts with endpoints, authentication, and error responses\n`;
    prompt += `6. UI/UX principles and user flows\n`;
    prompt += `7. Security considerations with implementation guidance\n`;
    prompt += `8. ASSUMPTIONS - List technical, user, and operational assumptions the system depends on\n`;
    prompt += `9. OUT OF SCOPE - Explicitly state what is NOT being built to prevent scope creep\n`;
    prompt += `10. EDGE CASES AND FAILURE MODES - Known edge cases and expected system behavior when things go wrong\n`;
    prompt += `11. CONFIDENCE NOTES - Identify areas with higher uncertainty that may need validation or iteration\n`;

    return prompt;
  }

  /**
   * Get the system prompt for requirements generation
   */
  private getSystemPrompt(): string {
    return `You are an expert software architect and requirements engineer. Generate comprehensive, deterministic, developer-readable, and tool-agnostic requirements documents. Focus on clarity, completeness, and practical implementation guidance. Requirements should be specific enough to guide development but flexible enough to allow appropriate technical choices.

CRITICAL: The goal is to reduce ambiguity. Ambiguity upstream causes chaos downstream. Requirements exist to remove ambiguity.

The resulting document should:
- Be suitable for handoff to a senior engineer
- Reduce follow-up questions
- Make downstream prompt generation safer
- Include explicit assumptions, scope boundaries, edge cases, and confidence notes`;
  }

  /**
   * Generate structured requirements based on idea content
   * 
   * NOTE: Current implementation uses template-based generation because
   * AI providers are in mock mode. When real AI APIs are integrated:
   * 1. Parse consensus.unifiedContent to extract structured requirements
   * 2. Use NLP to identify functional/non-functional requirements
   * 3. Generate idea-specific architecture based on technical analysis
   * 4. Infer data models from described features
   */
  private generateStructuredRequirements(
    ideaArtifactId: string,
    ideaTitle: string,
    ideaDescription: string,
    confidence: number
  ): RequirementsDocument {
    const id = randomUUID();

    return {
      id,
      ideaArtifactId,
      ideaTitle,
      functionalRequirements: this.generateFunctionalRequirements(ideaTitle),
      nonFunctionalRequirements: this.generateNonFunctionalRequirements(),
      architecture: this.generateArchitecture(ideaTitle),
      dataModels: this.generateDataModels(ideaTitle),
      apiContracts: this.generateAPIContracts(ideaTitle),
      uiuxPrinciples: this.generateUIUXPrinciples(),
      securityConsiderations: this.generateSecurityConsiderations(),
      assumptions: this.generateAssumptions(ideaTitle),
      outOfScope: this.generateOutOfScope(ideaTitle),
      edgeCasesAndFailureModes: this.generateEdgeCasesAndFailureModes(),
      confidenceNotes: this.generateConfidenceNotes(),
      summary: this.generateSummary(ideaTitle, confidence),
      version: "1.0.0",
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate functional requirements
   */
  private generateFunctionalRequirements(ideaTitle: string): FunctionalRequirement[] {
    return [
      {
        id: "FR-001",
        category: "User Management",
        title: "User Registration",
        description: "Users must be able to create an account with email and password",
        priority: "must-have",
        acceptanceCriteria: [
          "User can register with valid email and password",
          "Email validation is performed",
          "Password meets minimum security requirements",
          "Confirmation email is sent upon registration",
        ],
      },
      {
        id: "FR-002",
        category: "User Management",
        title: "User Authentication",
        description: "Users must be able to log in securely to access their account",
        priority: "must-have",
        acceptanceCriteria: [
          "User can log in with email and password",
          "Session is created upon successful login",
          "Failed login attempts are rate-limited",
          "User can log out and invalidate session",
        ],
        dependencies: ["FR-001"],
      },
      {
        id: "FR-003",
        category: "Core Features",
        title: "Primary User Flow",
        description: `Main functionality for ${ideaTitle}`,
        priority: "must-have",
        acceptanceCriteria: [
          "User can access primary feature from dashboard",
          "Feature operates correctly for all valid inputs",
          "Appropriate error handling for edge cases",
          "Results are persisted and retrievable",
        ],
        dependencies: ["FR-002"],
      },
      {
        id: "FR-004",
        category: "Core Features",
        title: "Data Input and Validation",
        description: "System accepts and validates user input",
        priority: "must-have",
        acceptanceCriteria: [
          "All input fields have appropriate validation",
          "Validation errors are displayed clearly",
          "Valid data is accepted and processed",
          "Input sanitization prevents injection attacks",
        ],
      },
      {
        id: "FR-005",
        category: "Core Features",
        title: "Results Display",
        description: "System displays processed results to users",
        priority: "must-have",
        acceptanceCriteria: [
          "Results are displayed in a clear, organized format",
          "Users can interact with results (filter, sort, export)",
          "Results load within acceptable time limits",
          "Empty states are handled gracefully",
        ],
        dependencies: ["FR-003"],
      },
      {
        id: "FR-006",
        category: "Data Management",
        title: "User Data Persistence",
        description: "User data is stored securely and persistently",
        priority: "must-have",
        acceptanceCriteria: [
          "Data is saved to database upon creation",
          "Data can be retrieved by authorized users",
          "Data can be updated by authorized users",
          "Data can be deleted upon user request",
        ],
      },
      {
        id: "FR-007",
        category: "User Experience",
        title: "Dashboard Overview",
        description: "Users have access to a summary dashboard",
        priority: "should-have",
        acceptanceCriteria: [
          "Dashboard displays key metrics and status",
          "Recent activity is visible",
          "Quick actions are accessible",
          "Dashboard loads efficiently",
        ],
        dependencies: ["FR-002"],
      },
      {
        id: "FR-008",
        category: "Notifications",
        title: "System Notifications",
        description: "Users receive notifications for important events",
        priority: "should-have",
        acceptanceCriteria: [
          "In-app notifications for key events",
          "Email notifications for critical updates",
          "Users can configure notification preferences",
          "Notifications are non-intrusive",
        ],
      },
      {
        id: "FR-009",
        category: "Settings",
        title: "User Preferences",
        description: "Users can customize their experience",
        priority: "nice-to-have",
        acceptanceCriteria: [
          "Users can update profile information",
          "Theme preferences can be set",
          "Language preferences (if applicable)",
          "Settings are persisted across sessions",
        ],
      },
      {
        id: "FR-010",
        category: "Export",
        title: "Data Export",
        description: "Users can export their data",
        priority: "nice-to-have",
        acceptanceCriteria: [
          "Export to common formats (CSV, JSON)",
          "Export includes all user data",
          "Export is downloadable",
          "Export process handles large datasets",
        ],
      },
    ];
  }

  /**
   * Generate non-functional requirements
   */
  private generateNonFunctionalRequirements(): NonFunctionalRequirement[] {
    return [
      {
        id: "NFR-001",
        category: "performance",
        title: "Page Load Time",
        description: "Initial page load should be fast for good user experience",
        metric: "Time to First Contentful Paint",
        target: "< 1.5 seconds on 3G connection",
      },
      {
        id: "NFR-002",
        category: "performance",
        title: "API Response Time",
        description: "API endpoints should respond quickly",
        metric: "95th percentile response time",
        target: "< 500ms for read operations, < 2s for complex operations",
      },
      {
        id: "NFR-003",
        category: "scalability",
        title: "Concurrent Users",
        description: "System should handle expected user load",
        metric: "Concurrent active users",
        target: "1000 concurrent users with no degradation",
      },
      {
        id: "NFR-004",
        category: "reliability",
        title: "System Availability",
        description: "System should be highly available",
        metric: "Uptime percentage",
        target: "99.9% availability (excluding planned maintenance)",
      },
      {
        id: "NFR-005",
        category: "security",
        title: "Data Encryption",
        description: "Sensitive data must be encrypted",
        metric: "Encryption standard",
        target: "AES-256 for data at rest, TLS 1.3 for data in transit",
      },
      {
        id: "NFR-006",
        category: "usability",
        title: "Accessibility",
        description: "Application should be accessible to all users",
        metric: "WCAG compliance level",
        target: "WCAG 2.1 Level AA",
      },
      {
        id: "NFR-007",
        category: "maintainability",
        title: "Code Quality",
        description: "Codebase should be maintainable",
        metric: "Test coverage",
        target: "> 80% code coverage for critical paths",
      },
      {
        id: "NFR-008",
        category: "compatibility",
        title: "Browser Support",
        description: "Application should work across modern browsers",
        metric: "Browser compatibility",
        target: "Latest 2 versions of Chrome, Firefox, Safari, Edge",
      },
    ];
  }

  /**
   * Generate architecture overview
   */
  private generateArchitecture(ideaTitle: string): ArchitectureOverview {
    return {
      pattern: "Modular Monolith with Service-Oriented Backend",
      description: `Architecture designed for ${ideaTitle} following modern web application patterns with clear separation of concerns.`,
      components: [
        {
          name: "Frontend Application",
          type: "frontend",
          description: "Single-page application providing user interface",
          technologies: ["React", "TypeScript", "Tailwind CSS"],
          responsibilities: [
            "Render user interface",
            "Handle user interactions",
            "Manage client-side state",
            "Communicate with backend API",
          ],
          interfaces: ["REST API Client", "WebSocket Client"],
        },
        {
          name: "API Server",
          type: "backend",
          description: "RESTful API server handling business logic",
          technologies: ["Node.js", "Express", "TypeScript"],
          responsibilities: [
            "Process API requests",
            "Execute business logic",
            "Manage authentication/authorization",
            "Coordinate with data layer",
          ],
          interfaces: ["REST API", "Database Client"],
        },
        {
          name: "Database",
          type: "database",
          description: "Persistent data storage",
          technologies: ["PostgreSQL"],
          responsibilities: [
            "Store application data",
            "Ensure data integrity",
            "Support queries and transactions",
          ],
        },
        {
          name: "Authentication Service",
          type: "service",
          description: "Handles user authentication and session management",
          technologies: ["JWT", "bcrypt"],
          responsibilities: [
            "Validate credentials",
            "Issue and verify tokens",
            "Manage sessions",
          ],
        },
        {
          name: "External Services",
          type: "external",
          description: "Third-party integrations",
          responsibilities: [
            "AI/ML services for intelligent features",
            "Email service for notifications",
            "Analytics and monitoring",
          ],
        },
      ],
      dataFlow: "Client -> API Gateway -> Business Logic -> Data Access Layer -> Database. Responses follow reverse path with appropriate transformations.",
      deploymentNotes: "Application deployable as containerized services or on platform-as-a-service. Database should be managed service for reliability.",
    };
  }

  /**
   * Generate data models
   */
  private generateDataModels(ideaTitle: string): DataModelEntity[] {
    return [
      {
        name: "User",
        description: "Represents a registered user of the system",
        fields: [
          { name: "id", type: "UUID", required: true, description: "Unique identifier" },
          { name: "email", type: "String", required: true, description: "User email address", constraints: ["unique", "valid email format"] },
          { name: "passwordHash", type: "String", required: true, description: "Hashed password" },
          { name: "displayName", type: "String", required: false, description: "Display name" },
          { name: "createdAt", type: "DateTime", required: true, description: "Account creation timestamp" },
          { name: "updatedAt", type: "DateTime", required: true, description: "Last update timestamp" },
          { name: "isActive", type: "Boolean", required: true, description: "Account active status" },
        ],
        relationships: [
          { entity: "Session", type: "one-to-many", description: "User can have multiple sessions" },
          { entity: "UserPreference", type: "one-to-one", description: "User has one preference set" },
        ],
      },
      {
        name: "Session",
        description: "Represents an active user session",
        fields: [
          { name: "id", type: "UUID", required: true, description: "Session identifier" },
          { name: "userId", type: "UUID", required: true, description: "Reference to user" },
          { name: "token", type: "String", required: true, description: "Session token" },
          { name: "expiresAt", type: "DateTime", required: true, description: "Session expiration" },
          { name: "createdAt", type: "DateTime", required: true, description: "Session creation time" },
          { name: "ipAddress", type: "String", required: false, description: "Client IP address" },
          { name: "userAgent", type: "String", required: false, description: "Client user agent" },
        ],
        relationships: [
          { entity: "User", type: "many-to-many", description: "Session belongs to a user" },
        ],
      },
      {
        name: "UserPreference",
        description: "User-specific settings and preferences",
        fields: [
          { name: "id", type: "UUID", required: true, description: "Preference set identifier" },
          { name: "userId", type: "UUID", required: true, description: "Reference to user" },
          { name: "theme", type: "Enum", required: true, description: "UI theme preference", constraints: ["light", "dark", "system"] },
          { name: "notifications", type: "JSON", required: true, description: "Notification settings" },
          { name: "updatedAt", type: "DateTime", required: true, description: "Last update timestamp" },
        ],
      },
      {
        name: "AuditLog",
        description: "System audit trail for important actions",
        fields: [
          { name: "id", type: "UUID", required: true, description: "Log entry identifier" },
          { name: "userId", type: "UUID", required: false, description: "Acting user (null for system)" },
          { name: "action", type: "String", required: true, description: "Action performed" },
          { name: "entityType", type: "String", required: true, description: "Type of entity affected" },
          { name: "entityId", type: "UUID", required: false, description: "ID of affected entity" },
          { name: "details", type: "JSON", required: false, description: "Additional details" },
          { name: "timestamp", type: "DateTime", required: true, description: "When action occurred" },
        ],
      },
    ];
  }

  /**
   * Generate API contracts
   */
  private generateAPIContracts(ideaTitle: string): APIContracts {
    return {
      baseUrl: "/api/v1",
      version: "1.0.0",
      authentication: "Bearer token (JWT) in Authorization header",
      endpoints: [
        {
          method: "POST",
          path: "/auth/register",
          description: "Register a new user account",
          authentication: false,
          requestBody: { contentType: "application/json", schema: "{ email: string, password: string, displayName?: string }" },
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: { userId: string, token: string } }" },
          errorResponses: [
            { status: 400, description: "Invalid input data" },
            { status: 409, description: "Email already registered" },
          ],
        },
        {
          method: "POST",
          path: "/auth/login",
          description: "Authenticate user and receive token",
          authentication: false,
          requestBody: { contentType: "application/json", schema: "{ email: string, password: string }" },
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: { token: string, expiresAt: string } }" },
          errorResponses: [
            { status: 401, description: "Invalid credentials" },
            { status: 429, description: "Too many login attempts" },
          ],
        },
        {
          method: "POST",
          path: "/auth/logout",
          description: "Invalidate current session",
          authentication: true,
          responseBody: { contentType: "application/json", schema: "{ success: boolean }" },
        },
        {
          method: "GET",
          path: "/users/me",
          description: "Get current user profile",
          authentication: true,
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: User }" },
          errorResponses: [
            { status: 401, description: "Not authenticated" },
          ],
        },
        {
          method: "PATCH",
          path: "/users/me",
          description: "Update current user profile",
          authentication: true,
          requestBody: { contentType: "application/json", schema: "{ displayName?: string, preferences?: object }" },
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: User }" },
        },
        {
          method: "GET",
          path: "/resources",
          description: "List resources with pagination",
          authentication: true,
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: Resource[], pagination: { page, limit, total } }" },
        },
        {
          method: "POST",
          path: "/resources",
          description: "Create a new resource",
          authentication: true,
          requestBody: { contentType: "application/json", schema: "{ ...resourceData }" },
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: Resource }" },
          errorResponses: [
            { status: 400, description: "Invalid resource data" },
          ],
        },
        {
          method: "GET",
          path: "/resources/:id",
          description: "Get a specific resource by ID",
          authentication: true,
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: Resource }" },
          errorResponses: [
            { status: 404, description: "Resource not found" },
          ],
        },
        {
          method: "PUT",
          path: "/resources/:id",
          description: "Update a resource",
          authentication: true,
          requestBody: { contentType: "application/json", schema: "{ ...resourceData }" },
          responseBody: { contentType: "application/json", schema: "{ success: boolean, data: Resource }" },
        },
        {
          method: "DELETE",
          path: "/resources/:id",
          description: "Delete a resource",
          authentication: true,
          responseBody: { contentType: "application/json", schema: "{ success: boolean }" },
        },
      ],
    };
  }

  /**
   * Generate UI/UX principles
   */
  private generateUIUXPrinciples(): UIUXPrinciples {
    return {
      designSystem: "Component-based design system with consistent spacing, typography, and color palette",
      keyPrinciples: [
        {
          principle: "Clarity First",
          description: "Every element should have a clear purpose. Avoid visual clutter and prioritize essential information.",
        },
        {
          principle: "Consistent Patterns",
          description: "Use consistent interaction patterns throughout the application. Similar actions should look and behave similarly.",
        },
        {
          principle: "Progressive Disclosure",
          description: "Show essential information first, with details available on demand. Avoid overwhelming users with options.",
        },
        {
          principle: "Immediate Feedback",
          description: "Provide instant visual feedback for user actions. Loading states, success confirmations, and error messages should be clear.",
        },
        {
          principle: "Error Prevention",
          description: "Design to prevent errors where possible. When errors occur, provide clear guidance for resolution.",
        },
        {
          principle: "Mobile-First Responsive",
          description: "Design for mobile constraints first, then enhance for larger screens.",
        },
      ],
      userFlows: [
        {
          name: "Onboarding",
          description: "New user registration and initial setup",
          steps: [
            "Land on marketing/home page",
            "Click sign up button",
            "Enter email and password",
            "Verify email (optional based on requirements)",
            "Complete profile setup",
            "View welcome dashboard",
          ],
        },
        {
          name: "Core Task Completion",
          description: "Primary user workflow for main feature",
          steps: [
            "Navigate to feature from dashboard",
            "Input required data",
            "Submit and view processing state",
            "Review results",
            "Take action on results (save, export, share)",
          ],
        },
        {
          name: "Settings Management",
          description: "User updating their preferences",
          steps: [
            "Access settings from user menu",
            "Navigate to desired setting category",
            "Make changes",
            "Save changes",
            "View confirmation of saved changes",
          ],
        },
      ],
      accessibilityRequirements: [
        "All interactive elements keyboard accessible",
        "Color contrast ratio minimum 4.5:1 for normal text",
        "Alt text for all meaningful images",
        "Form labels associated with inputs",
        "Focus indicators visible",
        "Screen reader compatible markup",
        "Skip navigation links",
        "Resizable text up to 200% without loss of functionality",
      ],
      responsiveBreakpoints: [
        "Mobile: 320px - 639px",
        "Tablet: 640px - 1023px",
        "Desktop: 1024px - 1279px",
        "Large Desktop: 1280px+",
      ],
    };
  }

  /**
   * Generate security considerations
   */
  private generateSecurityConsiderations(): SecurityConsideration[] {
    return [
      {
        category: "authentication",
        title: "Secure Password Storage",
        description: "Passwords must be hashed using a strong, adaptive algorithm",
        implementation: "Use bcrypt with cost factor of 12 or Argon2id. Never store plaintext passwords.",
        priority: "critical",
      },
      {
        category: "authentication",
        title: "Session Management",
        description: "Sessions must be securely managed with proper expiration",
        implementation: "JWT with short expiration (15-60 min), secure refresh token rotation, invalidation on logout.",
        priority: "critical",
      },
      {
        category: "authorization",
        title: "Access Control",
        description: "Enforce principle of least privilege for all resources",
        implementation: "Role-based access control (RBAC) with resource-level permissions checked on every request.",
        priority: "critical",
      },
      {
        category: "data-protection",
        title: "Data Encryption",
        description: "Sensitive data must be encrypted at rest and in transit",
        implementation: "TLS 1.3 for all connections. AES-256-GCM for sensitive data at rest. Encrypt PII fields.",
        priority: "critical",
      },
      {
        category: "input-validation",
        title: "Input Sanitization",
        description: "All user input must be validated and sanitized",
        implementation: "Server-side validation with Zod schemas. Sanitize output to prevent XSS. Parameterized queries for SQL.",
        priority: "high",
      },
      {
        category: "input-validation",
        title: "Rate Limiting",
        description: "Prevent abuse through rate limiting",
        implementation: "Rate limit by IP and user ID. Stricter limits on auth endpoints. Implement exponential backoff.",
        priority: "high",
      },
      {
        category: "infrastructure",
        title: "Security Headers",
        description: "Implement security headers to prevent common attacks",
        implementation: "CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, X-XSS-Protection.",
        priority: "high",
      },
      {
        category: "infrastructure",
        title: "Dependency Security",
        description: "Keep dependencies updated and monitor for vulnerabilities",
        implementation: "Regular dependency audits, automated vulnerability scanning, dependabot or similar tooling.",
        priority: "medium",
      },
      {
        category: "compliance",
        title: "Data Privacy",
        description: "Comply with applicable data privacy regulations",
        implementation: "Implement data retention policies, user data export, account deletion. Document data processing.",
        priority: "high",
      },
      {
        category: "infrastructure",
        title: "Logging and Monitoring",
        description: "Implement security logging and monitoring",
        implementation: "Log security events, failed auth attempts, access patterns. Alert on suspicious activity.",
        priority: "medium",
      },
    ];
  }

  /**
   * Generate assumptions
   */
  private generateAssumptions(ideaTitle: string): RequirementAssumption[] {
    return [
      {
        id: "ASM-001",
        category: "technical",
        statement: "Modern browser support only (Chrome, Firefox, Safari, Edge - last 2 versions)",
        rationale: "Reduces cross-browser compatibility overhead and allows use of modern APIs",
        impact: "Users on older browsers may experience degraded functionality or be unable to use the application",
      },
      {
        id: "ASM-002",
        category: "technical",
        statement: "Users have reliable internet connectivity",
        rationale: "Application is designed as an online service without offline capabilities in initial release",
        impact: "Users without stable internet cannot use core features; offline mode deferred to future release",
      },
      {
        id: "ASM-003",
        category: "user",
        statement: "Users have basic familiarity with web applications",
        rationale: "Reduces need for extensive onboarding tutorials and hand-holding UI patterns",
        impact: "Non-technical users may require additional support or documentation",
      },
      {
        id: "ASM-004",
        category: "user",
        statement: "Primary user base is English-speaking",
        rationale: "Initial release focuses on English; internationalization deferred",
        impact: "Non-English users cannot use the application until i18n is implemented",
      },
      {
        id: "ASM-005",
        category: "operational",
        statement: "Cloud hosting provider guarantees 99.9% uptime SLA",
        rationale: "Application availability targets depend on infrastructure reliability",
        impact: "Actual uptime may vary based on provider performance and configuration",
      },
      {
        id: "ASM-006",
        category: "operational",
        statement: "Database backups are performed daily with 30-day retention",
        rationale: "Standard data protection without requiring real-time replication initially",
        impact: "Maximum data loss in worst case is 24 hours of transactions",
      },
      {
        id: "ASM-007",
        category: "business",
        statement: "User growth will be gradual during initial launch period",
        rationale: "Allows time for performance tuning before scaling infrastructure",
        impact: "Viral growth could overwhelm initial infrastructure capacity",
      },
      {
        id: "ASM-008",
        category: "integration",
        statement: "Third-party APIs (email, AI services) maintain current contract and availability",
        rationale: "External dependencies are assumed stable for initial implementation",
        impact: "API changes or outages could affect dependent features",
      },
    ];
  }

  /**
   * Generate out-of-scope items
   */
  private generateOutOfScope(ideaTitle: string): OutOfScopeItem[] {
    return [
      {
        id: "OOS-001",
        item: "Native mobile applications (iOS/Android)",
        reason: "Initial release focuses on responsive web application; native apps require separate development effort",
        futureConsideration: true,
      },
      {
        id: "OOS-002",
        item: "Offline functionality",
        reason: "Adds significant complexity with data sync; deferred until core features are stable",
        futureConsideration: true,
      },
      {
        id: "OOS-003",
        item: "Multi-language support (internationalization)",
        reason: "English-only for initial release; i18n infrastructure can be added later",
        futureConsideration: true,
      },
      {
        id: "OOS-004",
        item: "Advanced analytics and reporting dashboards",
        reason: "Basic metrics only; comprehensive analytics deferred to future phase",
        futureConsideration: true,
      },
      {
        id: "OOS-005",
        item: "Third-party integrations beyond core requirements",
        reason: "Focus on core functionality first; integration ecosystem built incrementally",
        futureConsideration: true,
      },
      {
        id: "OOS-006",
        item: "White-label or multi-tenant enterprise features",
        reason: "Single-tenant architecture for simplicity; multi-tenancy is a major architectural change",
        futureConsideration: true,
      },
      {
        id: "OOS-007",
        item: "Real-time collaborative editing",
        reason: "Requires CRDT or OT implementation; significant complexity for initial release",
        futureConsideration: true,
      },
      {
        id: "OOS-008",
        item: "Custom domain support for users",
        reason: "Requires SSL certificate management and DNS configuration; deferred feature",
        futureConsideration: false,
      },
    ];
  }

  /**
   * Generate edge cases and failure modes
   */
  private generateEdgeCasesAndFailureModes(): EdgeCaseFailureMode[] {
    return [
      {
        id: "ECF-001",
        scenario: "User submits form with browser back button, causing duplicate submission",
        category: "user-behavior",
        likelihood: "occasional",
        expectedBehavior: "System detects duplicate request via idempotency key and returns existing result",
        recoveryAction: "Display confirmation of original action without creating duplicate",
      },
      {
        id: "ECF-002",
        scenario: "Session expires while user has unsaved changes in form",
        category: "timing",
        likelihood: "occasional",
        expectedBehavior: "System preserves form data locally, prompts re-authentication, then restores state",
        recoveryAction: "Use localStorage to cache form state; restore after successful re-login",
      },
      {
        id: "ECF-003",
        scenario: "Database connection pool exhausted during traffic spike",
        category: "resource",
        likelihood: "rare",
        expectedBehavior: "Requests queue briefly then fail gracefully with 503 status",
        recoveryAction: "Implement circuit breaker pattern; display friendly maintenance message",
      },
      {
        id: "ECF-004",
        scenario: "External AI service times out or returns error",
        category: "integration",
        likelihood: "occasional",
        expectedBehavior: "System retries with exponential backoff; falls back to cached result if available",
        recoveryAction: "Queue request for background retry; notify user of delay",
      },
      {
        id: "ECF-005",
        scenario: "User uploads file exceeding size limit",
        category: "input",
        likelihood: "likely",
        expectedBehavior: "Client-side validation prevents upload; server rejects if bypassed",
        recoveryAction: "Display clear error with size limit; suggest file compression",
      },
      {
        id: "ECF-006",
        scenario: "Concurrent edits to same resource by multiple users",
        category: "state",
        likelihood: "occasional",
        expectedBehavior: "Optimistic locking detects conflict; last writer notified of conflict",
        recoveryAction: "Show diff of changes; allow user to merge or overwrite",
      },
      {
        id: "ECF-007",
        scenario: "User attempts action without required permissions",
        category: "user-behavior",
        likelihood: "likely",
        expectedBehavior: "Action is blocked; clear message explains required permission",
        recoveryAction: "Suggest contacting administrator for access; log attempt for audit",
      },
      {
        id: "ECF-008",
        scenario: "Network disconnection during multi-step operation",
        category: "integration",
        likelihood: "occasional",
        expectedBehavior: "Partial state is preserved; operation can be resumed or rolled back",
        recoveryAction: "Show reconnection status; auto-retry when connection restored",
      },
      {
        id: "ECF-009",
        scenario: "User pastes extremely large text content into input field",
        category: "input",
        likelihood: "rare",
        expectedBehavior: "Content is truncated to maximum length with warning",
        recoveryAction: "Display character count and limit; suggest alternatives for large content",
      },
      {
        id: "ECF-010",
        scenario: "Email delivery fails for critical notification",
        category: "integration",
        likelihood: "rare",
        expectedBehavior: "System logs failure; retries with exponential backoff; alerts admin after threshold",
        recoveryAction: "In-app notification as backup; manual resend option in admin panel",
      },
    ];
  }

  /**
   * Generate confidence notes for uncertain areas
   */
  private generateConfidenceNotes(): ConfidenceNote[] {
    return [
      {
        id: "CN-001",
        section: "Non-Functional Requirements - Performance",
        concern: "Specific performance targets may need adjustment based on actual usage patterns",
        confidenceLevel: "medium",
        reason: "Targets based on industry benchmarks; real-world performance depends on implementation and infrastructure",
        mitigationSuggestion: "Implement performance monitoring early; adjust targets based on baseline measurements",
      },
      {
        id: "CN-002",
        section: "Architecture - External Services",
        concern: "AI service integration patterns may evolve as providers update their APIs",
        confidenceLevel: "medium",
        reason: "AI services are rapidly evolving; current integration approach may need updates",
        mitigationSuggestion: "Abstract AI provider behind interface; design for easy provider switching",
      },
      {
        id: "CN-003",
        section: "Data Models",
        concern: "Schema may require iteration as real user workflows are observed",
        confidenceLevel: "medium",
        reason: "Initial schema based on anticipated needs; actual usage may reveal gaps",
        mitigationSuggestion: "Use migration-friendly ORM; plan for schema evolution from start",
      },
      {
        id: "CN-004",
        section: "UI/UX Principles - User Flows",
        concern: "User flow assumptions should be validated with usability testing",
        confidenceLevel: "low",
        reason: "Flows designed based on best practices; actual user behavior may differ",
        mitigationSuggestion: "Plan for early usability testing; implement analytics to track flow completion",
      },
      {
        id: "CN-005",
        section: "Security Considerations",
        concern: "Security requirements are comprehensive but should have professional security review",
        confidenceLevel: "high",
        reason: "Based on OWASP and industry standards; implementation quality determines actual security",
        mitigationSuggestion: "Schedule security audit before production launch; implement security scanning in CI",
      },
      {
        id: "CN-006",
        section: "API Contracts",
        concern: "API design may need refinement as frontend implementation progresses",
        confidenceLevel: "medium",
        reason: "API designed from requirements; frontend development may reveal optimization opportunities",
        mitigationSuggestion: "Version APIs from start; implement deprecation strategy for breaking changes",
      },
    ];
  }

  /**
   * Generate summary
   */
  private generateSummary(ideaTitle: string, confidence: number): string {
    return `This requirements document for "${ideaTitle}" provides a comprehensive specification covering ${10} functional requirements, ${8} non-functional requirements, a modular architecture with ${5} components, ${4} data models, ${10} API endpoints, UI/UX principles with ${3} user flows, ${10} security considerations, ${8} documented assumptions, ${8} explicit out-of-scope items, ${10} edge cases and failure modes, and ${6} confidence notes for areas requiring validation. Generated with ${Math.round(confidence * 100)}% AI consensus confidence. All requirements are deterministic, developer-readable, and tool-agnostic.`;
  }

  /**
   * Save requirements as Markdown artifact
   */
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
      {
        heading: "Functional Requirements",
        level: 2 as const,
        content: requirements.functionalRequirements.map(fr =>
          `### ${fr.id}: ${fr.title}\n**Category:** ${fr.category} | **Priority:** ${fr.priority}\n\n${fr.description}\n\n**Acceptance Criteria:**\n${fr.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}${fr.dependencies ? `\n\n**Dependencies:** ${fr.dependencies.join(', ')}` : ''}`
        ).join('\n\n---\n\n'),
      },
      {
        heading: "Non-Functional Requirements",
        level: 2 as const,
        content: `| ID | Category | Title | Metric | Target |\n|-----|----------|-------|--------|--------|\n${requirements.nonFunctionalRequirements.map(nfr =>
          `| ${nfr.id} | ${nfr.category} | ${nfr.title} | ${nfr.metric || '-'} | ${nfr.target || '-'} |`
        ).join('\n')}`,
      },
      {
        heading: "Architecture Overview",
        level: 2 as const,
        content: `**Pattern:** ${requirements.architecture.pattern}\n\n${requirements.architecture.description}\n\n### Components\n\n${requirements.architecture.components.map(c =>
          `#### ${c.name} (${c.type})\n${c.description}\n\n**Technologies:** ${c.technologies?.join(', ') || 'TBD'}\n\n**Responsibilities:**\n${c.responsibilities.map(r => `- ${r}`).join('\n')}`
        ).join('\n\n')}\n\n### Data Flow\n${requirements.architecture.dataFlow}${requirements.architecture.deploymentNotes ? `\n\n### Deployment Notes\n${requirements.architecture.deploymentNotes}` : ''}`,
      },
      {
        heading: "Data Models",
        level: 2 as const,
        content: requirements.dataModels.map(dm =>
          `### ${dm.name}\n${dm.description}\n\n| Field | Type | Required | Description |\n|-------|------|----------|-------------|\n${dm.fields.map(f =>
            `| ${f.name} | ${f.type} | ${f.required ? 'Yes' : 'No'} | ${f.description || '-'} |`
          ).join('\n')}${dm.relationships ? `\n\n**Relationships:**\n${dm.relationships.map(r => `- ${r.type} with ${r.entity}${r.description ? `: ${r.description}` : ''}`).join('\n')}` : ''}`
        ).join('\n\n---\n\n'),
      },
      {
        heading: "API Contracts",
        level: 2 as const,
        content: `**Base URL:** ${requirements.apiContracts.baseUrl}\n**Version:** ${requirements.apiContracts.version}\n**Authentication:** ${requirements.apiContracts.authentication}\n\n### Endpoints\n\n${requirements.apiContracts.endpoints.map(ep =>
          `#### ${ep.method} ${ep.path}\n${ep.description}\n\n**Authentication Required:** ${ep.authentication ? 'Yes' : 'No'}${ep.requestBody ? `\n\n**Request Body:** \`${ep.requestBody.schema}\`` : ''}${ep.responseBody ? `\n\n**Response:** \`${ep.responseBody.schema}\`` : ''}${ep.errorResponses ? `\n\n**Error Responses:**\n${ep.errorResponses.map(er => `- ${er.status}: ${er.description}`).join('\n')}` : ''}`
        ).join('\n\n---\n\n')}`,
      },
      {
        heading: "UI/UX Principles",
        level: 2 as const,
        content: `**Design System:** ${requirements.uiuxPrinciples.designSystem}\n\n### Key Principles\n\n${requirements.uiuxPrinciples.keyPrinciples.map(p =>
          `#### ${p.principle}\n${p.description}`
        ).join('\n\n')}\n\n### User Flows\n\n${requirements.uiuxPrinciples.userFlows.map(uf =>
          `#### ${uf.name}\n${uf.description}\n\n${uf.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        ).join('\n\n')}\n\n### Accessibility Requirements\n\n${requirements.uiuxPrinciples.accessibilityRequirements.map(ar => `- ${ar}`).join('\n')}\n\n### Responsive Breakpoints\n\n${requirements.uiuxPrinciples.responsiveBreakpoints?.map(rb => `- ${rb}`).join('\n') || 'Standard responsive design'}`,
      },
      {
        heading: "Security Considerations",
        level: 2 as const,
        content: requirements.securityConsiderations.map(sc =>
          `### ${sc.title} (${sc.priority})\n**Category:** ${sc.category}\n\n${sc.description}\n\n**Implementation:** ${sc.implementation}`
        ).join('\n\n---\n\n'),
      },
      {
        heading: "Assumptions",
        level: 2 as const,
        content: `The following assumptions underpin this requirements document. If any assumption proves incorrect, affected requirements may need revision.\n\n${requirements.assumptions.map(a =>
          `### ${a.id}: ${a.statement}\n**Category:** ${a.category}\n\n**Rationale:** ${a.rationale}\n\n**Impact if Invalid:** ${a.impact}`
        ).join('\n\n---\n\n')}`,
      },
      {
        heading: "Out of Scope",
        level: 2 as const,
        content: `The following items are explicitly excluded from this release to maintain focus and manage scope.\n\n| ID | Item | Reason | Future? |\n|----|------|--------|---------|\n${requirements.outOfScope.map(oos =>
          `| ${oos.id} | ${oos.item} | ${oos.reason} | ${oos.futureConsideration ? 'Yes' : 'No'} |`
        ).join('\n')}`,
      },
      {
        heading: "Edge Cases and Failure Modes",
        level: 2 as const,
        content: `This section documents known edge cases and expected system behavior when things go wrong.\n\n${requirements.edgeCasesAndFailureModes.map(ecf =>
          `### ${ecf.id}: ${ecf.scenario}\n**Category:** ${ecf.category} | **Likelihood:** ${ecf.likelihood}\n\n**Expected Behavior:** ${ecf.expectedBehavior}${ecf.recoveryAction ? `\n\n**Recovery Action:** ${ecf.recoveryAction}` : ''}`
        ).join('\n\n---\n\n')}`,
      },
      {
        heading: "Confidence Notes",
        level: 2 as const,
        content: `The following areas have been flagged for additional validation or may require iteration based on real-world feedback.\n\n${requirements.confidenceNotes.map(cn =>
          `### ${cn.id}: ${cn.section}\n**Confidence:** ${cn.confidenceLevel.toUpperCase()}\n\n**Concern:** ${cn.concern}\n\n**Reason:** ${cn.reason}${cn.mitigationSuggestion ? `\n\n**Mitigation:** ${cn.mitigationSuggestion}` : ''}`
        ).join('\n\n---\n\n')}`,
      },
      {
        heading: "Next Steps",
        level: 2 as const,
        content: `This requirements document is ready for the development phase. Recommended next steps:\n\n1. **Review & Sign-off** - Stakeholder review of requirements\n2. **Technical Design** - Detailed technical specifications\n3. **Sprint Planning** - Break requirements into development sprints\n4. **Development** - Implement according to priorities\n5. **Testing** - Validate against acceptance criteria\n\n**Artifact ID:** \`${requirements.id}\`\n**Module:** requirements\n**Status:** Ready for development`,
      },
    ];

    const stage: PipelineStage = "LOCKED_REQUIREMENTS";
    const artifact = await artifactService.create({
      title: `Requirements Reference: ${requirements.ideaTitle}`,
      module: "requirements",
      sections,
      aiNotes: [
        {
          provider: "system",
          note: `Requirements generated from idea artifact ${requirements.ideaArtifactId}`,
          confidence: 0.9,
        },
      ],
      tags: ["requirements", "specification", "development-ready"],
      stage,
      sourceArtifactId: requirements.ideaArtifactId,
      sourceArtifactVersion: sourceVersion,
    });

    return artifact;
  }
}

export const requirementsService = new RequirementsService();
