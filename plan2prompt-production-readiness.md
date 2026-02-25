# Plan2Prompt — Production Readiness Analysis

**Version 1.0.5 | MTE Software Ltd**
**Assessment Date: February 2026**

---

## Overall Score: 67 / 100

The platform has a genuinely sophisticated product and pipeline design. The gaps are almost entirely in the operational layer — billing persistence, observability, scalability — rather than in the product logic. This is a much easier class of problem to fix than architectural gaps would be.

---

## Dimension Scores

| Dimension | Score | Status |
|---|---|---|
| Pipeline architecture and enforcement | 9/10 | Production-grade |
| AI integration layer (ConsensusService) | 8/10 | Production-grade |
| Type safety and shared contracts | 8/10 | Production-grade |
| Invariant test coverage | 8/10 | Strong |
| Security model (auth, isolation, RBAC) | 7/10 | Solid with gaps |
| Authentication (dual-mode, session store) | 7/10 | Solid |
| Clarification contracts system | 7/10 | Strong |
| Execution integrity controls | 7/10 | Strong |
| Artifact storage (filesystem) | 5/10 | Not production-safe |
| Integration and E2E test coverage | 5/10 | Missing |
| Scalability (single-instance assumption) | 5/10 | Not production-safe |
| AI cost protection and rate limiting | 4/10 | Significant risk |
| Observability and error monitoring | 4/10 | Significant risk |
| Billing persistence (in-memory) | 3/10 | Critical gap |

---

## What Scores Well

### Pipeline Architecture — 9/10

The four-stage pipeline (`DRAFT_IDEA → VALIDATED_IDEA → LOCKED_REQUIREMENTS → PROMPTS_GENERATED`) with strict sequential gating enforced independently at the frontend and backend is genuinely production-grade. Stage validation returns structured error codes with hints, not vague HTTP errors. The `validateRequirementsGenerationStage()` and `validatePromptGenerationStage()` functions are correct and cannot be bypassed by UI manipulation because the backend validates independently.

### AI Integration Layer — 8/10

The `IAIProvider` interface, `ConsensusService` orchestration, retry handling, provider health checks, and per-provider token tracking are all solid. Running OpenAI, Anthropic, and Gemini in parallel and computing consensus confidence scores is considerably more robust than using a single provider. Provider failures are isolated — a degraded provider is excluded from the consensus round rather than causing the whole request to fail.

### Type Safety and Shared Contracts — 8/10

TypeScript throughout both frontend and backend. Shared `@shared/*` path aliases ensure frontend and backend use identical types. Zod validation at all API boundaries prevents malformed data reaching the service layer. Drizzle ORM schema serves as the single source of truth for the database model. This foundation is strong.

### Invariant Testing — 8/10

224 tests encoding behavioural contracts rather than implementation details. Coverage spans pipeline sequencing, STOP recommendation rules, permission boundaries, failure classification, usage tracking, clarification contracts, prompt→requirement traceability, risk resolution deltas, requirements traceability, execution integrity, execution sequencing, and prompt generation. These tests will catch regressions in core business rules reliably.

### Security Model — 7/10

Database-driven admin access (no hardcoded IDs), bcrypt password hashing for local auth, `X-Project-Id` enforcement with server-side ownership validation, and PostgreSQL-backed sessions are all correct patterns. Role-based access is enforced at both the middleware and component level.

---

## What Falls Short

### Billing is In-Memory — 3/10

**This is the most significant production gap.**

The `BillingService` uses JavaScript `Map` objects in process memory for user plan assignments and monthly usage tracking. Every server restart — deployment, crash, or idle timeout — resets all billing state to zero. This means:

- All plan assignments revert to `free`
- All monthly generation counts reset to zero
- All token budgets reset to zero
- Rate limiting and abuse protection become ineffective

For a platform that enforces usage limits by billing tier, this is a critical failure: the protection can be trivially reset by triggering a restart.

### Artifact Storage is Filesystem — 5/10

Ideas, requirements, and prompts are written to disk as Markdown files under `artifacts/`. This works correctly on a single persistent instance but is incompatible with:

- **Horizontal scaling**: A second instance has no access to artifacts written by the first
- **Ephemeral deployments**: Cloud platforms that don't guarantee persistent local disk (most of them)
- **Crash recovery**: If the server restarts mid-write, artifacts may be partially written
- **Backup and restore**: Filesystem artifacts require separate backup procedures outside the database

### No Rate Limiting on AI Generation Endpoints — 4/10

AI generation endpoints have soft billing limits, but those limits are in-memory (see above) and there is no HTTP-level rate limiting on the generation routes. A malicious or poorly-behaved user could:

- Trigger concurrent generation requests before any limit fires
- Reset limits by causing a restart
- Incur significant OpenAI, Anthropic, and Gemini API costs in a short time window

There is no middleware enforcing requests-per-minute or concurrent-request limits on expensive endpoints.

### No Observability Stack — 4/10

The platform has no structured application logging, no APM (Application Performance Monitoring) integration, no error tracking service, and no alerting. The audit log covers admin actions but not:

- Application errors and exceptions
- Slow AI provider responses
- Failed database queries
- Memory or CPU pressure
- Unexpected process exits

If something fails silently in production — an AI provider returning malformed JSON, a database query timing out — there is no mechanism to detect it without a user reporting it.

### No End-to-End or Integration Tests — 5/10

The 224 invariant tests are strong at the pure unit level, but there are no tests that exercise the full HTTP request → Express middleware → service → database → response path, and no browser-level tests that verify UI flows work end-to-end. This means:

- A broken route registration would not be caught by tests
- A database schema change that breaks a query would not be caught
- A UI regression that breaks the ideas submission form would not be caught

### Single-Instance Assumption — 5/10

Multiple components assume a single running server process:

- `BillingService` — in-process `Map`
- `UsageService` — likely similar
- Artifact filesystem storage
- Session state (partially mitigated by PostgreSQL session store, but application-layer caches are not)

Deploying more than one instance would produce inconsistent state across requests routed to different instances.

---

## Roadmap to 100/100

The following changes are listed in priority order. Items earlier in the list have higher impact and lower risk.

---

### Priority 1 — Critical (Required Before Any Real Usage)

#### 1.1 Persist Billing to PostgreSQL

**Current state**: In-memory `Map` in `BillingService`
**Required state**: PostgreSQL table for user plans and monthly usage

Steps:
1. Add `user_plans` table to `shared/schema.ts`: `userId`, `planId`, `updatedAt`
2. Add `usage_records` table: `userId`, `month` (YYYY-MM), `generationsCount`, `tokensCount`
3. Replace `BillingService` Map operations with Drizzle ORM queries
4. Add a monthly reset job or compute usage dynamically from `usage_records` filtered by current month
5. Update `recordGeneration()` to write to the database rather than mutate a Map
6. Migrate existing test user plan assignments to the database

**Effort**: 1–2 days
**Impact**: Eliminates the most critical operational risk

---

#### 1.2 Add HTTP Rate Limiting on AI Generation Routes

**Current state**: No rate limiting
**Required state**: Per-user request rate limits on `/api/ideas/analyze`, `/api/requirements/generate`, `/api/prompts/generate`

Steps:
1. Install `express-rate-limit` and `rate-limit-postgresql` (or Redis-backed store)
2. Apply a rate limiter middleware to all generation routes: e.g., 5 requests per minute per user
3. Apply a concurrent-request limiter: reject if the same user has an in-flight generation request
4. Return `429 Too Many Requests` with a `Retry-After` header
5. Surface the rate limit error clearly in the frontend

**Effort**: 1 day
**Impact**: Protects against runaway AI API costs

---

### Priority 2 — High (Required Before Paid Users)

#### 2.1 Move Artifact Storage to PostgreSQL or Object Storage

**Current state**: Markdown files on local filesystem under `artifacts/`
**Required state**: Artifacts stored in PostgreSQL (as text columns) or an object store (S3-compatible)

**Option A — PostgreSQL (simpler, recommended for current scale)**:
1. Add `artifacts` table to `shared/schema.ts`: `id`, `projectId`, `module`, `title`, `version`, `content` (text), `frontmatter` (jsonb), `createdAt`
2. Replace filesystem read/write in `ArtifactService` with database operations
3. Remove the `artifacts/` directory from the project

**Option B — Object storage (better for large artifacts at scale)**:
1. Integrate with an S3-compatible store (Cloudflare R2, AWS S3)
2. Store artifact metadata in PostgreSQL; content in object storage
3. Generate signed URLs for downloads

**Effort**: 2–3 days
**Impact**: Enables multi-instance deployment and crash-safe writes

---

#### 2.2 Add Structured Logging and Error Monitoring

**Current state**: No structured logging, no error tracking
**Required state**: Structured logs to stdout + error monitoring service

Steps:
1. Install `pino` for structured JSON logging on the backend
2. Replace all `console.log` / `console.error` calls with `pino` logger calls including context (userId, projectId, route, duration)
3. Add `pino-http` middleware to log every HTTP request with method, path, status code, and duration
4. Integrate Sentry (`@sentry/node` on backend, `@sentry/react` on frontend) for exception capture
5. Add a global Express error handler that logs to Sentry before returning a 500 response
6. Configure Sentry alerts for new error types

**Effort**: 1–2 days
**Impact**: Visibility into production failures; baseline for SLA monitoring

---

#### 2.3 Add Integration Tests for Core API Routes

**Current state**: Unit invariant tests only
**Required state**: HTTP-level tests for the three pipeline generation routes and execution endpoints

Steps:
1. Set up a test database (separate from production) for integration tests
2. Use `supertest` with the Express app to test full request→response paths
3. Write integration tests for:
   - `POST /api/ideas/analyze` — valid idea returns analysis; invalid stage returns `PIPELINE_VIOLATION`
   - `POST /api/requirements/generate` — requires `VALIDATED_IDEA`; generates and persists document
   - `POST /api/prompts/generate` — requires `LOCKED_REQUIREMENTS`; returns steps with integrity levels
   - `POST /api/execution/sessions` — creates session; pins artifact version
   - `PATCH /api/execution/sessions/:id/steps/:n` — enforces sequential completion
4. Run integration tests in CI before any deployment

**Effort**: 3–4 days
**Impact**: Catches route, middleware, and database issues that invariant tests cannot

---

### Priority 3 — Medium (Required for Scalability and Reliability)

#### 3.1 Add End-to-End Browser Tests

**Current state**: No browser-level tests
**Required state**: Playwright tests covering the critical user journeys

Tests to write:
- New user registration and project creation
- Idea submission and analysis rendering
- Workshop flow: questions generated, answers submitted, refined analysis shown
- Requirements generation: document renders with traceability table
- Prompt generation: steps render with integrity badges
- Execution session: start, complete a step, fail a step, see clarification panel

**Effort**: 4–5 days
**Impact**: Catches UI regressions that backend tests cannot

---

#### 3.2 Multi-Instance Readiness

**Current state**: Single-instance assumption throughout
**Required state**: Stateless server processes; all shared state in PostgreSQL

Steps:
1. Complete billing persistence (1.1) — eliminates in-process Map
2. Complete artifact database storage (2.1) — eliminates filesystem dependency
3. Audit all remaining service-level caches (e.g., `ResearchService` 30-minute cache) and move to a shared store (PostgreSQL `research_cache` table or Redis)
4. Verify session store uses PostgreSQL (`connect-pg-simple`) — already done, but confirm no in-memory fallback
5. Add a health check endpoint `GET /health` that returns 200 only if database connectivity is confirmed

**Effort**: 1–2 days (after 1.1 and 2.1 are complete)
**Impact**: Enables horizontal scaling and zero-downtime deployments

---

#### 3.3 CSRF Protection

**Current state**: No CSRF tokens on state-mutating routes
**Required state**: CSRF protection on all POST/PUT/DELETE routes for session-authenticated requests

Steps:
1. Install `csrf-csrf` or `csurf` (note: `csurf` is deprecated; prefer `csrf-csrf`)
2. Add CSRF middleware to Express for all non-GET routes
3. Expose CSRF token via a `GET /api/csrf-token` endpoint
4. Include the token in all frontend mutation requests via TanStack Query's `apiRequest`

**Effort**: 1 day
**Impact**: Prevents cross-site request forgery on authenticated routes

---

#### 3.4 API Input Sanitisation

**Current state**: Zod validates shape and type; no sanitisation of string content
**Required state**: Strip/escape potentially dangerous content from user-submitted text before it reaches AI providers

Steps:
1. Add a sanitisation layer in the idea submission route that strips control characters and enforces maximum lengths
2. Validate that `purpose` is a known enum value (already done via Zod, confirm)
3. Add maximum character limits to `description` and `context` fields (e.g., 5,000 characters for description)
4. Log and reject submissions that exceed limits with a clear user-facing error

**Effort**: 0.5 days
**Impact**: Prevents prompt injection attacks and runaway AI token consumption

---

### Priority 4 — Lower (Polish and Operational Excellence)

#### 4.1 Database Connection Pooling and Query Timeouts

Add explicit connection pool configuration to the Drizzle/PostgreSQL setup with maximum connections, idle timeout, and per-query timeout. Prevents a slow query from consuming all available connections.

**Effort**: 0.5 days

---

#### 4.2 Graceful Shutdown

Add a `SIGTERM` handler that stops accepting new requests, waits for in-flight requests to complete (with a timeout), and closes the database pool cleanly before exiting. This prevents data corruption during deployments.

**Effort**: 0.5 days

---

#### 4.3 Environment Variable Validation on Startup

Add a startup check that validates all required environment variables (`DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SESSION_SECRET`) are present before the server accepts any traffic. Fail fast with a clear error if any are missing.

**Effort**: 0.5 days

---

#### 4.4 Security Headers

Add `helmet` middleware to set standard HTTP security headers: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`. These are table-stakes for any publicly accessible web application.

**Effort**: 0.5 days

---

#### 4.5 Automated Dependency Audits

Add `npm audit` to the CI pipeline to catch known vulnerabilities in dependencies before deployment. Configure Dependabot or Renovate for automated dependency update PRs.

**Effort**: 0.5 days (configuration only)

---

#### 4.6 Performance Monitoring for AI Calls

Track AI provider response times per request, log slow responses (>10 seconds) at WARN level, and expose a simple dashboard in the Admin Console showing average response times by provider over the last 24 hours. This surfaces provider degradation before users notice it.

**Effort**: 1 day

---

## Score After Each Priority Group

| After completing... | Projected score |
|---|---|
| Current state | 67/100 |
| Priority 1 (billing, rate limiting) | 76/100 |
| Priority 2 (artifacts, logging, integration tests) | 84/100 |
| Priority 3 (E2E tests, multi-instance, CSRF, sanitisation) | 92/100 |
| Priority 4 (all polish items) | 98/100 |

The remaining 2 points represent operational maturity that only comes with production runtime data: load testing under real traffic patterns, tuning connection pool sizes based on observed behaviour, and refining alert thresholds based on actual baseline metrics. These cannot be specified in advance — they require the platform to be running in production first.

---

## Summary

Plan2Prompt has a sophisticated, well-designed core. The pipeline enforcement, AI consensus layer, clarification contracts system, and execution integrity controls are all genuinely production-grade thinking. The platform is let down by operational gaps that are standard engineering work rather than hard problems: moving two in-memory stores to PostgreSQL, adding a logging library, and wrapping AI routes in rate limiters. None of these require architectural changes.

The roadmap above can realistically be completed in three to four weeks of focused engineering effort, at which point the platform would be operationally ready for paying users at scale.

---

*© 2026 MTE Software Ltd. All rights reserved.*
