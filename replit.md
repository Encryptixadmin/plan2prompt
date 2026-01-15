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
- **Multi-Provider Support**: OpenAI (gpt-4o-mini), Anthropic (claude-3-5-sonnet), and Gemini (gemini-1.5-pro) with unified interface (`IAIProvider`)
- **Consensus Mechanism**: `ConsensusService` orchestrates multiple providers with graceful failure handling and produces unified output
- **Real API Integration**: Providers check for API keys and use real APIs when configured, with automatic fallback to mock responses
- **Resilience Features**: Retry logic with exponential backoff, timeout handling, and partial failure support (continues with available providers)
- **Usage Tracking**: `UsageService` tracks token usage (input/output breakdown), cost estimation per model, and soft threshold warnings

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

### Requirements Module
- **Purpose**: Convert validated ideas into comprehensive requirements documents
- **Frontend**: `/requirements` route with idea selector and detailed requirements display
- **Backend**: `POST /api/requirements/generate` generates requirements from idea artifacts
- **Output**: Structured requirements saved as `requirements-reference-{title}_v{n}.md` in `artifacts/requirements/`
- **Includes**: Functional requirements, non-functional requirements, architecture overview, data models, API contracts, UI/UX principles, security considerations

### Prompts Module
- **Purpose**: Generate sequential, IDE-specific build prompts from requirements
- **Frontend**: `/prompts` route with requirements selector, IDE picker, and prompt display with copy buttons
- **Backend**: `POST /api/prompts/generate` generates prompts from requirements artifacts
- **Output**: Ordered prompts saved as `build-prompts-{title}-{ide}_v{n}.md` in `artifacts/prompts/`
- **IDE Support**: Replit, Cursor, Lovable, Antigravity, Warp, Other/Generic
- **Features**: STOP/WAIT instructions, estimated times, dependencies, copy-paste ready prompts

## External Dependencies

### UI Component Libraries
- **Radix UI**: Comprehensive set of accessible, unstyled primitives for dialogs, menus, forms, and more
- **shadcn/ui**: Pre-configured Tailwind-styled components built on Radix primitives

### AI Services (Real + Mock Fallback)
- **OpenAI**: gpt-4o-mini integration (requires `OPENAI_API_KEY`, falls back to mock if not set)
- **Anthropic**: Claude 3.5 Sonnet integration (requires `ANTHROPIC_API_KEY`, falls back to mock if not set)
- **Google Gemini**: Gemini 1.5 Pro integration (requires `GEMINI_API_KEY`, falls back to mock if not set)
- **Usage Tracking**: Per-request token tracking with cost estimation based on model pricing

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

## Security & Isolation

### Project Context System
- **Middleware**: `server/middleware/project-context.ts` enforces project isolation via `X-Project-Id` header
- **Permission Guards**: Role-based gates with `canGenerate`, `canEdit`, `canLock` permissions
- **Error Codes**: Clear error responses including `MISSING_PROJECT_CONTEXT`, `PROJECT_NOT_FOUND`, `ACCESS_DENIED`, `PERMISSION_DENIED`, `PROJECT_ISOLATION_VIOLATION`
- **Artifact Ownership**: All artifacts include `projectId` and `authorId` metadata

### Sequencing Enforcement
- **Pipeline Stages**: `DRAFT_IDEA` → `VALIDATED_IDEA` → `LOCKED_REQUIREMENTS` → `PROMPTS_GENERATED`
- **Blocked States**: Clear UI explanations when prerequisites not met
- **STOP Recommendations**: Require explicit acknowledgment via `acknowledgeStopRecommendation` flag

### Admin Console
- **Location**: `/admin` route with admin middleware protection (`server/middleware/admin.ts`)
- **Access Control**: `requireAdmin` middleware checks user admin status via `adminService`
- **Tabs**: Providers (health/disable/enable), Usage (costs/tokens), Artifacts (pipeline integrity), Actions (audit log)
- **Confirmation Pattern**: All destructive admin actions require `confirm: true` flag
- **Soft-Disable**: Users and projects can have generation disabled without losing existing content
- **Action Logging**: All admin operations recorded with actor, target, timestamp, and reason
- **Navigation Safety**: "Admin Mode" indicator badge, "Exit Admin" button with context restoration
- **Route Tracking**: Last non-admin route stored in sessionStorage via `useTrackNonAdminRoute` hook

### Admin API Endpoints
- `GET /api/admin/health` - Provider status and error counts
- `POST /api/admin/providers/:provider/disable` - Disable AI provider (requires confirmation)
- `POST /api/admin/providers/:provider/enable` - Enable AI provider (requires confirmation)
- `GET /api/admin/usage` - Usage summary and cost breakdown
- `GET /api/admin/users` - List users with generation status
- `POST /api/admin/users/:userId/disable-generation` - Soft-disable user generation
- `POST /api/admin/users/:userId/enable-generation` - Re-enable user generation
- `GET /api/admin/projects` - List projects with generation status
- `POST /api/admin/projects/:projectId/disable-generation` - Soft-disable project generation
- `POST /api/admin/projects/:projectId/enable-generation` - Re-enable project generation
- `GET /api/admin/artifacts/integrity` - Pipeline stage counts and artifact totals
- `GET /api/admin/actions` - Admin action audit log

## Documentation

- **Alpha Readiness Checklist**: `docs/ALPHA_READINESS_CHECKLIST.md` - Internal testing checklist
- **Design Guidelines**: `design_guidelines.md` - UI/UX standards for the platform

## Recent Changes

### Phase 3, Enforcement Step 2: STOP Recommendation Hard Block (January 2026)
- POST /api/ideas/accept now enforces acknowledgeStopRecommendation === true for STOP recommendations
- Error code STOP_RECOMMENDATION_REQUIRED returned when trying to accept STOP idea without acknowledgement
- Acknowledgement recorded in artifact metadata (stopAcknowledged, stopAcknowledgedAt fields)
- STOP override logged in admin action log with actor, target, timestamp, and reason
- Extended AdminActionType with "stop_recommendation_override" and AdminActionTarget with "idea"
- No auto-acknowledgement, no downgrade of STOP to warning, no changes to recommendation scoring logic

### Phase 3, Enforcement Step 1: Backend Pipeline Hardening (January 2026)
- POST /api/requirements/generate now enforces stage === VALIDATED_IDEA with PIPELINE_VIOLATION error
- POST /api/prompts/generate now enforces stage === LOCKED_REQUIREMENTS with PIPELINE_VIOLATION error
- Added isArtifactOutdated() check to block prompts from requirements with newer source ideas
- Clear error messages distinguish between wrong stage vs missing stage metadata
- Version invalidation: downstream artifacts are detected as outdated when source has newer version
- Backend is source of truth - UI controls are advisory only
- No new routes, no UI changes, existing permissions unchanged

### Phase 3, Step 2D: Billing Foundations - No Payments (January 2026)
- Created BillingPlan model with: id, name, description, softLimits (monthlyGenerations, monthlyTokenBudget), status
- Initial plans: Free (default), Pro (future), Team (future) - all active status
- Attached billingPlan field to users, defaulting to "free"
- Billing service tracks user usage per month with automatic monthly reset
- User-facing BillingStatus component shows current plan, usage progress bars, and "coming soon" messaging
- Soft limit warnings at 80% and 100% thresholds - warnings only, no blocking
- Admin Console: Billing tab with aggregate usage by plan (user count, total generations, tokens per plan)
- Admin Users table shows Plan column for each user
- NO payment processing, Stripe, checkout flows, pricing pages, or plan switching UI

### Phase 3, Step 2C: User Management Read-Only + Soft Control (January 2026)
- Added Users tab to Admin Console with full user list display
- User list shows: User ID, username, email, role, status, project count, last activity, usage summary
- Role badges: admin (default), owner (secondary), collaborator/viewer (outline)
- Status indicators: Active (green) or Disabled (red) with clear visual distinction
- Soft-disable/enable generation with confirmation dialogs and required reason for disable
- Admin users cannot have generation disabled (button disabled)
- All actions logged to admin action log with actor, target, timestamp, and reason
- No destructive actions: no deletion, no role changes, no password resets

### Phase 3, Step 2B: Admin Re-Entry Navigation (January 2026)
- Created `useAdminStatus` hook to check admin access via `/api/admin/health` endpoint
- Added "Admin" navigation link to all main page headers (Home, Ideas, Requirements, Prompts)
- Admin link visible ONLY when user has admin role (defaults to hidden during loading)
- Navigation explicitly goes to /admin route (no mode toggling)
- Backend role enforcement remains unchanged (frontend is not sole guard)

### Phase 3, Step 2A: Admin Navigation & Safe Exit (January 2026)
- Added "Admin Mode" indicator badge for visual distinction
- Implemented "Exit Admin" button with navigation to last non-admin route
- Created route tracking hook (`useTrackNonAdminRoute`) for context preservation
- Added exit confirmation dialog when actions may be in progress
- Context restoration preserves project and module state on exit

### Phase 3, Step 2: Admin Console (January 2026)
- Added admin role to user schema with generation disabled flags
- Created admin middleware for /api/admin/* route protection
- Built admin action logging service with full audit trail
- Implemented provider health endpoints with disable/enable (confirmation required)
- Added usage and cost oversight endpoint with per-provider breakdown
- Created user/project soft-disable endpoints for generation control
- Implemented artifact pipeline integrity endpoint with stage counts
- Built admin console UI with tabbed interface (Providers, Usage, Artifacts, Actions)
- All admin actions require explicit confirmation to prevent accidents

### Phase 3, Step 1: Real AI Provider Integration (January 2026)
- Implemented real API support for OpenAI, Anthropic, and Gemini providers
- Added automatic fallback to mock responses when API keys not configured
- Enhanced provider base class with retry logic, timeout handling, and token estimation
- Created usage tracking service with cost estimation and soft threshold warnings
- Updated consensus service to handle partial failures gracefully
- Responses now include `isMock` flag to identify when real APIs aren't being used
- Token usage tracked separately (input vs output) for accurate cost estimation

### Phase 2, Step 8: UI Polish
- Improved all user-facing copy to use plain language
- Error messages now show helpful, human-readable text
- Empty states provide clear next actions
- Alpha readiness checklist created for testing