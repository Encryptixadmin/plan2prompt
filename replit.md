# Production-Ready Web Platform

## Overview

A scalable and modular web platform designed for building production-grade web applications. Its primary purpose is to streamline the validation, refinement, and development of application ideas through an AI-powered pipeline. The platform aims to generate detailed requirements and sequential build prompts, ensuring a clean separation between frontend, backend, and shared contracts for extensibility and maintainability. It integrates advanced AI services (OpenAI, Anthropic, Gemini) and produces structured Markdown outputs as first-class artifacts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 19 with TypeScript and Vite.
- **Styling**: Tailwind CSS with shadcn/ui (New York style) built on Radix UI primitives. Inter (primary) + JetBrains Mono (code) fonts.
- **Design System**: Indigo primary palette (238 76% 60%), sophisticated neutral scale, refined shadows, full dark mode support via ThemeProvider with localStorage persistence.
- **Layout**: AppShell component wraps all authenticated pages with Shadcn Sidebar navigation (Dashboard/Ideas/Requirements/Prompts/Admin) and a top bar (project switcher, theme toggle, user menu). Pages render content within the AppShell without individual headers.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **Admin Console**: `/admin` route for managing providers, usage, users, projects, and auditing actions.

### Technical Implementations
- **Backend Runtime**: Node.js with Express.
- **API Design**: RESTful endpoints using `ApiResponse<T>` wrappers.
- **Data Layer**: Drizzle ORM with PostgreSQL dialect, Zod schemas, and `MemStorage` for development.
- **AI Service Integration**: Unified `IAIProvider` interface supporting OpenAI, Anthropic, and Gemini. `ConsensusService` for orchestrating multiple providers, handling retries, and tracking usage.
- **Artifact System**: Markdown files with YAML frontmatter, stored in `artifacts/`, organized by module, with immutable versioning.
- **Shared Contracts**: TypeScript interfaces in `shared/types/` with `@shared/*` aliases.
- **Security & Isolation**: `X-Project-Id` enforcement, role-based access control, and pipeline sequencing enforcement. User authentication via Replit Auth (OpenID Connect) with PostgreSQL-backed sessions.
- **Project Context**: Middleware and hooks ensure project isolation and guide users through project creation.
- **Auditing & Feedback**: Persistence of admin audit logs and prompt feedback events to PostgreSQL.
- **Invariant Testing**: Vitest-based test harness for core platform behaviors, including pipeline sequencing, STOP recommendations, permission boundaries, failure classification, usage tracking, clarification contracts, and prompt→requirement traceability (115 total tests).
- **Cross-Module Clarification Contracts**: Upward-only clarification system enabling downstream modules (prompts→requirements→ideas) to request upstream clarification. SHA256-based deterministic contract hashing for de-duplication. Categories: missing_information, contradiction, architecture_gap, regulatory_gap, data_model_gap, scope_conflict, execution_failure. Severity levels: advisory (informational) and blocker (prevents generation). Automatic blocker escalation after 3 identical unresolved contracts (loop prevention). Detection hooks run non-blocking after requirements and prompts generation. Execution escalation triggers blocker clarification after ≥3 identical feedback failures. Frontend ClarificationPanel component renders inline with resolve/dismiss actions. API: `/api/clarifications` (list, pending, blockers, resolve, dismiss).

### Feature Specifications
- **Ideas Module**: Validates and refines application ideas using AI consensus, producing `ideas-reference-{title}_v{n}.md`. Analysis is fully AI-driven: the service instructs AI providers to return structured JSON with strengths, weaknesses, risks, feasibility, next steps, and structured profiles (TechnicalProfile, CommercialProfile, ExecutionProfile, ViabilityAssessment), then parses and validates the response with fallback extraction from free text. Purpose-aware analysis supports 5 project types (commercial, developer_tool, internal, open_source, learning) with tailored system prompts and validation criteria. **Intelligence Upgrade**: Weighted scoring formula (viability 40%, technical complexity 25%, commercial clarity 20%, execution risk 15%) replaces simple average. New recommendation rules: compliance+solo→STOP, effort>24wks solo→REVISE, weak differentiation+high competition→REVISE, applied before score thresholds. Frontend renders three profile panels (Technical, Commercial, Execution) with color-coded values and effort estimates. Workshop comparison tracks profile-level deltas. Guided Refinement Workshop generates purpose-adaptive open-ended questions that reference the specific idea and its analysis findings. Domain Research: `ResearchService` generates a research brief before analysis covering competitors, regulations, industry specifics, and market signals (cached 30 min). Refinement uses a dedicated system prompt that instructs AI to build on prior analysis, workshop Q&A evidence, and research findings rather than starting fresh.
- **Requirements Module**: Converts validated ideas into comprehensive requirements documents, producing `requirements-reference-{title}_v{n}.md`. **Intelligence Upgrade**: Replaced hardcoded template-based generation with AI-driven structured JSON parsing. System prompt enforces strict JSON schema output; `tryParseJSON` with fallback free-text extraction handles provider variance. 15+ validation methods normalize AI responses (handles both array/object NFR formats, singular/plural dataModel, apiContracts as array or object). New types: SystemOverview (purpose, coreUser, primaryOutcome), ArchitectureDecision (decision/rationale/alternatives/tradeoffs), RiskTraceabilityEntry (maps idea risks → requirement IDs with fully-mitigated/partially-mitigated/unmitigated coverage). FunctionalRequirement extended with `originatingRiskIds` and `originatingAssumptionIds` for bidirectional risk traceability (populated via riskTraceability cross-reference). Frontend renders System Overview card, Architecture Decisions accordion, Risk Traceability table with color-coded coverage badges. 27 invariant tests cover type validation, risk traceability invariants, JSON normalization, and backward compatibility.
- **Prompts Module**: Generates sequential, IDE-specific build prompts from requirements, supporting Replit, Cursor, Lovable, Antigravity, Warp, and Generic IDEs, producing `build-prompts-{title}-{ide}_v{n}.md`. **Prompt Orchestration Rewrite**: Replaced static 12-step template (`getBasePrompts()`) with `generatePromptsFromRequirements(requirementsDoc)` that dynamically derives prompt steps from the structured RequirementsDocument. Each step includes required `requirementsCovered` IDs for traceability (non-optional). **Prompt → Requirement Traceability**: Every PromptStep explicitly links to one or more requirement IDs; each requirementId maps to an existing FR/NFR/AD; each FunctionalRequirement traces back to idea risk drivers via `originatingRiskIds`. Full chain: PromptStep → requirementId → riskId is deterministic and verified by 8 traceability invariant tests. Deterministic ordering: architecture→dataModel→API→UI→security→performance→polish. High-priority FRs get dedicated steps; medium FRs grouped by category. NFRs mapped to dedicated security/performance steps or embedded as constraints. `explicitOutOfScope` items injected as `scopeGuardrails`. IDE adaptation remains a formatting-only layer. 24 invariant tests verify dynamic generation, dependency ordering, requirement coverage, and traceability (115 total tests). Includes structured prompt feedback loop with deterministic failure classification and static recovery steps.

## External Dependencies

- **AI Services**:
    - OpenAI (`OPENAI_API_KEY`)
    - Anthropic (`ANTHROPIC_API_KEY`)
    - Google Gemini (`GEMINI_API_KEY`)
- **Database**:
    - PostgreSQL (`DATABASE_URL`)
    - Drizzle Kit (for migrations)
- **Build Tools**:
    - Vite (frontend)
    - esbuild (server-side)
    - TypeScript
- **Replit-Specific Integrations**:
    - `@replit/vite-plugin-runtime-error-modal`
    - `@replit/vite-plugin-cartographer`
    - `@replit/vite-plugin-dev-banner`
- **Authentication**:
    - Replit Auth (OpenID Connect)
    - Email/password local auth (bcryptjs, express-session)
    - Dual auth: users table has `authProvider` field ("replit" | "local") and optional `passwordHash`
    - Test user: mat@mte-software.com (admin, professional plan)