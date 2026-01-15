# Production-Ready Web Platform

## Overview

A scalable, modular web platform built for extensibility and maintainability. The platform serves as a foundation for production-grade web applications with modular architecture supporting independent feature modules, AI service integration capabilities (OpenAI, Anthropic, Gemini), structured Markdown outputs as first-class artefacts, and clean separation between frontend, backend, and shared contracts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 19 with TypeScript and Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **State Management**: TanStack Query for server state and data fetching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express framework
- **API Design**: RESTful endpoints with consistent response wrappers (`ApiResponse<T>`)
- **Storage Pattern**: Interface-based storage abstraction (`IStorage`) with in-memory implementation for development
- **Modular Routes**: Feature-specific route files under `server/routes/` (artifacts, AI, ideas)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for database schemas
- **Validation**: Zod schemas with drizzle-zod integration
- **Development Mode**: MemStorage class provides in-memory data storage when database is not configured

### AI Service Integration
- **Multi-Provider Support**: OpenAI, Anthropic, and Gemini services with unified interface (`IAIProvider`)
- **Consensus Mechanism**: `ConsensusService` orchestrates multiple providers and produces unified output
- **Mock Implementation**: All providers currently return mock responses; designed for easy swap to real APIs when keys are configured

### Artifact System
- **Format**: Markdown files with YAML frontmatter for metadata
- **Storage**: File-based storage in `artifacts/` directory, organized by module
- **Versioning**: Immutable versioning with `_v{version}.md` naming convention
- **Structure**: Each artifact contains metadata, sections, AI notes, and raw content

### Shared Contracts
- **Location**: `shared/types/` contains TypeScript interfaces shared between frontend and backend
- **Key Types**: `Artifact`, `AIPrompt`, `AIConsensusResult`, `IdeaAnalysis`
- **Path Aliases**: `@shared/*` resolves to `shared/*` for clean imports

### Ideas Module
- **Purpose**: Validate and refine app ideas using AI consensus
- **Frontend**: `/ideas` route with form for idea submission and results display
- **Backend**: `POST /api/ideas/analyze` processes ideas through AI consensus
- **Output**: Structured analysis saved as `ideas-reference-{title}_v{n}.md` in `artifacts/ideas/`
- **Handoff**: Creates artifacts compatible with Requirements Module via `artifactId`

## External Dependencies

### UI Component Libraries
- **Radix UI**: Comprehensive set of accessible, unstyled primitives for dialogs, menus, forms, and more
- **shadcn/ui**: Pre-configured Tailwind-styled components built on Radix primitives

### AI Services (Mock Mode)
- **OpenAI**: GPT-4 Turbo integration (requires `OPENAI_API_KEY`)
- **Anthropic**: Claude 3 Opus integration (requires `ANTHROPIC_API_KEY`)
- **Google Gemini**: Gemini Pro integration (requires `GEMINI_API_KEY`)

### Database
- **PostgreSQL**: Primary database when `DATABASE_URL` environment variable is set
- **Drizzle Kit**: Database migrations via `db:push` command

### Build Tools
- **Vite**: Frontend development server and production bundler
- **esbuild**: Server-side bundling for optimized production builds
- **TypeScript**: Full type checking across client, server, and shared code

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling (dev only)
- **@replit/vite-plugin-dev-banner**: Development banner (dev only)