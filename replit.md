# Production-Ready Web Platform

## Overview

A scalable and modular web platform designed for building production-grade web applications. Its primary purpose is to streamline the validation, refinement, and development of application ideas through an AI-powered pipeline. The platform aims to generate detailed requirements and sequential build prompts, ensuring a clean separation between frontend, backend, and shared contracts for extensibility and maintainability. It integrates advanced AI services (OpenAI, Anthropic, Gemini) and produces structured Markdown outputs as first-class artifacts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 19 with TypeScript and Vite.
- **Styling**: Tailwind CSS with shadcn/ui (New York style) built on Radix UI primitives.
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
- **Invariant Testing**: Vitest-based test harness for core platform behaviors, including pipeline sequencing, STOP recommendations, permission boundaries, failure classification, and usage tracking.

### Feature Specifications
- **Ideas Module**: Validates and refines application ideas using AI consensus, producing `ideas-reference-{title}_v{n}.md`.
- **Requirements Module**: Converts validated ideas into comprehensive requirements documents, producing `requirements-reference-{title}_v{n}.md`.
- **Prompts Module**: Generates sequential, IDE-specific build prompts from requirements, supporting Replit, Cursor, Lovable, Antigravity, Warp, and Generic IDEs, producing `build-prompts-{title}-{ide}_v{n}.md`. Includes structured prompt feedback loop with deterministic failure classification and static recovery steps.

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