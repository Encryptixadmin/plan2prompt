# Production-Ready Web Platform

## Overview

A scalable and modular web platform designed for building production-grade web applications. Its primary purpose is to streamline the validation, refinement, and development of application ideas through an AI-powered pipeline. The platform aims to generate detailed requirements and sequential build prompts, ensuring a clean separation between frontend, backend, and shared contracts for extensibility and maintainability. It integrates advanced AI services (OpenAI, Anthropic, Gemini) and produces structured Markdown outputs as first-class artifacts. The platform's ambition is to validate and refine application ideas using AI consensus, convert them into comprehensive requirements, and then generate IDE-specific build prompts, ultimately accelerating the development lifecycle from concept to deployable application.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 19 with TypeScript and Vite.
- **Styling**: Tailwind CSS with shadcn/ui (New York style) on Radix UI, using Inter and JetBrains Mono fonts.
- **Design System**: Indigo primary palette (238 76% 60%), warm-tinted neutral scale (blue-slate backgrounds, off-white cards), warm beige accent (32 30% 93%), refined shadows, dot pattern and gradient glow utilities, and full dark mode support via ThemeProvider. Landing page uses `bg-secondary/50` for alternating section backgrounds. CSS utilities: `text-gradient-primary`, `bg-dot-pattern`, `bg-hero-glow`, `bg-gradient-cta`, `bg-auth-brand`.
- **Layout**: AppShell for authenticated pages with Shadcn Sidebar navigation (Dashboard/Ideas/Requirements/Prompts/MCP Setup/Account/Admin) and a top bar.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **Admin Console**: `/admin` route with 8-tab dashboard: Overview (KPI stat cards, user growth chart, plan distribution, recent signups), Users (search, filter by plan, inline plan changes, enable/disable generation), Projects (search, member/artifact counts, enable/disable), Health (AI provider status), Billing (plan usage), Usage (token/cost tracking), Artifacts (pipeline integrity), Audit Log (admin action history). All data queries from PostgreSQL (not in-memory).

### Technical Implementations
- **Backend Runtime**: Node.js with Express.
- **API Design**: RESTful endpoints using `ApiResponse<T>` wrappers.
- **Data Layer**: Drizzle ORM with PostgreSQL dialect, Zod schemas, and `MemStorage` for development.
- **AI Service Integration**: Unified `IAIProvider` interface supporting OpenAI, Anthropic, and Gemini. `ConsensusService` orchestrates multiple providers, handles retries, and tracks usage. Circuit breaker pattern (`server/services/ai/circuit-breaker.ts`) with CLOSED/OPEN/HALF_OPEN states, 5-failure threshold, 60s cooldown. Provider status includes circuit state in admin health check.
- **Artifact System**: Markdown files with YAML frontmatter, immutable versioning, stored in PostgreSQL. Idempotent filesystem migration runs on startup.
- **Shared Contracts**: TypeScript interfaces in `shared/types/` with `@shared/*` aliases.
- **Security & Isolation**: `X-Project-Id` enforcement, role-based access control, pipeline sequencing enforcement. User authentication via Replit Auth (OpenID Connect) with PostgreSQL-backed sessions. Helmet middleware for security headers (X-Frame-Options, X-Content-Type-Options, HSTS in production). CSRF protection via JSON content-type enforcement on state-changing routes + `sameSite: lax` cookies.
- **Project Context**: Middleware and hooks ensure project isolation and guide users through project creation.
- **Auditing & Feedback**: Persistence of admin audit logs and prompt feedback events to PostgreSQL.
- **Structured Logging**: Pino-based JSON structured logging with per-request correlation IDs (`X-Request-Id` header). Sentry integration for error capture.
- **Rate Limiting**: `express-rate-limit` with PostgreSQL-backed store applied to AI generation routes (5 req/min per user), login (10/15min per IP), registration (5/hour per IP).
- **Billing Persistence**: `billing_usage` table in PostgreSQL tracks per-user monthly generation/token usage. `BillingService` manages plan mapping.
- **Graceful Shutdown**: SIGTERM/SIGINT handlers close HTTP server, drain DB pool, flush Sentry, with 10-second force-exit timeout. Process-level `unhandledRejection` and `uncaughtException` handlers with Sentry capture.
- **Health Check**: `GET /api/health` (unauthenticated) returns status, uptime, timestamp, and database connectivity via `SELECT 1` ping.
- **Error Boundaries**: React ErrorBoundary component wraps authenticated app routes to prevent full-page crashes.
- **Database Transactions**: Artifact create/update operations wrapped in `db.transaction()` for atomic writes.
- **Pagination**: List endpoints (clarifications, requirements/ideas, prompts/requirements) support `?limit=N&offset=M` query params (default 50, max 200).
- **Standardized Error Format**: All API error responses use `{ success: false, error: { code: string, message: string } }`.
- **Testing**: Vitest-based test harness — 273 tests across 14 test files: invariant tests (pipeline sequencing, permissions, usage tracking, clarification contracts, traceability, MCP API key management, execution integrity, risk delta, failure classification) + integration tests (health check, auth, CSRF, error format, security headers).
- **Cross-Module Clarification Contracts**: Upward-only clarification system for downstream modules to request upstream clarification. Uses SHA256-based deterministic contract hashing, with categories like missing_information, contradiction, and execution_failure. Severity levels are advisory and blocker, with automatic escalation.
- **SSE Generation Progress**: All three generation endpoints (`/analyze-stream`, `/generate-stream`) support Server-Sent Events streaming with progress callbacks. Frontend uses `useSSEGeneration` hook and `GenerationProgress` component to show real-time stage updates during AI generation.
- **Artifact Export**: `GET /api/artifacts/:id/export?format=markdown` returns downloadable Markdown files with proper Content-Disposition headers. Export buttons available on accepted Ideas, locked Requirements, and generated Prompts.
- **Pipeline Dashboard**: `GET /api/projects/:id/pipeline` returns idea-centric pipeline status with downstream artifact counts. Dashboard shows each idea's journey through the pipeline with contextual next-action buttons.
- **Version History UI**: `VersionHistoryPanel` and `VersionComparePanel` integrated into Ideas and Requirements pages via Sheet overlays, accessible via "Version History" buttons on accepted/locked artifacts.
- **MCP Server (v1.2)**: Model Context Protocol server at `/mcp` route enabling IDE AI assistants (Cursor, Windsurf, Claude Code, etc.) to interact with Plan2Prompt. Uses `@modelcontextprotocol/sdk` with Streamable HTTP transport. Authenticates via API keys (`api_keys` table, SHA-256 hashed). Exposes 11 tools (start_session, get_session_status, get_current_step, complete_step, batch_complete_steps, report_failure, skip_to_step, classify_failure, list_clarifications, get_clarification, resolve_clarification) and 6 resources (project://requirements, project://idea-analysis, project://prompt-steps, project://prompt-steps-structured, project://session-state, project://execution-progress). Post-auth in-memory rate limiting (60 req/min per user). Graceful session expiry messaging (409 with reconnection instructions). Per-request project override via X-Project-Id header. Step time tracking (`startedAt`/`completedAt` timestamps with duration calculation). Batch step completion with db.transaction() for atomic writes.
- **API Key Management**: `api_keys` table with SHA-256 hashed keys, `p2p_` prefix. Account settings page at `/account` with key generation, listing, and revocation. Generated keys shown once with copy button.
- **Account Data Management**: `GET /api/account/export` returns all user data as JSON (profile, projects, API keys, billing, artifacts, sessions). `DELETE /api/account` anonymizes user record (nulls PII, sets `deletedAt`), revokes API keys, removes project memberships, destroys session. Account page has "Export My Data" and "Delete My Account" (with confirmation dialog) buttons.
- **Static Asset Caching**: Production static serving with Cache-Control headers — hashed assets (JS/CSS) get `immutable` 1-year cache, other assets get 1-day cache, `index.html` gets `no-cache`.
- **SEO**: Full SEO implementation with static meta tags in `index.html` (title, description, OG, Twitter Card, canonical, JSON-LD SoftwareApplication schema) plus dynamic per-route updates via `usePageTitle` hook (`client/src/hooks/use-page-title.ts`) that sets document.title, meta description, OG/Twitter tags, and canonical URL on each route change. Static `robots.txt` (disallows /api/, /mcp/, /admin) and `sitemap.xml` (/ and /auth) in `client/public/`. OG share image at `client/public/og-image.png`. Google Fonts trimmed to Inter + JetBrains Mono + Source Serif 4 only.

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
- **MCP Integration**:
    - `@modelcontextprotocol/sdk` (Streamable HTTP transport for IDE connectivity)
- **Authentication**:
    - Replit Auth (OpenID Connect)
    - Email/password local auth (bcryptjs, express-session)
    - API key auth for MCP (SHA-256 hashed, `p2p_` prefix)