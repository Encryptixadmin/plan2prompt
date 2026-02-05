# Platform Capabilities and Usage Analysis

## SECTION 1 - PLATFORM CAPABILITIES

### 1.1 Idea Analysis and Validation

**What it does**: Accepts user-submitted application ideas and performs multi-provider AI consensus analysis to evaluate feasibility, risks, strengths, weaknesses, and provide a scored recommendation (proceed/revise/stop).

**User roles**: Authenticated users with owner or collaborator role on a project.

**Codebase location**: `client/src/pages/ideas.tsx`, `server/routes/ideas.routes.ts`, `server/services/ideas.service.ts`

**Conditions**:
- User must be authenticated
- User must have an active project selected
- At least one AI provider must be validated and available
- User must have generation enabled (not disabled by admin)

### 1.2 Guided Refinement Workshop

**What it does**: For ideas receiving "revise" or "stop" recommendations, generates structured workshop questions based on identified risks and unvalidated assumptions. Workshop answers are used to refine the idea and trigger re-analysis with improved context.

**User roles**: Authenticated users with owner or collaborator role.

**Codebase location**: `client/src/lib/workshop-generator.ts`, `client/src/lib/workshop-resolution.ts`, `client/src/components/workshop-form.tsx`

**Conditions**:
- Idea must have received "revise" or "stop" recommendation
- Workshop is frontend-only (no backend persistence)
- Questions are deterministically generated from analysis data

### 1.3 Requirements Document Generation

**What it does**: Converts validated idea artifacts into comprehensive requirements documents containing functional requirements, non-functional requirements, tech stack recommendations, milestones, constraints, assumptions, and acceptance criteria.

**User roles**: Authenticated users with owner or collaborator role.

**Codebase location**: `client/src/pages/requirements.tsx`, `server/routes/requirements.routes.ts`, `server/services/requirements.service.ts`

**Conditions**:
- Source idea must be in VALIDATED_IDEA pipeline stage
- User must have generation permission
- Requirements can only be generated from accepted (artifact-saved) ideas

### 1.4 Build Prompts Generation

**What it does**: Generates sequential, IDE-specific build prompts from locked requirements. Each prompt includes step number, title, content, prerequisites, verification checkpoints, and estimated time. Supports multiple IDEs: Replit, Cursor, Lovable, Antigravity, Warp, and Generic.

**User roles**: Authenticated users with owner or collaborator role.

**Codebase location**: `client/src/pages/prompts.tsx`, `server/routes/prompts.routes.ts`, `server/services/prompts.service.ts`

**Conditions**:
- Source requirements must be in LOCKED_REQUIREMENTS stage
- Requirements must not be outdated (source idea unchanged)
- User must have generation permission

### 1.5 Prompt Feedback and Failure Classification

**What it does**: Accepts raw IDE output when build prompts fail, classifies failures as known or unknown patterns, and provides static recovery steps for known failures. Unknown failures receive generic STOP instructions.

**User roles**: Authenticated users.

**Codebase location**: `server/routes/prompts.routes.ts`, `server/services/feedback.service.ts`, `server/services/classifier.service.ts`

**Conditions**:
- Must reference a valid prompt artifact and step number
- Uses deterministic pattern matching against predefined failure taxonomy

### 1.6 Artifact Management

**What it does**: Stores, versions, and retrieves Markdown artifacts with YAML frontmatter. Supports version history, downstream dependency tracking, and module-based organization.

**User roles**: All authenticated users (read), owners/collaborators (write).

**Codebase location**: `server/routes/artifact.routes.ts`, `server/services/artifact.service.ts`

**Conditions**:
- Artifacts are file-based in `artifacts/` directory
- Immutable versioning using `_v{version}.md` convention
- Downstream artifacts track their source via `sourceArtifactId`

### 1.7 Project Management

**What it does**: Creates and manages projects with multi-member support. Projects isolate artifacts and usage tracking. Members can have owner, collaborator, or viewer roles.

**User roles**: Authenticated users (create own projects), owners (manage settings/members), collaborators (contribute), viewers (read-only).

**Codebase location**: `server/routes/project.routes.ts`, `server/services/project.service.ts`

**Conditions**:
- Each user can have multiple projects
- Artifacts are scoped to projects via `projectId`
- X-Project-Id header required for project-scoped API calls

### 1.8 Admin Operations Console

**What it does**: Administrative interface for managing AI providers (enable/disable), users (disable generation), projects (disable generation), viewing usage statistics, billing data, action audit logs, and artifact integrity checks.

**User roles**: Admin users only (role=admin or isAdmin=true).

**Codebase location**: `client/src/pages/admin.tsx`, `server/routes/admin.routes.ts`, `server/services/admin.service.ts`

**Conditions**:
- Requires admin middleware authentication
- All admin actions are audit-logged to PostgreSQL
- Provider disable/enable requires explicit confirmation

### 1.9 Usage Tracking

**What it does**: Records AI usage per project/user including provider, tokens used, estimated cost, and action type. Supports usage summaries and billing plan association.

**User roles**: Admin users (view all), regular users (implicit tracking).

**Codebase location**: `server/services/usage.service.ts`, `shared/schema.ts`

**Conditions**:
- Usage records persisted to PostgreSQL
- Tracks by module (ideas, requirements, prompts)
- Supports billing plan thresholds and warnings

### 1.10 Authentication

**What it does**: Authenticates users via Replit OpenID Connect. Creates user records on first login, maintains sessions in PostgreSQL.

**User roles**: All users.

**Codebase location**: `server/replit_integrations/auth/`, `shared/models/auth.ts`

**Conditions**:
- Requires SESSION_SECRET environment variable
- Users persist to PostgreSQL `users` table
- Admin role requires manual database update

---

## SECTION 2 - WORKFLOWS AND PROCESS FLOWS

### 2.1 Idea Validation Workflow

**Entry point**: Ideas page (`/ideas`) - Submit Idea form

**Sequence**:
1. User submits idea with title, description, optional context (target market, skills, budget, timeline, competitors)
2. Frontend validates input against Zod schema
3. POST `/api/ideas/analyze` sends idea to backend
4. Backend queries multiple AI providers via ConsensusService
5. AI responses are synthesized into IdeaAnalysis structure
6. Analysis returned to frontend with recommendation (proceed/revise/stop), score (0-100), risks, strengths, weaknesses, assumptions
7. User reviews analysis results
8. For proceed: User clicks "Accept" to save as artifact
9. For revise/stop: User enters Guided Refinement Workshop

**Decision points**:
- If recommendation is "stop" and user wants to accept: Must set `acknowledgeStopRecommendation: true` (audit logged)
- If no AI providers are validated: Analysis blocked, error displayed

**Required data**: Title (min 3 chars), description (min 20 chars)

**Success path**: Artifact created with stage VALIDATED_IDEA, available for requirements generation

**Failure path**: Validation errors displayed, network errors shown as toast, timeout after 45 seconds

### 2.2 Workshop Refinement Workflow

**Entry point**: Ideas page after receiving revise/stop recommendation

**Sequence**:
1. User clicks "Refine with Workshop"
2. Workshop sections generated client-side from analysis data
3. Four sections always generated: Target Market Clarity, Pain/Urgency Validation, Scope Boundaries, Constraints/Resources
4. Questions mapped to specific risks, assumptions, and scope warnings
5. User answers questions (single-select, multi-select, short-text, banded-range)
6. Resolution engine evaluates answer quality (evidence, specificity, substance)
7. Assumptions updated: unvalidated -> partially_validated -> validated
8. Risk severities adjusted: high -> medium -> low
9. User submits for re-analysis
10. Re-analysis prompt includes structured workshop findings
11. New analysis returned with before/after comparison

**Decision points**:
- Answer quality determines assumption status transition
- Related improvements determine risk severity reduction

**Required data**: At least one workshop answer

**Success path**: Improved score, recommendation may change from stop/revise to proceed

**Failure path**: No improvements detected if answers lack evidence/specificity

### 2.3 Requirements Generation Workflow

**Entry point**: Requirements page (`/requirements`)

**Sequence**:
1. User selects from validated idea artifacts
2. User clicks "Preview" to see idea summary
3. User clicks "Generate Requirements"
4. POST `/api/requirements/generate` with idea artifact ID
5. Backend validates pipeline stage (must be VALIDATED_IDEA)
6. Requirements document generated with sections: Executive Summary, Functional Requirements, Non-Functional Requirements, Tech Stack, Milestones, Constraints, Assumptions, Risks, Acceptance Criteria
7. User reviews generated requirements
8. User clicks "Accept" to save as artifact
9. Artifact saved with stage LOCKED_REQUIREMENTS

**Decision points**:
- Pipeline validation prevents generation from wrong stage
- Outdated check prevents generation if source has newer versions

**Required data**: Valid idea artifact ID in correct stage

**Success path**: Requirements artifact created, available for prompt generation

**Failure path**: Pipeline violation error if stage incorrect

### 2.4 Build Prompts Generation Workflow

**Entry point**: Prompts page (`/prompts`)

**Sequence**:
1. User selects from locked requirements artifacts
2. User selects target IDE (Replit, Cursor, Lovable, Antigravity, Warp, Generic)
3. User clicks "Generate Prompts"
4. POST `/api/prompts/generate` with requirements artifact ID and IDE
5. Backend validates pipeline stage (must be LOCKED_REQUIREMENTS)
6. Backend validates not outdated (source unchanged)
7. Prompts generated as sequential steps with IDE-specific formatting
8. Each prompt includes prerequisites, verification checkpoints, failure recovery branches
9. User can copy individual prompts or all at once
10. Prompts saved as artifact with stage PROMPTS_GENERATED

**Decision points**:
- Pipeline validation enforces correct stage
- Outdated check prevents stale prompt generation

**Required data**: Valid requirements artifact ID, IDE selection

**Success path**: Prompts artifact created, ready for external IDE execution

**Failure path**: Pipeline violation error if requirements not locked

### 2.5 Prompt Feedback Workflow

**Entry point**: Prompts page - "Resolve Step Issue" button on any step

**Sequence**:
1. User encounters failure executing prompt in external IDE
2. User clicks "Resolve Step Issue" on failing step
3. User pastes raw IDE output into textarea
4. POST `/api/prompts/feedback` with artifact ID, step number, IDE, raw output
5. Backend classifies failure against known patterns
6. For known failures: Return symptom, cause, recovery steps, retry/stop instruction
7. For unknown failures: Return unclassified statement, STOP instruction only
8. User reviews recovery guidance
9. User follows steps or stops execution

**Decision points**:
- Pattern matching determines known vs unknown classification
- shouldRetry flag indicates whether to retry step or stop

**Required data**: Prompt artifact ID, step number, IDE, raw output

**Success path**: Known failure resolved with static recovery steps

**Failure path**: Unknown failure receives only STOP instruction

---

## SECTION 3 - INPUTS AND OUTPUTS

### 3.1 Inputs

**User Inputs**:
- Idea submission: title, description, target market, skills, budget level, timeline, competitors
- Workshop answers: structured responses to generated questions
- Requirements selection: idea artifact ID
- Prompt generation: requirements artifact ID, IDE type
- Feedback submission: raw IDE output text

**Uploaded Data**: None (no file uploads implemented)

**API Payloads**:
- `/api/ideas/analyze`: IdeaInput with optional context
- `/api/requirements/generate`: ideaArtifactId
- `/api/prompts/generate`: requirementsArtifactId, ide
- `/api/prompts/feedback`: promptArtifactId, stepNumber, ide, rawOutput

**AI Prompts**: System-constructed prompts for idea analysis, requirements generation, prompt generation. Users do not directly write AI prompts.

### 3.2 Outputs

**UI-Rendered Results**:
- Idea analysis: Score, recommendation, strengths, weaknesses, risks, feasibility breakdown, assumption dependencies, scope warnings, failure mode narrative
- Workshop comparison: Before/after scores, assumption transitions, risk severity changes
- Requirements preview: Functional/non-functional requirements, milestones, constraints
- Build prompts: Sequential steps with content, prerequisites, verification checkpoints

**Stored Records (PostgreSQL)**:
- Users: id, email, name, role, billing plan, generation status
- Projects: id, name, description, generation status
- Project Members: project-user associations with roles
- Usage Records: project, user, module, provider, tokens, cost
- Admin Action Log: admin actions with timestamps and reasons
- Prompt Feedback Events: classification, instruction type, metadata

**Stored Artifacts (Filesystem)**:
- Ideas: `artifacts/ideas/{slug}_v{n}.md` - Validated idea analysis
- Requirements: `artifacts/requirements/{slug}_v{n}.md` - Locked requirements document
- Prompts: `artifacts/prompts/{slug}_v{n}.md` - Generated build prompts

**AI-Generated Content**:
- IdeaAnalysis structure with scores, risks, recommendations
- RequirementsDocument with sections and specifications
- PromptDocument with sequential build steps

**Side Effects**:
- Session creation on login
- Audit log entries for admin actions
- Feedback metrics for failure classification

---

## SECTION 4 - INTENDED USAGE MODEL

### Typical User Behavior

The platform is designed for application founders, product managers, or technical leads who have an application idea and want to validate its feasibility before committing development resources. The typical workflow is:

1. **Idea Submission**: User arrives with an application concept and submits it for AI-powered analysis
2. **Review and Refine**: User reviews the analysis, particularly the recommendation and risks. If recommendation is not "proceed," user enters the workshop to provide additional context and clarifications
3. **Accept or Iterate**: Once satisfied with the analysis (ideally "proceed" recommendation), user accepts the idea as an artifact
4. **Requirements Generation**: User generates a comprehensive requirements document from the validated idea
5. **Prompt Generation**: User selects their target IDE and generates sequential build prompts
6. **External Execution**: User copies prompts to their external IDE and executes them sequentially

### Frequency of Use

- **One-off per idea**: Each idea goes through the pipeline once (though re-analysis is possible through workshop)
- **Sequential progression**: Users progress through stages linearly; cannot skip stages
- **Session-based**: Workshop state is not persisted; must complete in single session

### Primary Value Delivered

- **Decision support**: Objective AI-consensus analysis of idea viability
- **Risk identification**: Early identification of market, technical, financial, and execution risks
- **Structured requirements**: Comprehensive specification document from idea
- **Actionable prompts**: Ready-to-use build instructions for external IDEs

### Usage Context

This platform supports **decision support and preparation** for development. Users are expected to:
- Act on outputs **outside** the platform (execute prompts in external IDEs)
- Use the platform as a **pre-development validation gate**
- Export artifacts for offline reference

---

## SECTION 5 - OPERATIONAL ASSUMPTIONS AND CONSTRAINTS

### Required User Knowledge

- Understanding of application development concepts (MVP, tech stack, requirements)
- Familiarity with at least one supported IDE
- Ability to evaluate AI-generated recommendations critically
- Understanding that AI analysis is probabilistic, not definitive

### Expected Data Completeness

- Ideas require substantive descriptions (minimum 20 characters)
- Workshop answers should provide evidence to improve analysis quality
- More context (market, skills, budget) improves analysis accuracy

### Environmental Dependencies

- AI Provider APIs: OpenAI (OPENAI_API_KEY), Anthropic (ANTHROPIC_API_KEY), Gemini (GEMINI_API_KEY)
- At least one provider must be configured and validated for analysis to function
- PostgreSQL database (DATABASE_URL) for user/project/usage persistence
- SESSION_SECRET for authentication sessions
- Replit Auth (OpenID Connect) for user authentication

### Sequential vs Parallel Usage

- Pipeline is strictly **sequential**: Idea -> Requirements -> Prompts
- Cannot generate requirements without validated idea
- Cannot generate prompts without locked requirements
- Each stage must complete before proceeding

### Single-User vs Multi-User

- **Multi-user supported**: Projects can have multiple members
- **Role-based access**: Owner, Collaborator, Viewer permissions
- **Isolated artifacts**: Projects scope all artifacts

### Constraints

- Workshop is frontend-only; state lost on page refresh
- Artifacts are file-based, not database-stored
- Admin role requires manual database update (no UI for role assignment)
- Billing is structural only (tracking exists, no actual payment processing)
- No file uploads or attachments
- No real-time collaboration

---

## SECTION 6 - MISMATCHES OR AMBIGUITIES

### 6.1 Workshop State Persistence

**Issue**: Workshop is entirely frontend-based. If user refreshes the page or navigates away, all workshop progress is lost.

**Impact**: Users may lose substantial work if they don't complete workshop in a single session. This contradicts the structured, deliberate nature of the refinement process.

### 6.2 Billing Plan Display Without Payment Processing

**Issue**: The platform displays billing plans (Free, Starter, Professional, Team) and tracks usage against plan limits, but there is no payment processing, plan selection, or upgrade flow.

**Impact**: Users may see plan information without ability to change plans. The structural billing code exists but is not operationally functional.

### 6.3 Admin Role Assignment

**Issue**: Admin role must be manually set in the database. There is no UI or API endpoint for promoting users to admin.

**Impact**: System requires database access to designate administrators, creating operational friction.

### 6.4 Prompt Execution Outside Platform

**Issue**: Generated prompts are designed for execution in external IDEs. The platform has no way to track actual execution status, verify completion, or ensure prompts are used correctly.

**Impact**: The platform cannot provide end-to-end visibility. Users must manually track which prompts they've executed and their outcomes.

### 6.5 Artifact Module vs Database Persistence Mismatch

**Issue**: Core artifacts (ideas, requirements, prompts) are stored as Markdown files, while operational data (users, projects, usage) is in PostgreSQL. This dual-storage approach creates potential consistency issues.

**Impact**: Database rollbacks do not affect artifacts; file system issues do not affect database. Backup/restore procedures must account for both systems.

### 6.6 STOP Recommendation Override Flow

**Issue**: Users can accept STOP-recommended ideas with acknowledgment, but the UI flow for this is not prominently surfaced. The audit logging exists but the user experience around this critical decision point is minimal.

**Impact**: Users may not fully understand the gravity of proceeding against a STOP recommendation.

---

## SECTION 7 - USAGE SUMMARY (PLAIN ENGLISH)

This platform is designed to help users validate application ideas before committing to development. A real user would start by logging in (via Replit authentication) and creating or selecting a project. They then navigate to the Ideas section and submit their application concept with a title and description, optionally adding context like target market and budget constraints.

The platform sends this idea to multiple AI providers, synthesizes their analyses, and returns a scored assessment with a recommendation: proceed (build it), revise (needs refinement), or stop (fundamental issues). If the recommendation is not "proceed," the user enters a structured workshop that asks targeted questions about their market, pain points, scope boundaries, and resource constraints. Their answers help refine the analysis and may improve the recommendation.

Once satisfied, the user accepts the idea, which saves it as an artifact. They then move to the Requirements section, select their validated idea, and generate a comprehensive requirements document. Finally, they proceed to the Prompts section, choose their target IDE (like Replit or Cursor), and generate sequential build prompts. The user copies these prompts to their external IDE and executes them step-by-step to build their application.

Throughout this process, usage is tracked, and administrators can monitor AI provider health, usage statistics, and manage user/project generation permissions via the Admin console. The platform acts as a pre-development validation and specification gate, with actual application building happening outside the platform in the user's chosen IDE.
