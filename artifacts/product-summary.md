# Product Summary and Target Market Profile

---

## Section 1 -- Product Overview

- **Product Name:** IdeaForge
- **Built and operated by:** MTE Software Ltd
- **Product Category:** AI-assisted product validation and development planning platform (SaaS)

IdeaForge is a web-based platform that helps individuals and teams validate application ideas through structured, AI-driven analysis before committing resources to development. It uses multiple AI providers (OpenAI, Anthropic, Google Gemini) operating through a consensus mechanism to assess idea viability across technical, market, financial, and timeline dimensions. The platform enforces a sequential pipeline -- Idea Validation, Requirements Generation, Build Prompt Generation -- producing versioned Markdown artifacts at each stage. Its primary purpose is to reduce the risk of building products that lack viability by providing structured, evidence-based analysis and actionable development plans.

---

## Section 2 -- Core Functionality

### 2.1 Idea Analysis (Core)

- **What it does:** Accepts an idea submission (title, description, purpose type, and optional context such as target market, budget, timeline, skills, and competitors). Runs domain research automatically, then submits the idea to multiple AI providers simultaneously. Aggregates responses through a consensus mechanism to produce a structured analysis covering strengths, weaknesses, feasibility scores (technical, market, financial, timeline), risk drivers, scope warnings, assumption dependencies, and a failure mode narrative.
- **Who uses it:** Product owners, founders, solo developers, and team leads evaluating whether to invest time in building a product.
- **Outcome:** A scored analysis (0-100) with a clear recommendation: Proceed, Revise, or Stop. The analysis is specific to the submitted idea, not generic advice.
- **Classification:** Core

### 2.2 Purpose-Aware Analysis (Core)

- **What it does:** Tailors the AI analysis based on one of five project types: Commercial Product, Developer Tool, Internal/Personal Tool, Open Source Project, or Learning/Experiment. Each type activates a distinct evaluation framework. For example, internal tools skip market validation and focus on build-vs-buy analysis; learning projects evaluate scope against learning goals rather than revenue.
- **Who uses it:** Anyone submitting an idea -- the purpose selection is part of the submission form.
- **Outcome:** Analysis that is relevant to the actual intent of the project, avoiding misapplied commercial metrics for non-commercial work.
- **Classification:** Core

### 2.3 Domain Research (Core)

- **What it does:** Before AI analysis begins, the platform generates a research brief covering the idea's domain: competitors, regulations, industry specifics, technical standards, and market signals. The brief is purpose-aware and cached for 30 minutes.
- **Who uses it:** Automated -- runs as part of every idea analysis.
- **Outcome:** Analysis grounded in real-world context rather than abstract reasoning.
- **Classification:** Core

### 2.4 Guided Refinement Workshop (Core)

- **What it does:** After initial analysis, users can enter a structured interview process where the AI asks targeted, open-ended questions based on the specific analysis findings and research brief. Questions are purpose-adaptive and reference the actual idea details. Upon completion, the platform triggers a re-analysis that incorporates the user's answers as new evidence, adjusting scores, risk levels, and recommendations accordingly.
- **Who uses it:** Builders who receive a "Revise" recommendation or want to strengthen their analysis before proceeding.
- **Outcome:** A refined, second-pass analysis that reflects additional context and evidence provided by the builder.
- **Classification:** Core

### 2.5 Requirements Generation (Core)

- **What it does:** Converts a validated idea artifact into a comprehensive requirements document covering functional requirements (prioritised as must-have, should-have, nice-to-have), non-functional requirements (performance, security, scalability, reliability, usability, maintainability, compatibility), architecture components, data models, and API contracts.
- **Who uses it:** Product owners, technical leads, and developers transitioning from validation to planning.
- **Outcome:** A structured requirements document saved as a versioned artifact, ready for development planning.
- **Classification:** Core

### 2.6 Build Prompt Generation (Core)

- **What it does:** Translates accepted requirements into sequential, IDE-specific build prompts. Supports six IDE targets: Replit, Cursor, Lovable, Antigravity, Warp, and Generic. Each prompt includes an objective, expected outcome, wait instruction, verification checkpoint, failure recovery branches, scope guardrails, and IDE-specific constraints.
- **Who uses it:** Developers using AI-assisted development environments to build the validated product.
- **Outcome:** A step-by-step build plan tailored to the target IDE, with built-in verification and failure recovery at each step.
- **Classification:** Core

### 2.7 Prompt Feedback Loop (Core)

- **What it does:** When a build prompt produces an unexpected result in the target IDE, users can submit the raw IDE output for deterministic failure classification. The system matches the failure against known patterns and returns structured recovery instructions without consuming additional AI tokens.
- **Who uses it:** Developers encountering issues during the build process.
- **Outcome:** Categorised failure diagnosis and actionable recovery steps.
- **Classification:** Core

### 2.8 Pipeline Enforcement (Core)

- **What it does:** Enforces strict stage sequencing: Idea Validation must complete before Requirements Generation, which must complete before Build Prompt Generation. STOP recommendations create hard blocks that require explicit user acknowledgement before proceeding. All overrides are logged to the audit trail.
- **Who uses it:** System-level enforcement -- applies to all users.
- **Outcome:** Prevention of premature development investment and auditability of risk acceptance decisions.
- **Classification:** Core

### 2.9 Multi-Project Support with Artifact Isolation (Core)

- **What it does:** Users can create and manage multiple projects. All artifacts, analysis results, and pipeline state are scoped to individual projects via enforced project context headers. Users cannot access artifacts from other projects.
- **Who uses it:** Anyone with multiple product ideas or working across different initiatives.
- **Outcome:** Clean separation of work, preventing cross-contamination of analysis and artifacts.
- **Classification:** Core

### 2.10 Team Collaboration (Supporting)

- **What it does:** Project owners can add team members with role-based access: Owner (full control including deletion and member management), Collaborator (can view, edit, generate, and export), and Viewer (read-only access).
- **Who uses it:** Teams working together on product validation.
- **Outcome:** Controlled access to project artifacts based on organisational role.
- **Classification:** Supporting

### 2.11 Artifact Versioning and Storage (Supporting)

- **What it does:** All outputs (idea analyses, requirements documents, build prompts) are stored as versioned Markdown files with YAML frontmatter. Each artifact is immutable once created; updates produce new versions with parent references. The system tracks downstream dependencies and identifies outdated artifacts when upstream sources are revised.
- **Who uses it:** All users -- operates automatically.
- **Outcome:** Full audit trail of all generated content with version history and dependency tracking.
- **Classification:** Supporting

### 2.12 AI Consensus Mechanism (Supporting)

- **What it does:** Queries multiple AI providers simultaneously, measures agreement between responses, and produces a unified result with a confidence score and provider agreement percentage. Handles provider failures gracefully with automatic fallback.
- **Who uses it:** System-level -- powers all analysis and generation features.
- **Outcome:** Higher-confidence analysis than single-provider approaches, with transparency about inter-provider agreement.
- **Classification:** Supporting

### 2.13 Usage Tracking and Billing (Supporting)

- **What it does:** Records token consumption and estimated cost per AI request, broken down by module, provider, and project. Enforces soft limits based on billing plan (Free, Pro, Team). Provides per-user usage summaries.
- **Who uses it:** Platform administrators and individual users monitoring their consumption.
- **Outcome:** Visibility into AI costs and consumption-based plan enforcement.
- **Classification:** Supporting

### 2.14 Administration Console (Administrative)

- **What it does:** Provides platform administrators with controls to manage AI provider health and configuration, view and manage users (including disabling generation per user), monitor billing and usage across plans, inspect artifact pipeline integrity, and review a persistent audit log of all administrative actions.
- **Who uses it:** Platform administrators only.
- **Outcome:** Operational oversight and control of the platform.
- **Classification:** Administrative

### 2.15 Dual Authentication (Administrative)

- **What it does:** Supports two authentication methods: Replit OAuth (OpenID Connect) for users accessing the platform through Replit, and email/password local authentication with session management for standalone access. User records track authentication provider.
- **Who uses it:** All users during login and registration.
- **Outcome:** Flexible access for both Replit-native and standalone users.
- **Classification:** Administrative

---

## Section 3 -- Problem Statement

### Primary Problems Solved

1. **Premature development investment.** Builders frequently commit weeks or months to products before validating whether the idea is technically feasible, commercially viable, or differentiated from existing alternatives. IdeaForge forces structured evaluation before development begins.

2. **Shallow or biased self-assessment.** Individual builders and small teams lack the diversity of perspective needed to identify blind spots in their own ideas. The multi-provider AI consensus mechanism provides analysis from multiple reasoning approaches, reducing single-source bias.

3. **Unstructured transition from idea to development.** Even when ideas are validated, the path from concept to actionable development plan is typically ad hoc. IdeaForge produces structured requirements and IDE-specific build plans, reducing ambiguity in the planning phase.

4. **Misapplied evaluation frameworks.** A learning project should not be evaluated with the same commercial metrics as a SaaS product. Purpose-aware analysis applies the right evaluation criteria to the right type of project.

### Inefficiencies Reduced

- Time spent on ideas that would fail basic viability checks
- Inconsistency in how ideas are evaluated across a team or portfolio
- Manual effort in translating validated ideas into structured requirements and development plans
- Repeated context loss when moving between validation, planning, and development phases

### Market Gap Addressed

Existing tools in this space tend to be either simple idea scoring tools with superficial analysis, or heavyweight product management platforms that assume the product already exists. IdeaForge occupies the space between initial concept and first line of code -- the validation and planning phase that is currently handled informally by most builders.

---

## Section 4 -- Target Market

### Primary Target Users

- **Solo founders and independent developers** evaluating product ideas before committing build time. Typically working on side projects, micro-SaaS products, or early-stage startups.
- **Small development teams (2-10 people)** at seed stage or pre-seed, where validation discipline is not yet formalised but the cost of building the wrong thing is high.
- **Technical product managers** responsible for evaluating and prioritising a pipeline of product ideas within a technology organisation.

### Secondary Users

- **Non-technical founders** who need structured analysis to support conversations with technical co-founders, contractors, or investors.
- **Innovation teams within larger organisations** evaluating internal tool proposals or experimental projects.
- **Educators and students** using the platform for product thinking exercises and structured project planning.

### Geographic Scope

The platform is delivered as a web application with no geographic restrictions. Content is in English. AI providers are cloud-based with global availability.

### Operational Context

The platform operates in the product development lifecycle, specifically the pre-development validation phase. It does not require integration with existing enterprise systems. It is standalone and self-contained.

---

## Section 5 -- Ideal Customer Profile (ICP)

- **Organisation type:** Solo developer, micro-team, or early-stage startup. Also applies to innovation units within mid-size technology companies.
- **Size or maturity level:** Pre-product or early product stage. Has ideas but has not yet committed to building, or is evaluating multiple potential directions.
- **Pain points:** Has experienced building products that failed to find users. Lacks a structured process for evaluating ideas. Spends time on development before validating assumptions. Finds it difficult to translate a validated idea into an actionable build plan.
- **Decision maker profile:** The builder themselves (solo) or a technical co-founder / CTO (small team). Decisions are made quickly with minimal procurement process.
- **Budget sensitivity:** Medium. Willing to pay for tools that save development time, but cost-conscious. Expects clear value relative to subscription cost.
- **Technical capability expectations:** Comfortable with web applications. Does not require API integration or custom deployment. Expects the platform to work immediately upon sign-up.

---

## Section 6 -- Value Proposition

### Why This Product Exists

Most software products fail not because of poor engineering, but because the idea was insufficiently validated before development began. IdeaForge exists to make structured idea validation fast, accessible, and actionable -- replacing informal gut-feel decisions with evidence-based analysis.

### Measurable Benefits

- **Time savings:** Structured analysis that would take days of manual research and deliberation is produced in minutes, across multiple AI reasoning perspectives.
- **Risk reduction:** Ideas receive scored feasibility assessments, ranked risk drivers, assumption tracking, and explicit Proceed/Revise/Stop recommendations before any code is written.
- **Decision clarity:** The platform produces a clear recommendation with supporting rationale, removing ambiguity from the go/no-go decision.
- **Planning efficiency:** Validated ideas are automatically converted into structured requirements documents and IDE-specific build prompts, eliminating the manual translation step between concept and development.
- **Consistency:** Every idea is evaluated using the same structured framework, enabling meaningful comparison across a portfolio of potential projects.

### How It Improves Decision-Making

The platform surfaces information that builders typically discover too late: unvalidated assumptions, hidden scope complexity, uncontrollable risk factors, and competitive positioning gaps. By presenting this information before development begins, it shifts the cost of failure from wasted development time to a few minutes of structured analysis.

---

## Section 7 -- Competitive Positioning

### Structural Differences

- **Multi-provider AI consensus:** Unlike tools that rely on a single AI model, IdeaForge aggregates analysis from multiple providers and measures inter-provider agreement, providing a confidence metric alongside the analysis itself.
- **Enforced pipeline sequencing:** The platform does not allow users to skip validation stages. This is a deliberate design decision that prevents the common pattern of rushing from concept to code without intermediate validation.
- **Purpose-aware evaluation:** The platform applies different evaluation frameworks for different project types, avoiding the common mistake of applying commercial metrics to non-commercial projects.
- **End-to-end artifact chain:** The platform maintains a versioned chain of artifacts from initial idea through requirements to build prompts, with dependency tracking and outdated-artifact detection. This provides traceability from concept to code.

### Operational Depth

The platform has particular depth in the idea validation phase, with features such as domain research, guided refinement workshops, failure mode narratives, ranked risk drivers, assumption dependency tracking, and scope complexity warnings. This goes substantially beyond simple idea scoring.

### Competitive Axis

IdeaForge competes primarily on **intelligence and structured process** rather than on price, integration breadth, or feature quantity. Its value is in the quality and structure of its analysis output and the discipline it imposes on the validation-to-development workflow.

---

## Section 8 -- Delivery and Ownership

- IdeaForge is built, maintained, and operated by **MTE Software Ltd**.
- MTE Software Ltd controls the full technology architecture, product roadmap, and operational infrastructure.
- The platform is developed using modern, scalable web technologies: React 19, TypeScript, Node.js, PostgreSQL, and integrates with enterprise-grade AI services (OpenAI, Anthropic, Google Gemini).
- MTE Software Ltd provides ongoing technical stewardship, including AI provider management, model updates, security maintenance, and feature iteration.
- All artifacts and user data are managed within the platform's infrastructure under MTE Software Ltd's operational control.

---

## Section 9 -- Commercial Model

The platform implements a tiered subscription model with three plans:

| Plan | Monthly Generations | Monthly Token Budget | Target User |
|------|---------------------|----------------------|-------------|
| Free | 10 | 50,000 | Individual exploration and evaluation |
| Pro | 100 | 500,000 | Active builders with regular validation needs |
| Team | 500 | 2,000,000 | Teams with collaborative validation workflows |

Usage is tracked per generation and per token consumed across AI providers. Soft limits are enforced at the plan level with usage visibility for both individual users and administrators.

The commercial model is configurable. Enterprise deployment options, custom token budgets, and volume-based pricing can be adapted to specific customer requirements.
