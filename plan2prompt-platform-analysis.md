# Plan2Prompt -- Platform Analysis

**Version 2.0 | MTE Software Ltd**
**Date: March 2026**
**Prepared for: Internal Review**

A factual, implementation-aware explanation of the platform's capabilities and intended usage, derived from the codebase as of March 2026.

---

## Section 1 -- Platform Capabilities

### 1.1 User Authentication and Account Management

**What it does:** Allows users to register and sign in via two methods: Replit Auth (OpenID Connect redirect flow) and local email/password credentials (bcryptjs, 12 salt rounds). Authenticated users receive a PostgreSQL-backed session (connect-pg-simple, 1-week TTL). Users can export all their data as JSON, permanently delete their account (anonymises PII, revokes API keys, destroys session), and generate API keys for MCP access.

**Roles:** All users. Account deletion and data export are self-service.

**Codebase location:** `server/replit_integrations/auth/`, `server/routes/account.routes.ts`, `client/src/pages/auth.tsx`, `client/src/pages/account.tsx`.

**Conditions:** Registration and login routes are rate-limited (login: 10/15min per IP; register: 5/hour per IP). Passwords must meet minimum requirements enforced by Zod validation.

---

### 1.2 Project Management

**What it does:** Users create named projects that serve as isolation boundaries for all pipeline artifacts. Each project has members with roles (owner, collaborator, viewer) that control permissions. A user must have at least one project to access pipeline features; a "No Project Gate" enforces this.

**Roles:** Any authenticated user can create projects. Owners can edit, delete, and manage members. Collaborators can edit and generate. Viewers have read-only access.

**Codebase location:** `server/routes/project.routes.ts`, `client/src/components/project-context.tsx`, `server/middleware/project-context.ts`.

**Conditions:** An `X-Project-Id` header or active project context is required for all pipeline operations. Membership is verified server-side on every request.

---

### 1.3 Idea Validation (Ideas Module)

**What it does:** Accepts a raw application idea (title, description, purpose category) and runs it through multi-provider AI consensus analysis. Returns structured JSON scoring the idea across four profiles: Technical, Commercial, Execution, and Viability. Includes strengths, weaknesses, risks, feasibility assessment, domain research (competitors, market signals), and a weighted recommendation. Offers a guided refinement workshop that generates purpose-adaptive follow-up questions to strengthen weak areas. Produces a Risk Resolution Delta Model showing how workshop answers change the risk profile. Validated ideas are saved as versioned Markdown artifacts with YAML frontmatter.

**Roles:** Authenticated users with collaborator or owner role on the active project.

**Codebase location:** `server/services/ideas.service.ts`, `server/routes/ideas.routes.ts`, `client/src/pages/ideas.tsx`.

**Conditions:** Requires at least one active AI provider. Generation can be disabled per-user or per-project by an admin. Rate-limited to 5 generation requests per minute per user.

---

### 1.4 Requirements Generation (Requirements Module)

**What it does:** Converts a validated (accepted) idea artifact into a comprehensive requirements document. The output includes a system overview, functional requirements, non-functional requirements, data models, API contracts, architecture decisions (ADRs), and risk traceability entries linking idea-level risks to specific requirement IDs. Requirements are saved as versioned Markdown artifacts and can be "locked" to signal readiness for prompt generation.

**Roles:** Authenticated users with collaborator or owner role.

**Codebase location:** `server/services/requirements.service.ts`, `server/routes/requirements.routes.ts`, `client/src/pages/requirements.tsx`.

**Conditions:** Requires at least one accepted idea artifact in the active project. Pipeline sequencing is enforced: requirements generation is blocked if no validated ideas exist.

---

### 1.5 Build Prompt Generation (Prompts Module)

**What it does:** Generates sequential, IDE-specific build prompts from locked requirements. Supports six target IDEs: Replit, Cursor, Lovable, Antigravity, Warp, and Generic. Each prompt step includes a title, body text, integrity level (safe, caution, critical), idempotency flag, requirements coverage, and dependencies. Steps can be individually compiled by Anthropic Opus into deterministic IDE-executable instructions with stop conditions and failure recovery. Prompts are saved as versioned Markdown artifacts.

**Roles:** Authenticated users with collaborator or owner role.

**Codebase location:** `server/services/prompts.service.ts`, `server/routes/prompts.routes.ts`, `client/src/pages/prompts.tsx`.

**Conditions:** Requires at least one locked requirements artifact. Pipeline sequencing is enforced: prompt generation is blocked if no locked requirements exist.

---

### 1.6 Execution Session Tracking

**What it does:** Tracks the progress of implementing build prompts step-by-step. Users start an execution session tied to a prompt artifact, then mark each step as completed or report failures. The system classifies failures deterministically (known vs unknown), escalates after repeated failures (creating clarification contracts at escalation level 2+), and tracks step timing (startedAt/completedAt). Steps have integrity levels and idempotency flags that warn users before executing critical, non-idempotent operations.

**Roles:** Authenticated users with collaborator or owner role.

**Codebase location:** `server/routes/execution.routes.ts`, `client/src/pages/prompts.tsx` (execution session UI).

**Conditions:** Requires a generated prompt artifact. Sequential execution is enforced: steps cannot be completed out of order.

---

### 1.7 Clarification Contract System

**What it does:** Provides an upward-only clarification mechanism where downstream modules (requirements, prompts, execution) can request clarification from upstream artifacts. Each contract has a category (missing_information, contradiction, scope_conflict, execution_failure), severity (advisory or blocker), and a SHA-256 deterministic hash to prevent duplicates. Blockers halt pipeline progress until resolved. Contracts can be resolved from the web UI or via MCP tools.

**Roles:** System-generated. Resolved by authenticated users or IDE agents via MCP.

**Codebase location:** `server/services/clarification.service.ts`, `server/routes/clarification.routes.ts`.

**Conditions:** Contracts are created automatically during generation or execution failure escalation.

---

### 1.8 Artifact Management

**What it does:** All pipeline outputs (ideas, requirements, prompts) are stored as immutable, versioned artifacts in PostgreSQL. Each artifact has a module, filename, content (Markdown with YAML frontmatter), metadata (JSON), and lineage references (parentId for versions, sourceArtifactId for cross-module links). Artifacts can be exported as downloadable Markdown files. Version history is viewable through Sheet overlay panels with diff comparison.

**Roles:** Any authenticated project member (read). Collaborators and owners (create/version).

**Codebase location:** `server/routes/artifact.routes.ts`, `client/src/components/version-history-panel.tsx`, `client/src/components/version-compare-panel.tsx`.

**Conditions:** Export requires the artifact to be in a terminal state (accepted idea, locked requirements, generated prompts).

---

### 1.9 MCP Server (v1.2)

**What it does:** Exposes the platform's pipeline context and execution tracking to IDE AI assistants (Cursor, Windsurf, Claude Code) via the Model Context Protocol. Uses Streamable HTTP transport at `/mcp`. Authenticates via API keys (SHA-256 hashed, `p2p_` prefix). Provides 11 tools (start_session, get_session_status, get_current_step, complete_step, batch_complete_steps, report_failure, skip_to_step, classify_failure, list_clarifications, get_clarification, resolve_clarification) and 6 resources (project://requirements, project://idea-analysis, project://prompt-steps, project://prompt-steps-structured, project://session-state, project://execution-progress). Supports per-request project switching via `X-Project-Id` header override.

**Roles:** Any user with a valid API key and project membership.

**Codebase location:** `server/mcp/server.ts`, `server/mcp/tools/`, `server/mcp/resources/`, `server/mcp/auth.ts`.

**Conditions:** Requires a generated API key. Rate-limited to 60 requests per minute per user. Expired sessions return 409 with reconnection instructions.

---

### 1.10 Admin Console

**What it does:** Provides platform-wide management for administrators across 8 tabs. Overview shows KPI stat cards, user growth, plan distribution, and recent signups. Users tab supports search, filtering by plan, inline plan changes, and enabling/disabling generation. Projects tab shows member and artifact counts with enable/disable controls. Health tab displays AI provider status including circuit breaker state. Billing, Usage, Artifacts, and Audit Log tabs provide operational visibility. All admin actions are logged to the `admin_action_log` table.

**Roles:** Admin users only (verified by `requireAdmin` middleware).

**Codebase location:** `server/routes/admin.routes.ts`, `server/middleware/admin.ts`, `client/src/pages/admin.tsx`.

**Conditions:** User must have `isAdmin` set to `"true"` in the database.

---

### 1.11 Prompt Feedback and Failure Classification

**What it does:** Accepts raw IDE output when a build step fails and classifies it deterministically into known failure patterns with recovery instructions (retry_step, stop_execution, regenerate_prompts). Records feedback events to `prompt_feedback_events` table for pattern analysis.

**Roles:** Authenticated users (web UI) or MCP clients (IDE).

**Codebase location:** `server/services/classifier.service.ts`, `server/routes/prompts.routes.ts`.

**Conditions:** Requires an active execution session with a failing step.

---

### 1.12 Usage and Billing Tracking

**What it does:** Records per-provider token consumption and estimated costs for every AI generation call. Tracks monthly per-user generation counts and token totals in the `billing_usage` table. Supports four plan tiers (free, starter, professional, team) assigned by admins. No payment processing is implemented; plans are assigned manually.

**Roles:** Usage is tracked for all users. Billing data is viewable by admins and the individual user.

**Codebase location:** `server/services/usage.service.ts`, `server/services/billing.service.ts`, `shared/schema.ts` (billingUsage, usageRecords tables).

**Conditions:** Usage recording happens automatically during AI generation. Plan assignment is admin-only.

---

## Section 2 -- Workflows and Process Flows

### 2.1 Idea Validation Workflow

**Entry point:** Ideas page (`/ideas`) in the web UI.

**Sequence:**
1. User enters an idea title, description, and selects a purpose category (Commercial, Dev Tool, Internal, Learning, Open Source).
2. User clicks "Analyse." The frontend opens an SSE connection to `/api/ideas/analyze-stream`.
3. The server builds an analysis prompt incorporating domain research (competitors, market signals) and sends it to all active AI providers in parallel via ConsensusService.
4. Each provider returns structured JSON with scores, strengths, weaknesses, risks, and profiles. The ConsensusService aggregates results, calculates agreement scores, and synthesises a unified analysis.
5. Real-time progress updates stream to the UI via SSE.
6. The analysis result is displayed with profile cards (Technical, Commercial, Execution, Viability), risk cards, and a recommendation.
7. **Decision point:** User can accept the idea (saves as versioned artifact), refine it (enters the guided workshop), or discard it.
8. If workshop is chosen: the server generates purpose-adaptive follow-up questions. The user answers them. The system recalculates the analysis incorporating workshop answers and produces a Risk Resolution Delta showing how risks changed.
9. User accepts the refined idea, creating a versioned artifact.

**Failure paths:** AI provider failures are caught by the circuit breaker. If all providers fail, the user receives an error message. Mock responses are generated if API keys are missing (development only).

---

### 2.2 Requirements Generation Workflow

**Entry point:** Requirements page (`/requirements`) in the web UI.

**Sequence:**
1. User selects a validated idea from the dropdown of accepted ideas.
2. User clicks "Generate Requirements." The frontend opens an SSE connection to `/api/requirements/generate-stream`.
3. The server retrieves the idea artifact, constructs a requirements generation prompt, and sends it to the configured AI provider with high token limits (8000).
4. The AI returns structured JSON with system overview, functional requirements, non-functional requirements, data models, API contracts, architecture decisions, and risk traceability entries.
5. The server validates and normalises the AI response, resolving cross-references between requirements and risks.
6. Progress streams to the UI via SSE.
7. The requirements document is displayed with expandable sections for each category.
8. **Decision point:** User can edit individual requirements, regenerate, or accept ("lock") the document.
9. Locking creates a versioned artifact and makes it available for prompt generation.

**Failure paths:** Validation failures in the AI response trigger re-prompting or error display. If the idea artifact is not found, the generation is blocked.

---

### 2.3 Build Prompt Generation Workflow

**Entry point:** Prompts page (`/prompts`) in the web UI.

**Sequence:**
1. User selects a locked requirements artifact.
2. User chooses a target IDE from the dropdown (Replit, Cursor, Lovable, Antigravity, Warp, Generic).
3. User clicks "Generate Prompts." The server derives sequential build steps from the requirements document.
4. Steps are sent to AI providers (in race mode) for enrichment into IDE-specific, copy-paste-ready instructions.
5. Optionally, individual steps can be further compiled by Anthropic Opus into deterministic instructions with stop conditions.
6. The generated prompt document is displayed as a numbered list of steps with integrity level badges (safe/caution/critical) and idempotency indicators.
7. User can edit individual steps, regenerate, or accept the prompt set.
8. Accepting saves a versioned prompt artifact.

**Failure paths:** If no locked requirements exist, the UI blocks generation and explains the prerequisite. AI failures fall through to the circuit breaker.

---

### 2.4 Execution Session Workflow

**Entry point:** Prompts page (execution panel) or MCP `start_session` tool.

**Sequence:**
1. User starts an execution session for a prompt artifact.
2. The system creates a session record and individual step records (one per prompt step, all in `not_started` state).
3. The user (or IDE agent via MCP) retrieves the current step via the UI or `get_current_step`.
4. The step transitions to `in_progress` (sets `startedAt` timestamp).
5. The user implements the step in their IDE and marks it as completed (sets `completedAt`).
6. **Failure path:** If the step fails, the user submits the error output. The ClassifierService identifies the failure pattern and returns a recommendation (retry, stop, regenerate). The system increments the attempt counter and escalation level.
7. At escalation level 2+, a clarification contract is automatically created as a blocker.
8. Steps proceed sequentially until all are completed or the session is blocked.
9. Batch completion via `batch_complete_steps` handles the reconnection case where multiple steps were completed offline.

**Decision points:** After each failure, the system recommends an action. Critical, non-idempotent steps require explicit user confirmation before execution.

---

### 2.5 MCP Integration Workflow

**Entry point:** IDE (Cursor, Windsurf, Claude Code) connecting to `POST /mcp`.

**Sequence:**
1. IDE sends an `initialize` JSON-RPC request with Bearer API key and `X-Project-Id` header.
2. Server authenticates the key, verifies project membership, and creates a session.
3. IDE discovers available tools and resources.
4. IDE reads `project://requirements` and `project://prompt-steps-structured` to understand the project context.
5. IDE calls `start_session` or retrieves existing session via `get_session_status`.
6. IDE enters a loop: `get_current_step` -> implement -> `complete_step` or `report_failure`.
7. If failures escalate, the IDE can `list_clarifications` and `resolve_clarification` directly.
8. Session completes when all steps are done.

**Failure paths:** Expired sessions return 409 with reconnection instructions. Rate limit exceeded returns JSON-RPC error code -32029. Invalid API key returns 401.

---

### 2.6 Admin Management Workflow

**Entry point:** Admin Console (`/admin`) in the web UI.

**Sequence:**
1. Admin navigates to the Admin Console (only visible if `isAdmin` is true).
2. Overview tab shows KPIs: total users, active projects, generation counts, plan distribution.
3. Admin can search and filter users, change billing plans inline, enable/disable generation for specific users or projects.
4. Health tab shows AI provider status with circuit breaker state (CLOSED/OPEN/HALF_OPEN).
5. Admin can disable a provider, which prevents it from being used in consensus queries.
6. All admin actions are logged to the audit log with timestamps, previous state, and new state.

---

## Section 3 -- Inputs and Outputs

### 3.1 Inputs

**User inputs:**
- Idea submissions: title (string), description (string), purpose category (enum).
- Workshop answers: free-text responses to AI-generated follow-up questions.
- Requirements edits: inline modifications to generated requirement text.
- Prompt step edits: inline modifications to generated prompt step text.
- IDE selection: dropdown choice from 6 supported IDEs.
- Execution step status: completed or failed (with error output text).
- Clarification resolutions: free-text response to clarification contract questions.
- Project creation: name (string), description (string).
- Account credentials: email, password (local auth).
- API key labels: user-defined string for MCP key identification.

**API payloads (MCP):**
- JSON-RPC requests with tool name, arguments object, session ID header, project ID header, Bearer API key.

**AI prompts:**
- Structured system prompts with JSON schema enforcement for each pipeline stage.
- Domain research queries for competitor and market signal discovery.
- Workshop question generation prompts conditioned on idea purpose and weakness areas.

### 3.2 Outputs

**UI-rendered results:**
- Idea analysis cards with profile scores, strengths, weaknesses, risks, recommendation.
- Requirements documents with expandable sections, cross-referenced IDs.
- Build prompt step lists with integrity badges, dependency indicators, and execution progress.
- Pipeline dashboard showing each idea's journey through the pipeline.
- Admin dashboard with charts, tables, and health indicators.

**Stored records (PostgreSQL):**
- Artifacts table: versioned Markdown content with YAML frontmatter and JSON metadata.
- Execution sessions and steps: status, timing, failure hashes, escalation levels.
- Clarification contracts: category, severity, resolution status, contract hash.
- Usage records: per-provider token counts and estimated costs.
- Billing usage: monthly per-user generation and token aggregates.
- Admin action log: timestamped audit trail of all admin operations.
- Prompt feedback events: failure classification records.
- API keys: SHA-256 hashed keys with usage timestamps.

**Files and exports:**
- Markdown artifact export: downloadable `.md` files with Content-Disposition headers.
- Account data export: JSON file containing user profile, projects, API keys, billing, artifacts, and sessions.

**AI-generated content:**
- Idea analysis: structured JSON with scores, profiles, risks, market research.
- Requirements documents: structured JSON with FRs, NFRs, data models, API contracts, ADRs.
- Build prompts: sequential step arrays with integrity classification.
- Workshop questions: contextual follow-up questions for idea refinement.
- Failure classifications: pattern matching results with recovery instructions.

**Side effects:**
- Session creation/destruction on login/logout.
- Circuit breaker state changes on AI provider failures.
- Clarification contract creation on execution failure escalation.
- Billing usage increment on every AI generation call.

---

## Section 4 -- Intended Usage Model

### 4.1 Typical User Behaviour

A user begins by creating a project, then submitting an application idea for AI validation. The platform scores the idea across multiple dimensions and highlights risks. If the idea has weaknesses, the user engages with the guided workshop to refine it. Once satisfied, the user accepts the idea and moves to requirements generation, which produces a comprehensive technical specification. After reviewing and locking the requirements, the user generates IDE-specific build prompts. These prompts are either followed manually in the web UI (marking steps complete/failed) or consumed directly by an IDE AI assistant via the MCP server.

### 4.2 Frequency of Use

The platform supports both one-off and recurring use patterns. A single project may go through the full pipeline once (idea to prompts) and then shift entirely to execution tracking. Users with multiple project ideas would return repeatedly to validate and develop each one. The MCP integration is designed for sustained use during the active build phase.

### 4.3 Primary Value Per Session

Each session produces a concrete, progressively more detailed artifact: a validated idea analysis, a structured requirements document, or a set of executable build prompts. The value compounds through the pipeline -- each stage builds on verified outputs from the previous stage, reducing the risk of building the wrong thing.

### 4.4 Platform Category

Plan2Prompt is a decision support and automation platform. It supports decision-making (should this idea be built?) and automates the translation of validated ideas into actionable build instructions. It does not build the application itself; it produces the instructions for building it.

### 4.5 Acting on Outputs

Users are expected to act on outputs outside the platform. The final build prompts are executed in an external IDE. The MCP server bridges this gap by allowing the IDE's AI assistant to consume prompts and report progress back to the platform, but the actual code generation and execution happens in the IDE environment.

---

## Section 5 -- Operational Assumptions and Constraints

### 5.1 Assumptions

- **AI API keys are available and funded.** The platform requires at least one of OpenAI, Anthropic, or Gemini API keys to function. Without keys, it falls back to mock responses that are useful only for UI testing.
- **Users understand the concept of an application idea.** The platform does not teach product thinking. It assumes the user has a concept they want to validate.
- **IDE users are technically proficient.** The MCP integration assumes the user is working with an AI-capable IDE and understands how to configure MCP servers, manage API keys, and interpret build instructions.
- **Sequential pipeline usage.** The platform enforces Ideas -> Requirements -> Prompts ordering. Users cannot skip stages.
- **Single active execution session per prompt artifact.** Only one execution session can be active for a given prompt at a time.

### 5.2 Constraints

- **No payment processing.** Billing plans (free, starter, professional, team) exist in the data model but are assigned manually by admins. There is no Stripe integration, checkout flow, or automated plan enforcement beyond usage tracking.
- **No email system.** The platform does not send emails for any purpose (verification, notifications, password reset).
- **No real-time collaboration.** While projects support multiple members, there is no presence awareness, live cursors, or real-time sync between users viewing the same artifact.
- **In-memory MCP sessions.** MCP sessions are stored in memory and lost on server restart. The server handles this gracefully with 409 reconnection messages, but clients must re-initialise.
- **Single-server deployment.** The in-memory MCP session store and circuit breaker state do not sync across multiple server instances. The platform assumes a single-process deployment.
- **AI response quality varies.** The consensus approach mitigates this, but individual provider responses may contain hallucinated requirements, unrealistic architecture decisions, or superficial risk assessments. The platform validates and normalises AI responses but does not guarantee correctness.
- **No offline mode.** The platform requires an active server connection for all operations.

---

## Section 6 -- Mismatches or Ambiguities

### 6.1 Billing Plans Without Enforcement

The `billingPlan` field on users and the `billing_usage` table track plan tiers and usage metrics, but no logic enforces plan limits. A "free" user and a "professional" user have identical access to all features. The admin can change plans, and usage is tracked, but there are no gates that restrict generation counts, token limits, or feature access based on plan tier. This creates a data model that suggests monetisation but does not implement it.

**Why it matters:** Users or stakeholders may expect plan-based restrictions that do not exist. The billing tab in the admin console displays data but does not reflect enforced constraints.

### 6.2 Generation Disabled Flag Without User-Facing Explanation

Admins can disable generation for specific users or projects via the admin console, setting a `generationDisabled` flag and optional `generationDisabledReason`. However, the reason is stored in the database and surfaced in admin views -- it is not clear whether the affected user sees a meaningful explanation in the UI when they attempt to generate and are blocked.

**Why it matters:** A user whose generation is disabled may encounter a generic error without understanding why or how to resolve it.

### 6.3 MCP Push Notifications Not Implemented

The MCP gap resolution document (referenced in project history) identified push notifications as gap item 3 -- the ability to push events (blocker created, session invalidated, clarification resolved) to connected IDE clients via SSE. This was evaluated and intentionally deferred because the SDK transport layer does not cleanly support server-initiated messages. IDE clients must poll for state changes.

**Why it matters:** IDE integrations feel less responsive than they could. Clients must periodically check for new clarifications or session invalidation rather than being notified.

### 6.4 Six IDE Templates Coexist With Structured Resource

The platform maintains six hardcoded IDE format templates (Replit, Cursor, Lovable, Antigravity, Warp, Generic) used by the web UI for Markdown-formatted prompt display. The MCP server also provides `project://prompt-steps-structured` which returns raw JSON for programmatic consumption. Both serve the same content in different formats, which is intentional, but the templates are not configurable or extensible by users.

**Why it matters:** Adding support for a new IDE requires code changes to the template system rather than configuration.

### 6.5 Workshop Refinement Not Persisted Independently

The guided workshop flow (questions, answers, risk delta) is part of the idea analysis process. Workshop answers influence the final accepted idea artifact, but the individual question-answer pairs and the risk delta calculation are not stored as separate queryable records. They are embedded in the artifact content or metadata.

**Why it matters:** Analysing workshop effectiveness or extracting common refinement patterns across ideas requires parsing artifact content rather than querying structured data.

---

## Section 7 -- Usage Summary (Plain English)

A user signs in, creates a project, and submits an application idea -- a title and description of something they want to build. The platform sends that idea to multiple AI models simultaneously and returns a structured analysis covering technical feasibility, commercial viability, risks, and a recommendation. If the idea has weaknesses, the user works through a guided workshop to strengthen it. Once the idea passes validation, the user generates a full requirements document from it -- functional requirements, data models, API contracts, and architecture decisions. After reviewing and locking the requirements, the user selects their target IDE and generates a set of sequential build prompts: step-by-step instructions for building the application. These prompts can be followed manually through the web UI's execution tracker, or consumed directly by an IDE's AI assistant through the MCP server, which lets the IDE read requirements, receive instructions, mark steps complete, and report failures back to the platform without leaving the editor.

The core value proposition is structured risk reduction: the platform ensures an idea is validated before requirements are written, and requirements are locked before build instructions are generated. Each stage produces a versioned, exportable artifact that serves as the verified input for the next stage. The MCP server closes the gap between planning (in the browser) and building (in the IDE) by giving the IDE's AI assistant direct access to the project's context and execution state.

---

*MTE Software Ltd -- March 2026*
