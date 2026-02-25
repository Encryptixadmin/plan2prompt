# Plan2Prompt — Product Document

**Version 1.0.5 | MTE Software Ltd**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Functional Areas](#2-functional-areas)
3. [User Flows](#3-user-flows)
4. [Use Cases](#4-use-cases)
5. [Technical Architecture](#5-technical-architecture)
6. [Integration Points](#6-integration-points)
7. [Quality and Reliability](#7-quality-and-reliability)

---

## 1. Executive Summary

### What It Is

Plan2Prompt is an AI-powered build planning platform. It transforms raw software ideas into structured, step-by-step development instructions ready to be executed in a developer's IDE — without requiring the user to write a single line of specification themselves.

### The Problem It Solves

Most software projects fail before a line of code is written. Founders guess at feasibility. Developers scaffold without a plan. Teams spend weeks on requirements documents that drift from reality. And when building begins, there is no systematic way to know whether an idea is worth pursuing at all.

Plan2Prompt addresses this at every stage: it validates whether an idea is viable, converts that validated idea into a complete requirements document, and then generates sequential, context-aware build instructions tailored to the developer's chosen environment.

### Who It Is For

- **Non-technical founders** who need to validate and communicate what they want built before engaging developers.
- **Solo developers** who want structured build plans instead of starting from scratch.
- **Small teams and agencies** who need a repeatable process for going from concept to code.
- **Enterprise teams** standardising how internal tooling ideas are scoped and developed.

### Core Value Proposition

The platform is not a prompt generator. It is a **build pipeline**. Each stage must complete before the next can begin. AI consensus is used — not a single model, but multiple independent providers — to surface disagreements, reduce blind spots, and produce a more reliable output. Every output is a versioned, immutable artifact. Every build instruction traces back to a requirement. Every requirement traces back to the original idea.

---

## 2. Functional Areas

### 2.1 Ideas Module

The Ideas Module is the entry point to the pipeline. It accepts a free-text description of a software idea, optionally enriched with context about the target market, team size, budget range, timeline, and known competitors, and produces a comprehensive AI-driven analysis.

#### Idea Submission

Users submit their idea through a structured form with the following fields:

- **Title** — a short label for the idea
- **Description** — free text describing what the user wants to build
- **Purpose** — one of: `commercial`, `developer_tool`, `internal`, `open_source`, or `learning`
- **Context** — optional target market, skills available, budget band (`low`, `medium`, `high`, `enterprise`), timeline, and known competitors

The purpose classification determines which system prompt is used for analysis, ensuring that a commercial SaaS idea is evaluated on commercial criteria rather than open-source ones.

#### Domain Research

Before AI analysis begins, a **Research Service** generates a research brief covering competitors, relevant regulations, industry specifics, and market signals. This brief is cached for 30 minutes and injected into the analysis context. This prevents models from producing generic assessments that ignore industry-specific realities.

#### Multi-Provider Consensus Analysis

The idea is sent independently to multiple AI providers (OpenAI, Anthropic, Gemini). Each provider returns a structured JSON response covering:

- **Strengths** — with confidence scores per item
- **Weaknesses** — with severity ratings (`low`, `medium`, `high`) and optional mitigations
- **Risks** — categorised as market, technical, financial, legal, competitive, or execution
- **Feasibility Assessment** — scored 0–100 across technical, market, financial, and timeline dimensions
- **Structured Profiles**:
  - **TechnicalProfile**: architecture complexity, integration difficulty, data complexity, compliance exposure, estimated MVP effort in weeks, key technical risks
  - **CommercialProfile**: market clarity, revenue model clarity, competition density, differentiation strength, go-to-market complexity, key commercial risks
  - **ExecutionProfile**: team complexity, hidden work likelihood, scalability challenges, operational risks
  - **ViabilityAssessment**: overall viability band (Strong / Moderate / Weak / Critical Risk), confidence score, rationale
- **Signal Sharpening Fields**:
  - **ConfidenceAssessment** — score, rationale, key factors, and explicit limitations of the analysis
  - **Primary Risk Drivers** — ranked by impact, with failure triggers and controllability ratings
  - **Scope Warnings** — hidden complexity flags across technical, UX, operations, compliance, integration, and data areas
  - **Assumption Dependencies** — tracked assumptions with validation status and risk if wrong
  - **Failure Mode Narrative** — a prose account of how the idea is most likely to fail
- **Overall Score** — computed via a weighted formula: viability 40%, technical complexity 25%, commercial clarity 20%, execution risk 15%
- **Recommendation** — one of `proceed`, `revise`, or `stop`

#### Decision Rules (Applied Before Score Thresholds)

The platform applies a set of deterministic recommendation rules before consulting raw scores:

- **Compliance + Solo team → STOP**: Regulated domains with no compliance expertise are blocked regardless of score.
- **Effort > 24 weeks + Solo → REVISE**: Solo founders with high-effort MVPs receive a revision recommendation.
- **Weak differentiation + High competition → REVISE**: Undifferentiated ideas in crowded markets are flagged.

#### Refined Workshop

Once an idea has been analysed, users can enter the **Guided Refinement Workshop**. The workshop generates purpose-adaptive open-ended questions that reference the specific idea and its analysis findings — not generic questions. Responses are submitted conversationally and stored as part of the idea's context.

Refinement re-runs the analysis using a dedicated system prompt that instructs AI providers to build on prior analysis, workshop Q&A evidence, and research findings rather than starting fresh. This produces an updated analysis that can be compared to the original.

#### Risk Resolution Delta Model

After workshop refinement, the platform computes a **Risk Resolution Delta** — a deterministic measure of how much each identified risk improved during refinement. The delta model works as follows:

- Assumption status transitions drive risk severity changes:
  - `unvalidated → partially_validated`: one severity reduction
  - `partially_validated → validated`: one severity reduction
  - `unvalidated → validated`: two severity reductions (never below `low`)
- A per-risk improvement score is calculated, capped at +15 points total
- The frontend renders a **Workshop Comparison** view showing severity transitions, assumption changes, and improvement scores side-by-side

#### Artifact Output

Every analysis produces an immutable, versioned Markdown artifact: `ideas-reference-{title}_v{n}.md`, stored with YAML frontmatter containing pipeline stage, version number, creation timestamp, and source idea ID.

---

### 2.2 Requirements Module

The Requirements Module converts a validated idea into a comprehensive technical requirements document. It is gated: it can only be triggered once an idea has reached the `VALIDATED_IDEA` stage.

#### AI-Driven Structured Generation

Requirements are generated by instructing AI providers to return a strict JSON schema. The system does not use templates. Instead, the AI is asked to produce:

- **System Overview**: purpose, core user, primary outcome
- **Functional Requirements (FRs)**: each with a unique ID, description, priority, acceptance criteria, originating risk IDs, and originating assumption IDs
- **Non-Functional Requirements (NFRs)**: performance, security, scalability, maintainability
- **Data Model**: entities, attributes, and relationships
- **API Contracts**: endpoints, request/response shapes, authentication requirements
- **Architecture Decisions**: each with a decision, rationale, considered alternatives, and tradeoffs
- **Risk Traceability**: mapping from idea risks to specific requirement IDs, with coverage type (fully-mitigated, partially-mitigated, unmitigated)

#### Normalisation and Validation

Provider responses vary. Fifteen-plus normalisation methods handle the variance: NFRs may come as arrays or objects; data models may use singular or plural keys; API contracts may be arrays or keyed objects. All are normalised to a consistent internal format before storage.

#### Bidirectional Traceability

Every Functional Requirement includes `originatingRiskIds` and `originatingAssumptionIds`, populated by cross-referencing the risk traceability table. This creates a full bidirectional link: idea risk → requirement → build prompt step.

#### Artifact Output

Requirements produce: `requirements-reference-{title}_v{n}.md`

---

### 2.3 Prompts Module

The Prompts Module converts locked requirements into sequential, IDE-specific build instructions. It is gated: it can only be triggered once requirements reach the `LOCKED_REQUIREMENTS` stage.

#### Dynamic Prompt Generation

Prompts are not generated from a static template. Instead, `generatePromptsFromRequirements(requirementsDoc)` dynamically derives each step from the structured RequirementsDocument:

- **Ordering**: architecture → data model → API → UI → security → performance → polish
- **Coverage**: high-priority FRs receive dedicated steps; medium-priority FRs are grouped by category
- **NFR embedding**: security and performance NFRs are mapped to dedicated steps or embedded as constraints within relevant steps
- **Scope guardrails**: explicit out-of-scope items from the requirements are injected as constraints in relevant steps

Each step includes:
- A title and detailed prompt body
- `requirementsCovered` — the specific FR/NFR/AD IDs this step addresses (non-optional)
- `integrityLevel` — `safe`, `caution`, or `critical` (auto-assigned, see below)
- `isIdempotent` — boolean indicating whether re-running this step is safe

#### IDE Adaptation

The prompt content is adapted for six IDE targets: **Replit**, **Cursor**, **Lovable**, **Antigravity**, **Warp**, and **Generic**. IDE adaptation is a formatting-only layer — it does not change the substance of any step, only how it is presented and what contextual instructions are included.

#### Prompt → Requirement Traceability

Every PromptStep explicitly links to one or more requirement IDs. Every requirement ID maps to an existing FR, NFR, or Architecture Decision. Every Functional Requirement traces back to idea risk drivers. The full chain — PromptStep → requirementId → riskId — is deterministic and enforced at generation time.

#### Execution Integrity Controls

Every build step is classified using deterministic keyword scanning of its title and body:

- **Critical** (non-idempotent): Steps containing keywords such as `DROP`, `DELETE`, `migration`, `ALTER TABLE`, `seed`, `install`, `npm install`, `yarn add`, `schema`, or `database setup`
- **Caution** (non-idempotent): Steps containing `add route`, `create endpoint`, `append`, or `modify`
- **Safe** (idempotent): All other steps

Critical classification takes priority over caution. Matching is case-insensitive.

Non-idempotent steps that have already completed cannot be re-run without explicit override confirmation. Critical steps display a stronger warning before override is permitted.

#### Artifact Output

Prompts produce: `build-prompts-{title}-{ide}_v{n}.md`

---

### 2.4 Execution State Tracking

Once build prompts are generated, users can start an **Execution Session** to track their progress through the steps.

#### Sessions

Each session is persisted to PostgreSQL (`execution_sessions` table) and records:

- The active project and prompt artifact version (pinned at session creation)
- Session status: `active`, `blocked`, or `completed`
- Current step number

Sessions can be resumed across page refreshes. If the underlying prompt artifact is updated after a session starts, the session is marked as **invalidated** and the user is notified before continuing.

#### Step Enforcement

Steps are tracked in the `execution_steps` table. The platform enforces sequential execution: a step cannot be marked complete unless the previous step is already completed. Each step records:

- Attempt count and last failure hash (SHA256)
- Re-execution count and success hash (SHA256 of completion fingerprint)
- Integrity override confirmation status
- Duplicate failure detection flag

#### Failure Classification

When a step fails, the user submits the failure output. The **Classifier Service** matches it against the **Failure Taxonomy** — a library of 12+ named failure patterns across categories:

| Category | Example Patterns |
|---|---|
| Dependency | NPM ERESOLVE, peer dependency conflict |
| Syntax | TypeScript compilation error |
| Environment | Port already in use, module not found |
| Network | Database connection refused, CORS error |
| Permission | Migration permission denied |
| Runtime | Undefined reference error, bcrypt native bindings |
| Configuration | Missing environment variable, JWT validation failure |
| Tooling | Tailwind styles not applying |

Each failure pattern includes: cause description, static recovery steps, retry permission, regeneration recommendation, and scope (single-step or environment-wide).

#### Escalation

After three cumulative failures on the same step, the system escalates. Escalation triggers the creation of a Clarification Contract (see section 2.5) requesting upstream review. After six or more attempts with duplicate failures, the contract is automatically escalated to blocker severity.

---

### 2.5 Clarification Contracts System

The Clarification Contracts system enables downstream pipeline modules to formally request clarification from upstream modules. It operates upward-only: prompts → requirements → ideas.

#### Contract Structure

Each contract captures:

- **Origin module** — which module detected the issue (`requirements`, `prompts`, or `execution`)
- **Current and upstream artifact IDs and versions** — precisely linking the issue to its source
- **Category** — one of: `missing_information`, `contradiction`, `architecture_gap`, `regulatory_gap`, `data_model_gap`, `scope_conflict`, `execution_failure`
- **Severity** — `advisory` (informational, does not block) or `blocker` (prevents generation)
- **Required clarifications** — structured questions with expected answer types (short text, long text, select, multi-select, number, boolean)
- **Affected entities** — specific requirement IDs, prompt step IDs, idea risk IDs, or assumption IDs
- **Contract hash** — SHA256-based deterministic hash for de-duplication; identical contracts increment `occurrenceCount` rather than creating duplicates
- **Integrity context** — optional, attached when the contract relates to execution integrity (step number, integrity level, idempotency, re-execution count, duplicate failure flag)

#### Detection

Detection hooks run non-blocking after requirements and prompts generation. The **Clarification Detection Service** analyses the generated artifact for gaps, contradictions, and architecture issues and produces contracts for any findings.

#### Escalation Rules

- After 3 identical unresolved advisory contracts: automatic escalation to blocker (loop prevention)
- Execution failure + duplicate failure detected: immediate blocker if integrity level is `critical`
- Re-execution count ≥ 2: advisory escalates to blocker
- Contracts with `integrityLevel: critical` display a special warning in the UI: *"This step involves irreversible changes. Refinement required before proceeding."*

#### Resolution

Users can resolve or dismiss contracts through the **ClarificationPanel** component. Resolution data is persisted. Resolved contracts allow the blocked module to proceed. Dismissed contracts are recorded for audit purposes.

---

### 2.6 Admin Console

The Admin Console is accessible to users with database-granted admin rights (`users.isAdmin = 'true'`). It provides operational visibility and control across the platform.

#### Provider Management

Admins can view all configured AI providers, their status (enabled/disabled), and toggle availability. Provider health is surfaced to help identify when a provider is returning errors or degraded results.

#### Usage Dashboard

Real-time usage metrics are available per user and per billing plan:

- Generations this month
- Tokens consumed this month
- Usage breakdown by plan tier (Free, Pro, Team)
- User count per plan

#### User Management

Admins can view all registered users, their authentication provider (Replit or local email/password), plan assignment, and admin status. Admin privileges are granted and revoked from this interface.

#### Audit Log

Every admin action is persisted to the audit log in PostgreSQL with timestamp, actor ID, action type, and affected resource. The log provides a complete trace of administrative changes.

#### Prompt Feedback Review

Admins can review all prompt step feedback events — including failure classifications, recovery steps offered, and user-submitted outcomes — aggregated for platform improvement analysis.

---

### 2.7 Billing and Plans

The platform operates a three-tier billing model:

| Plan | Monthly Generations | Monthly Token Budget |
|---|---|---|
| Free | 10 | 50,000 |
| Pro | 100 | 500,000 |
| Team | 500 | 2,000,000 |

Usage is tracked per user and automatically resets at the start of each calendar month. Users receive progressive warnings at 80% of either limit, and a hard notice at 100%. Limit enforcement is soft — users are informed rather than hard-blocked, allowing for plan upgrade conversations.

---

### 2.8 Artifact System

Every module output is stored as a versioned, immutable Markdown artifact with YAML frontmatter. Artifacts are:

- Stored in the `artifacts/` directory, organised by module
- Named with a deterministic schema: `{type}-{title}-{variant}_v{n}.md`
- Versioned sequentially; new versions never overwrite old ones
- Referenceable by ID and version from any other system component
- Downloadable and readable without any platform tooling (plain Markdown)

The frontend provides an **Artifact Preview** component and a **Version History Panel** showing all past versions of a given artifact with creation timestamps.

---

## 3. User Flows

### 3.1 New User Onboarding

1. User arrives at the landing page and clicks **Start a Build**.
2. User authenticates via Replit OAuth or email/password registration.
3. On first login, an **Onboarding Modal** guides the user through creating their first project.
4. User enters a project name. The project is created and set as active.
5. User is taken to the Dashboard, which shows the pipeline stages and prompts the first action: describe an idea.

### 3.2 Idea Validation Flow

1. User navigates to the **Ideas** section.
2. User fills in the idea form: title, description, purpose, and optional context fields.
3. User submits. The platform triggers domain research (30-minute cache), then dispatches the idea to multiple AI providers in parallel.
4. Analysis results appear: overall score, recommendation, strengths, weaknesses, risks, feasibility, and structured profiles (Technical, Commercial, Execution).
5. User reviews the analysis. If the recommendation is `proceed` or `revise`, they can continue.
6. Optionally, user enters the **Guided Refinement Workshop**: the platform generates open-ended questions based on the specific analysis findings.
7. User answers the workshop questions in a conversational interface.
8. User submits workshop responses. The platform re-runs the analysis incorporating workshop evidence and research context.
9. A **Workshop Comparison** panel shows what changed: risk severities, assumption status transitions, and improvement scores.
10. The idea moves to `VALIDATED_IDEA` stage. The pipeline advances.

### 3.3 Requirements Generation Flow

1. From the Dashboard or the Ideas page, user selects **Generate Requirements** for a validated idea.
2. The platform validates pipeline stage (`VALIDATED_IDEA` required).
3. AI generates a structured requirements document.
4. The Requirements page renders: System Overview card, Functional Requirements list, NFRs, Data Model, Architecture Decisions accordion, and Risk Traceability table with colour-coded coverage badges.
5. User reviews and optionally regenerates. Requirements lock into `LOCKED_REQUIREMENTS` stage.
6. The artifact is written to `requirements-reference-{title}_v{n}.md`.

### 3.4 Prompt Generation and IDE Selection Flow

1. From the Dashboard or Requirements page, user selects **Generate Build Prompts**.
2. User selects their target IDE from the six available options.
3. The platform validates pipeline stage (`LOCKED_REQUIREMENTS` required) and checks that requirements are not outdated.
4. AI generates sequential build prompts dynamically derived from the requirements document.
5. The Prompts page renders all steps in order, each showing: title, prompt body, requirements covered, integrity level badge, and a copy action.
6. Steps are ready to paste into the selected IDE.
7. The artifact is written to `build-prompts-{title}-{ide}_v{n}.md`.

### 3.5 Execution Flow

1. From the Prompts page, user clicks **Start Execution Session**.
2. A session is created in the database, pinning the current prompt artifact version.
3. The user works through steps sequentially in their IDE. For each step:
   - **Start**: Mark the step as in-progress.
   - **Complete**: Mark as done. The system records a SHA256 success hash.
   - **Fail**: Submit the failure output. The Classifier Service identifies the failure pattern and presents recovery steps.
4. If a step fails repeatedly, a Clarification Contract is created and displayed in the ClarificationPanel inline with the prompts.
5. Advisory contracts inform without blocking. Blocker contracts must be resolved before the pipeline can advance.
6. Resolved contracts allow the user to continue. Dismissed contracts are logged.
7. The session progress bar advances. On the final step completion, the session is marked `completed`.
8. On page refresh, session state is restored exactly where the user left off.

### 3.6 Admin Flow

1. Admin user logs in and sees the **Admin** link in the sidebar navigation.
2. Admin navigates to the Admin Console.
3. Available sections:
   - **Providers**: toggle AI providers on/off, view status
   - **Usage**: view per-plan usage statistics and user counts
   - **Users**: browse user accounts, assign plans, grant/revoke admin
   - **Audit Log**: review all admin actions with timestamps
   - **Prompt Feedback**: review feedback events and failure classifications

---

## 4. Use Cases

### 4.1 Solo Founder Validating a SaaS Idea

**Persona**: Jordan, a product manager with no technical background, has an idea for a B2B SaaS tool for construction project tracking.

**Challenge**: Jordan has spent three months building a slide deck and talking to friends, but has no structured assessment of whether the idea is viable or what it would actually take to build.

**How Plan2Prompt helps**:

1. Jordan submits the idea, selects `commercial` as the purpose, and notes a 6-month timeline and a medium budget.
2. The platform's research service surfaces the competitive landscape — several established players and a regulatory angle around site safety data.
3. Three AI models independently assess the idea. The consensus flags strong differentiation potential but a high compliance exposure and an underestimated MVP effort of 18–22 weeks.
4. The recommendation is `revise` — the compliance angle needs addressing before proceeding.
5. Jordan enters the workshop and answers structured questions about their approach to compliance and their go-to-market assumptions.
6. The refined analysis shows reduced risk severity on the compliance assumption after Jordan's responses demonstrate a clear regulatory pathway.
7. Jordan now has a documented, AI-validated assessment to share with developers or investors — not a slide deck, but a structured artifact.

---

### 4.2 Developer Scaffolding a New Side Project

**Persona**: Sam, a full-stack developer, wants to build a personal finance tracking app as a side project using Replit.

**Challenge**: Sam always starts coding immediately and ends up refactoring constantly because the initial scope wasn't clear.

**How Plan2Prompt helps**:

1. Sam submits the idea and selects `developer_tool` purpose and Replit as the target IDE.
2. The analysis scores the idea highly — low regulatory exposure, clear scope, defined user.
3. Sam skips the workshop (recommendation is `proceed`) and moves straight to requirements generation.
4. Requirements are generated: a System Overview, 14 Functional Requirements, 6 NFRs, a data model, 4 API contracts, and 3 Architecture Decisions.
5. Sam generates build prompts for Replit. 10 sequential steps are produced, each tagged with the requirements they fulfil.
6. Sam works through the steps in Replit. Step 3 (database schema setup) is flagged `critical` — the platform warns before re-running.
7. Sam completes the execution session in 4 days with a working MVP, having never written a requirements document by hand.

---

### 4.3 Agency Team Building Client Software

**Persona**: A 3-person agency is scoping a client project for a regional logistics company needing an internal route-planning tool.

**Challenge**: The agency needs to produce a spec document for the client to sign off before development begins, but writing specs is time-consuming and often misses edge cases.

**How Plan2Prompt helps**:

1. The agency submits the idea under the `internal` purpose, with context about the client's team size and existing systems.
2. The analysis highlights data integration complexity (existing ERP system) and identifies a scope conflict risk around real-time tracking.
3. The requirements module produces a comprehensive document with risk traceability — each requirement linked back to the identified risks.
4. The agency exports the requirements artifact (a clean Markdown file) and shares it with the client for review.
5. After client feedback, the agency re-runs requirements generation, producing version 2 of the artifact with changes tracked.
6. Build prompts are generated for Cursor. The step sequence respects the integration complexity identified in requirements.

---

### 4.4 Enterprise Team Standardising Internal Tooling Development

**Persona**: A platform team at a mid-sized enterprise wants to standardise how internal tool ideas are scoped before development resources are committed.

**Challenge**: Internal tool requests arrive ad hoc, without any consistent format. Some are built and abandoned. Others consume months of engineering time without clear requirements.

**How Plan2Prompt helps**:

1. The enterprise deploys Plan2Prompt and creates a shared project for each internal tool request.
2. Requestors submit ideas directly in the platform. The AI analysis provides an immediate, consistent assessment — the same methodology for every idea.
3. Ideas that receive a `stop` recommendation are archived with rationale, creating an institutional record.
4. Approved ideas move through the pipeline. Requirements are generated and reviewed by the platform team before prompts are created.
5. The Admin Console gives the platform team visibility into all usage, all artifacts, and all active sessions.
6. Clarification contracts create a formal, auditable feedback loop when downstream implementation reveals gaps in the original requirements.

---

## 5. Technical Architecture

### 5.1 Overall Architecture

Plan2Prompt is a full-stack web application built on a monorepo structure with three distinct layers:

```
plan2prompt/
├── client/          — React 19 frontend (TypeScript, Vite)
├── server/          — Node.js backend (Express, TypeScript)
└── shared/          — Shared type contracts and schema (TypeScript)
```

The frontend and backend are served on the same port. The backend uses Express to serve both the API and the Vite-compiled frontend in production.

**Frontend**: React 19 with TypeScript. TanStack Query for server state management. Wouter for client-side routing. React Hook Form with Zod for form handling. Tailwind CSS with shadcn/ui components (New York style, Radix UI primitives). Full dark mode support via ThemeProvider with localStorage persistence.

**Backend**: Node.js with Express. RESTful API using `ApiResponse<T>` response wrappers. Drizzle ORM with PostgreSQL. TypeScript throughout.

**Shared Contracts**: TypeScript interfaces in `shared/types/` with `@shared/*` path aliases. All types used by both frontend and backend are defined here, preventing drift.

---

### 5.2 AI Integration Layer

#### IAIProvider Interface

All AI providers implement a single `IAIProvider` interface. This ensures that OpenAI, Anthropic, and Gemini are interchangeable from the perspective of the platform's services.

#### ConsensusService

The `ConsensusService` is the orchestration layer. It:

- Dispatches the same request to all enabled providers in parallel
- Collects and validates each response
- Handles retries on provider failure with exponential backoff
- Tracks per-provider token usage via `UsageService`
- Computes consensus confidence and provider agreement scores from the spread of individual responses
- Returns a merged, normalised result

#### Provider Validation

A `ProviderValidationService` checks provider health before requests are dispatched. Unhealthy providers are excluded from the consensus round. Admins can manually disable providers through the Admin Console.

---

### 5.3 Data Model Overview

The primary data entities persisted to PostgreSQL are:

| Entity | Description |
|---|---|
| `users` | Accounts with auth provider, plan, admin flag, password hash (for local auth) |
| `projects` | Named workspaces with owner, active state |
| `sessions` | Express session store for authentication |
| `clarification_contracts` | Upward clarification requests with hash, category, severity, resolution status, and optional integrity context |
| `audit_logs` | Admin action log with actor, action, timestamp |
| `prompt_feedback` | Feedback events from execution steps |
| `execution_sessions` | Execution session state per project |
| `execution_steps` | Per-step execution state with attempt counts, failure hashes, success hashes |

Ideas, requirements, and prompts are stored as versioned Markdown artifacts on disk, with metadata in YAML frontmatter. This design means artifacts are readable without any platform tooling and can be committed to version control.

---

### 5.4 Pipeline Sequencing and Enforcement

The pipeline has four stages:

```
DRAFT_IDEA → VALIDATED_IDEA → LOCKED_REQUIREMENTS → PROMPTS_GENERATED
```

Enforcement is applied at two levels:

1. **Frontend gate**: Dashboard module buttons are disabled until the prerequisite stage is complete. A `hasValidatedIdea` gate prevents the Requirements and Prompts modules from being accessed if no validated ideas exist in the project.

2. **Backend validation**: Every generation endpoint validates the pipeline stage before processing. `validateRequirementsGenerationStage()` enforces that the source idea is `VALIDATED_IDEA`. `validatePromptGenerationStage()` enforces that requirements are `LOCKED_REQUIREMENTS`. `validateNotOutdated()` blocks prompt generation if the source requirements artifact has been updated since the prompt artifact was generated.

Stage transitions are strictly linear. There is no mechanism to skip a stage or go backward within a project.

---

### 5.5 Artifact Versioning

Artifacts are immutable once written. When regeneration is triggered, a new version is created:

- Version numbers increment sequentially
- All previous versions are retained
- The current active version is tracked in project metadata
- Execution sessions pin to the artifact version at session start; upstream changes trigger invalidation warnings

---

### 5.6 Authentication and Access Control

The platform supports two authentication modes:

**Replit Auth**: OpenID Connect via Replit's identity provider. Used for users signing in with their Replit account.

**Local Auth**: Email and password with bcryptjs hashing. Used for direct sign-ups (e.g., `mat@mte-software.com`).

Users have a single `authProvider` field (`"replit"` or `"local"`) and an optional `passwordHash`. Sessions are backed by PostgreSQL using `connect-pg-simple`.

**Admin Access**: Admin rights are database-driven. The `isAdmin` column on the `users` table is checked at the middleware level. There are no hardcoded admin user IDs or fallback defaults. Admin middleware derives the user identity from the session — no defaults.

**Project Isolation**: An `X-Project-Id` header is enforced on all project-scoped API calls. Middleware validates that the requesting user has access to the project before any data is returned. Project isolation prevents cross-project data leakage.

**Role-Based Access**: The `PermissionGate` component on the frontend and corresponding middleware on the backend enforce action-level permissions. Owners can rename and delete projects. Admins have cross-project visibility via the Admin Console.

---

### 5.7 Execution Integrity and Idempotency Controls

Execution integrity is applied to every build step at prompt generation time using deterministic keyword scanning. The classification is not AI-generated — it is rule-based and reproducible.

**Integrity levels**:
- `safe` + idempotent: no restrictions on re-run
- `caution` + non-idempotent: re-run blocked after completion; override requires confirmation
- `critical` + non-idempotent: re-run blocked after completion; override requires explicit confirmation with strong warning; duplicate failure triggers immediate blocker clarification

**Success hash memory**: On step completion, a SHA256 hash of the completion fingerprint is stored. This hash is used to detect when a re-run attempt is producing the same failure as a previous attempt.

**Duplicate failure detection**: When `lastFailureHash` matches a new failure hash, the system auto-creates an `execution_failure` advisory clarification contract. After 6+ attempts, the contract escalates to blocker severity.

---

### 5.8 Invariant Testing Approach

The platform includes 224 invariant tests written in Vitest covering core platform behaviours. These are not integration tests or end-to-end tests — they are unit-level contracts that verify the system's invariants hold under all inputs.

Test coverage areas:

| Area | Test Count | What Is Verified |
|---|---|---|
| Pipeline sequencing | Included | Stage transitions, gate enforcement, violation responses |
| STOP recommendations | Included | Deterministic recommendation rules fire correctly |
| Permission boundaries | Included | Admin vs. user access, project isolation |
| Failure classification | Included | Taxonomy patterns match expected inputs |
| Usage tracking | Included | Token counts, generation counts, monthly resets |
| Clarification contracts | Included | Hash de-duplication, escalation rules, loop prevention |
| Prompt→requirement traceability | 8 tests | Every step links to a real requirement ID |
| Risk resolution deltas | 28 tests | Assumption transitions, severity changes, score caps |
| Requirements traceability | 27 tests | Type validation, JSON normalisation, backward compatibility |
| Execution integrity | 43 tests | Idempotency assignment, re-run controls, duplicate detection |
| Execution sequencing | 38 tests | Step enforcement, invalidation, resume, escalation |
| Prompts generation | 24 tests | Dynamic generation, dependency ordering, coverage |

---

## 6. Integration Points

### 6.1 AI Providers

Three AI provider integrations are built and active:

| Provider | Models Used | Integration Type |
|---|---|---|
| OpenAI | GPT-4 series | REST API via `OPENAI_API_KEY` |
| Anthropic | Claude series (including Opus) | REST API via `ANTHROPIC_API_KEY` |
| Google Gemini | Gemini Pro series | REST API via `GEMINI_API_KEY` |

All three are abstracted behind the `IAIProvider` interface. New providers can be added by implementing the interface and registering with the ConsensusService.

### 6.2 Replit Platform

- **Replit Auth**: OpenID Connect integration for user authentication
- **Replit Database**: PostgreSQL provided by Replit's managed database service
- **Replit Vite Plugins**: Runtime error modal, cartographer, and dev banner for development tooling

### 6.3 Database

PostgreSQL via Drizzle ORM. Connection via `DATABASE_URL` environment variable. Schema managed with Drizzle Kit. Session persistence via `connect-pg-simple`.

---

## 7. Quality and Reliability

### 7.1 Testing Strategy

The platform's primary quality mechanism is its **invariant test suite** — 224 tests that encode the platform's core behavioural contracts. These run with Vitest and cover every major service: ideas analysis, requirements generation, prompt generation, execution state, clarification contracts, and all safety controls.

The invariant approach means that behaviour is specified as a contract, not as an implementation detail. If a future change breaks an invariant, the test fails immediately and explicitly.

### 7.2 Failure Handling

Failures are handled at every level:

- **Provider failures**: The ConsensusService retries failed provider calls. If a provider is consistently unhealthy, it is excluded from consensus rounds.
- **Execution failures**: The Classifier Service maps failure output to known patterns with actionable recovery steps.
- **Escalation**: Repeated failures trigger Clarification Contracts that formally route the problem back to where it originated.
- **Artifact integrity**: Execution sessions detect outdated source artifacts and block unsafe continuation.

### 7.3 Determinism

Several core platform behaviours are explicitly deterministic:

- Integrity level assignment (keyword scanning, not AI)
- Risk resolution delta computation (mathematical, not AI)
- Recommendation rules (rule-based, applied before AI scoring)
- Contract hash de-duplication (SHA256 of content)
- Failure pattern matching (pattern library, not AI)

This means these behaviours are testable, auditable, and reproducible without calling any external API.

### 7.4 Data Safety

- Non-idempotent steps cannot be re-run silently — explicit confirmation is required
- Critical steps display escalated warnings before override
- Artifact versioning ensures no analysis is ever lost
- Audit logs record all admin actions permanently
- Session state is persisted to PostgreSQL — browser refresh does not lose progress

---

*This document reflects Plan2Prompt version 1.0.5. All features described are implemented and operational.*

*© 2025 MTE Software Ltd. All rights reserved.*
