# Production-Ready Web Platform

## Overview

A scalable and modular web platform designed for building production-grade web applications. It features a modular architecture supporting independent feature modules, advanced AI service integrations (OpenAI, Anthropic, Gemini), and structured Markdown outputs as first-class artifacts. The platform ensures a clean separation between frontend, backend, and shared contracts, aiming for extensibility and maintainability. Its primary purpose is to streamline the validation, refinement, and development of application ideas through an AI-powered pipeline, generating detailed requirements and sequential build prompts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 19 with TypeScript and Vite.
- **Styling**: Tailwind CSS with shadcn/ui (New York style).
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod validation.

### Backend
- **Runtime**: Node.js with Express.
- **API Design**: RESTful endpoints using `ApiResponse<T>` wrappers.
- **Storage**: Interface-based `IStorage` with in-memory implementation for development.
- **Modularity**: Feature-specific route files.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: `shared/schema.ts` for database schemas.
- **Validation**: Zod schemas with drizzle-zod.
- **Development**: `MemStorage` class for in-memory data storage.

### AI Service Integration
- **Multi-Provider Support**: Integrates OpenAI (gpt-4o-mini), Anthropic (claude-3-5-sonnet), and Gemini (gemini-1.5-pro) via a unified `IAIProvider` interface.
- **Consensus Mechanism**: `ConsensusService` orchestrates multiple providers for robust output and handles failures.
- **Resilience**: Includes retry logic with exponential backoff and timeout handling.
- **Usage Tracking**: `UsageService` tracks token usage and estimates costs.

### Artifact System
- **Format**: Markdown files with YAML frontmatter for metadata.
- **Storage**: File-based in `artifacts/` directory, organized by module.
- **Versioning**: Immutable versioning using `_v{version}.md` convention.
- **Structure**: Each artifact contains metadata, sections, AI notes, and raw content.

### Shared Contracts
- **Location**: `shared/types/` for TypeScript interfaces shared across frontend and backend.
- **Path Aliases**: `@shared/*` for clean imports.

### Ideas Module
- **Purpose**: Validate and refine application ideas using AI consensus.
- **Process**: Submits ideas to `POST /api/ideas/analyze` for AI processing.
- **Output**: Structured analysis saved as `ideas-reference-{title}_v{n}.md`.

### Requirements Module
- **Purpose**: Convert validated ideas into comprehensive requirements documents.
- **Process**: Generates requirements from idea artifacts via `POST /api/requirements/generate`.
- **Output**: Structured requirements saved as `requirements-reference-{title}_v{n}.md`.

### Prompts Module
- **Purpose**: Generate sequential, IDE-specific build prompts from requirements.
- **Process**: Generates prompts from requirements artifacts via `POST /api/prompts/generate`.
- **Output**: Ordered prompts saved as `build-prompts-{title}-{ide}_v{n}.md`.
- **IDE Support**: Supports Replit, Cursor, Lovable, Antigravity, Warp, and Generic.

### Security & Isolation
- **Project Context**: `server/middleware/project-context.ts` enforces project isolation with `X-Project-Id`.
- **Permission Guards**: Role-based access control (`canGenerate`, `canEdit`, `canLock`).
- **Sequencing Enforcement**: Enforces a pipeline of stages (DRAFT_IDEA → VALIDATED_IDEA → LOCKED_REQUIREMENTS → PROMPTS_GENERATED) to maintain workflow integrity.
- **Admin Console**: `/admin` route with admin middleware for managing providers, usage, users, projects, and auditing actions.

## External Dependencies

### UI Component Libraries
- **Radix UI**: Accessible, unstyled primitives.
- **shadcn/ui**: Pre-configured Tailwind-styled components built on Radix.

### AI Services
- **OpenAI**: Requires `OPENAI_API_KEY`.
- **Anthropic**: Requires `ANTHROPIC_API_KEY`.
- **Google Gemini**: Requires `GEMINI_API_KEY`.

### Database
- **PostgreSQL**: Primary database, configured via `DATABASE_URL`.
- **Drizzle Kit**: For database migrations.

### Build Tools
- **Vite**: Frontend development and bundling.
- **esbuild**: Server-side bundling.
- **TypeScript**: Full type checking.

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay.
- **@replit/vite-plugin-cartographer**: Development tooling.
- **@replit/vite-plugin-dev-banner**: Development banner.

## Recent Changes

### Phase 4, Step 3: Invariant Test Harness (January 2026)
- Added Vitest-based test harness in /tests/invariants/
- Exactly 12 invariant tests protecting core platform behavior
- Pipeline Sequencing: 4 tests (stage validation, outdated blocking)
- STOP Recommendation: 2 tests (acknowledgment enforcement, audit logging)
- Permission Boundaries: 3 tests (viewer, collaborator, admin restrictions)
- Failure Classification: 2 tests (determinism, unknown classification)
- Usage & Billing: 1 test (recordGeneration, usage increment, threshold warning)
- No UI tests, no snapshot tests, no coverage tooling

### Phase 4, Step 2: Feedback Metrics & Failure Pattern Taxonomy (January 2026)
- Added PromptFeedbackEvent schema for write-once metrics logging
- Added FailureCategory enum and FailurePatternDefinition schema
- FeedbackMetricsService records events with hash-only storage (no raw output stored)
- ClassifierService uses deterministic pattern matching against failure taxonomy
- 12 known failure patterns defined in FAILURE_PATTERN_TAXONOMY
- UNKNOWN_UNCLASSIFIED default pattern for unclassified failures
- Documented promotion rule: unknown → known requires 3+ occurrences across 2+ projects
- No billing/usage impact from feedback events

### Phase 4, Step 1: Structured Prompt Feedback Loop (January 2026)
- Added deterministic failure classification for build prompts
- POST /api/prompts/feedback endpoint for step-scoped issue resolution
- FeedbackService with pattern matching against known failure patterns
- Static recovery steps defined for common failures (dependency conflicts, database errors, CORS, etc.)
- Known failures return: failure pattern name, cause, recovery steps, STOP instruction
- Unknown failures return: unclassified statement, STOP instruction only (no suggestions)
- Anti-chat enforcement: no questions, no conversational responses, no scope expansion
- StepFeedbackForm component with read-only step/IDE, paste-only textarea
- "Resolve Step Issue" button per prompt step in prompts page
- Audit logging of feedback attempts (transient, not stored long-term)

### Phase 3, Enforcement Step 4: User Authentication (January 2026)
- Replaced hardcoded default user with Replit Auth (OpenID Connect)
- User model extended with role, billingPlan, isAdmin, generationDisabled fields
- Session handling via PostgreSQL-backed sessions with SESSION_SECRET
- Data persistence: Users, Projects, Memberships now stored in PostgreSQL
- Artifacts remain file-based as specified
- Landing page for logged-out users with login via /api/login
- Home page displays user profile with logout via /api/logout
- Admin role assignment remains manual (update role field in database)