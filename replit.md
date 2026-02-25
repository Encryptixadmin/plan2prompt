# Production-Ready Web Platform

## Overview

A scalable and modular web platform designed for building production-grade web applications. Its primary purpose is to streamline the validation, refinement, and development of application ideas through an AI-powered pipeline. The platform aims to generate detailed requirements and sequential build prompts, ensuring a clean separation between frontend, backend, and shared contracts for extensibility and maintainability. It integrates advanced AI services (OpenAI, Anthropic, Gemini) and produces structured Markdown outputs as first-class artifacts. The platform's ambition is to validate and refine application ideas using AI consensus, convert them into comprehensive requirements, and then generate IDE-specific build prompts, ultimately accelerating the development lifecycle from concept to deployable application.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 19 with TypeScript and Vite.
- **Styling**: Tailwind CSS with shadcn/ui (New York style) on Radix UI, using Inter and JetBrains Mono fonts.
- **Design System**: Indigo primary palette, sophisticated neutral scale, refined shadows, and full dark mode support via ThemeProvider.
- **Layout**: AppShell for authenticated pages with Shadcn Sidebar navigation (Dashboard/Ideas/Requirements/Prompts/Admin) and a top bar.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **Admin Console**: `/admin` route for managing providers, usage, users, projects, and auditing.

### Technical Implementations
- **Backend Runtime**: Node.js with Express.
- **API Design**: RESTful endpoints using `ApiResponse<T>` wrappers.
- **Data Layer**: Drizzle ORM with PostgreSQL dialect, Zod schemas, and `MemStorage` for development.
- **AI Service Integration**: Unified `IAIProvider` interface supporting OpenAI, Anthropic, and Gemini. `ConsensusService` orchestrates multiple providers, handles retries, and tracks usage.
- **Artifact System**: Markdown files with YAML frontmatter, immutable versioning, stored in PostgreSQL. Idempotent filesystem migration runs on startup.
- **Shared Contracts**: TypeScript interfaces in `shared/types/` with `@shared/*` aliases.
- **Security & Isolation**: `X-Project-Id` enforcement, role-based access control, pipeline sequencing enforcement. User authentication via Replit Auth (OpenID Connect) with PostgreSQL-backed sessions.
- **Project Context**: Middleware and hooks ensure project isolation and guide users through project creation.
- **Auditing & Feedback**: Persistence of admin audit logs and prompt feedback events to PostgreSQL.
- **Structured Logging**: Pino-based JSON structured logging. Sentry integration for error capture.
- **Rate Limiting**: `express-rate-limit` with PostgreSQL-backed store applied to AI generation routes (5 req/min per user).
- **Billing Persistence**: `billing_usage` table in PostgreSQL tracks per-user monthly generation/token usage. `BillingService` manages plan mapping.
- **Invariant Testing**: Vitest-based test harness for core platform behaviors, covering pipeline sequencing, permissions, usage tracking, clarification contracts, and traceability.
- **Cross-Module Clarification Contracts**: Upward-only clarification system for downstream modules to request upstream clarification. Uses SHA256-based deterministic contract hashing, with categories like missing_information, contradiction, and execution_failure. Severity levels are advisory and blocker, with automatic escalation.

### Feature Specifications
- **Ideas Module**: Validates and refines application ideas using AI consensus, producing versioned Markdown artifacts. AI-driven analysis returns structured JSON with strengths, weaknesses, risks, feasibility, and structured profiles (Technical, Commercial, Execution, Viability). Includes weighted scoring, compliance/effort-based recommendations, and a guided refinement workshop with purpose-adaptive questions. Incorporates domain research covering competitors and market signals. Features a Risk Resolution Delta Model for deterministic post-workshop risk transparency.
- **Requirements Module**: Converts validated ideas into comprehensive requirements documents, producing versioned Markdown artifacts. Uses AI-driven structured JSON parsing for generation, with extensive validation and normalization of AI responses. Introduces SystemOverview, ArchitectureDecision, and RiskTraceabilityEntry types, linking idea risks to requirement IDs for bidirectional traceability.
- **Prompts Module**: Generates sequential, IDE-specific build prompts from requirements, supporting various IDEs (Replit, Cursor, Lovable, Antigravity, Warp, Generic). Dynamically derives prompt steps from structured RequirementsDocument, ensuring explicit traceability between prompt steps and requirement IDs. Includes structured prompt feedback loop with deterministic failure classification. Features persistent execution sessions and per-step state tracking in PostgreSQL, enforcing sequential execution and escalating after multiple failures. Incorporates Execution Integrity Controls by assigning `integrityLevel` (safe, caution, critical) and `isIdempotent` flags to prompt steps, with warnings and override mechanisms for critical, non-idempotent changes.

## External Dependencies

- **AI Services**:
    - OpenAI (`OPENAI_API_KEY`)
    - Anthropic (`ANTHROPIC_API_KEY`)
    - Google Gemini (`GEMINI_API_KEY`)
- **Database**:
    - PostgreSQL (`DATABASE_URL`) with Drizzle ORM and Drizzle Kit for migrations.
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