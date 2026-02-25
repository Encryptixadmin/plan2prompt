# Plan2Prompt — Platform Analysis

**Version 1.0.5 | MTE Software Ltd**
**Date: February 2026**
**Prepared for: Internal Review**

---

## Executive Overview

Plan2Prompt is a well-architected AI-powered build planning platform with a sophisticated product design. The pipeline enforcement model, multi-provider AI consensus, clarification contracts system, and execution integrity controls are all genuinely production-grade. The platform has strong bones.

What follows is a complete, honest assessment across two dimensions:

1. **Operational Readiness** — is the platform safe to run in production at scale?
2. **Feature Completeness** — does the platform have the features a real product of this type needs?

The conclusion is that the platform is a strong v0.8 rather than a true v1.0. The gaps are real but well-defined, and none require architectural changes. They are engineering work, not redesign work.

---

## Part 1 — Operational Readiness

### Overall Score: 67 / 100

---

### 1.1 Dimension Scores

| Dimension | Score | Notes |
|---|---|---|
| Pipeline architecture and enforcement | 9/10 | Stage gating enforced at both frontend and backend independently |
| AI integration layer | 8/10 | ConsensusService with retry, health checks, and usage tracking |
| Type safety and shared contracts | 8/10 | TypeScript throughout, Zod at API boundaries, shared `@shared/*` types |
| Invariant test coverage | 8/10 | 224 tests covering pipeline, integrity, traceability, escalation, delta |
| Authentication (dual-mode, session store) | 7/10 | Replit OAuth + local email/password; PostgreSQL-backed sessions |
| Security model | 7/10 | Database-driven admin, bcrypt, project isolation via `X-Project-Id` |
| Clarification contracts system | 7/10 | SHA256 de-duplication, upward-only escalation, severity rules |
| Execution integrity controls | 7/10 | Deterministic keyword classification, re-run enforcement, success hashes |
| Artifact storage (filesystem) | 5/10 | Not compatible with multi-instance or ephemeral deployment |
| Integration and E2E test coverage | 5/10 | No HTTP-level or browser-level tests |
| Scalability | 5/10 | Single-instance assumption throughout |
| AI cost protection and rate limiting | 4/10 | No HTTP-level rate limiting; billing limits reset on restart |
| Observability and error monitoring | 4/10 | No structured logging, no APM, no error monitoring |
| Billing persistence | 3/10 | In-memory JavaScript Maps — resets on every server restart |

---

### 1.2 Critical Operational Gaps

#### Billing is In-Memory

The `BillingService` stores user plan assignments and monthly usage in JavaScript `Map` objects in process memory. Every server restart — whether from a deployment, crash, or idle timeout — resets all billing state to zero:

- All plan assignments revert to `free`
- All monthly generation and token counts reset to zero
- Rate limiting and usage enforcement become ineffective
- A malicious user can reset their limits by triggering a restart

**Fix**: Migrate `BillingService` to PostgreSQL — add `user_plans` and `usage_records` tables. Estimated: 1–2 days.

---

#### Artifact Storage is on the Local Filesystem

All ideas, requirements, and prompts are written as Markdown files to `artifacts/` on the server's local disk. This means:

- A second server instance has no access to files written by the first
- Ephemeral cloud hosting environments don't guarantee persistent disk
- A crash mid-write can produce partially written artifacts
- Backups require separate procedures outside the database

**Fix**: Move artifact content to a `text` column in PostgreSQL. The existing file format (Markdown with YAML frontmatter) can be stored verbatim. Estimated: 2–3 days.

---

#### No Rate Limiting on AI Generation Routes

The three AI generation endpoints (`/api/ideas/analyze`, `/api/requirements/generate`, `/api/prompts/generate`) have soft billing limits that are stored in-memory (reset on restart) and no HTTP-level rate limiting. A single user or script can trigger unlimited parallel generation requests, incurring significant OpenAI, Anthropic, and Gemini API costs.

**Fix**: Add `express-rate-limit` middleware to generation routes — 5 requests per minute per user. Estimated: 1 day.

---

#### No Observability Stack

The platform has no structured logging, no APM integration, no error tracking service, and no alerting. If something fails silently in production — a provider returning malformed JSON, a database query timing out, an unexpected process exit — there is no mechanism to detect it without a user reporting it.

**Fix**: Add `pino` for structured logging and Sentry for error capture. Estimated: 1–2 days.

---

### 1.3 Operational Roadmap to 100/100

| Priority | Work | Score After |
|---|---|---|
| Current | — | 67/100 |
| 1 — Critical | Persist billing to PostgreSQL; add rate limiting on AI routes | 76/100 |
| 2 — High | Move artifacts to database; add structured logging + Sentry; add integration tests | 84/100 |
| 3 — Medium | E2E browser tests; multi-instance readiness audit; CSRF protection; input sanitisation | 92/100 |
| 4 — Polish | Security headers (helmet); graceful shutdown; env validation on startup; dependency audits; AI performance monitoring | 98/100 |

The final 2 points come from operational data that can only be gathered after the platform is running in production — connection pool tuning, alert threshold calibration, load test results.

---

## Part 2 — Feature Completeness

### Overview: 51 Gaps Identified

| Severity | Count | Meaning |
|---|---|---|
| Critical | 2 | Must be resolved before any paid users |
| High | 11 | Must be resolved before v1.0 launch |
| Medium | 24 | Needed for a polished, competitive product |
| Low | 14 | Quality-of-life improvements for future iterations |

---

### 2.1 Pipeline Gaps (4 total)

#### [A1] Build Prompts Count Hardcoded to Zero — Medium — 2 hours

`client/src/pages/home.tsx` line 63 sets the Build Prompts count to `0` permanently. The dashboard stat never updates regardless of how many prompt artifacts exist. Fix: query `/api/prompts` and wire the result to the count.

---

#### [A2] No Project Deletion — Medium — 1 day

The project routes expose GET, POST, and PUT but no DELETE. Users accumulate projects with no way to remove test or abandoned ones. Fix: add a DELETE endpoint with cascade handling and a confirmation dialog in the UI.

---

#### [A3] No Per-Idea Pipeline Status on Dashboard — Medium — 2–3 days

The dashboard shows total idea and requirement counts but not which specific idea is at which pipeline stage. Users with more than one idea cannot see at a glance which is ready for requirements generation.

---

#### [A4] No Back-Link from Requirements/Prompts to Source Idea — Low — Half a day

The Requirements and Prompts pages have no "View Source Idea" link. Users lose context when reviewing generated documents.

---

### 2.2 Ideas Module Gaps (6 total)

#### [B1] Ideas Cannot Be Edited After Submission — High — 1–2 days

Once an analysis is accepted, the title, description, and context fields are locked. The only option to make corrections is to discard and re-run a full analysis, consuming AI tokens for what may be a minor text fix.

---

#### [B2] Workshop Can Only Be Run Once — Medium — 2–3 days

After one round of workshop refinement, there is no mechanism to run a second round. Users who want to address commercial risks in one session and technical risks in another cannot do so. They must discard and restart.

---

#### [B3] No Idea Archiving — Only Discard — Medium — 1 day

Ideas that receive a `stop` recommendation can only be permanently discarded. There is no archive or soft-delete. This loses valuable institutional knowledge about why certain ideas were rejected.

---

#### [B4] Signal Sharpening Fields Not Rendered — High — 2–3 days

The `IdeaAnalysis` type includes `confidenceAssessment`, `primaryRiskDrivers`, `scopeWarnings`, `assumptionDependencies`, and `failureModeNarrative`. These fields are populated by the AI during analysis but **none of them are rendered in the current UI**. A significant portion of the analysis output is generated and then silently discarded. Specifically missing:

- **Confidence Assessment**: score, rationale, key factors, and explicit limitations
- **Primary Risk Drivers**: ranked by impact with failure triggers and controllability ratings
- **Scope Warnings**: hidden complexity flags across technical, UX, compliance, and integration areas
- **Assumption Dependencies**: tracked assumptions with validation status and "risk if wrong" notes
- **Failure Mode Narrative**: a prose account of how the idea is most likely to fail

---

#### [B5] No Side-by-Side Idea Comparison — Low — 2–3 days

No comparison view exists for evaluating two ideas within the same project side by side.

---

#### [B6] Research Brief Not Shown to User — Medium — 1 day

The `ResearchService` generates a research brief covering competitors, regulations, and market signals before analysis. This brief is injected into the AI context but never shown to the user. If the brief contains inaccurate assumptions, the user has no way to know or correct them.

---

### 2.3 Requirements Module Gaps (3 total)

#### [C1] Requirements Cannot Be Manually Edited — High — 3–4 days

Requirements are rendered read-only. If the AI produces an incorrect or incomplete requirement, the only option is a full regeneration. There is no way to:
- Edit a requirement's description
- Add a missing requirement
- Remove an irrelevant one

This is a significant friction point because requirement quality directly determines the quality of the generated build prompts.

---

#### [C2] No Requirements Prioritisation Interface — High — 1–2 days

AI assigns `high`, `medium`, and `low` priority to Functional Requirements. Priority directly determines whether a requirement gets its own dedicated build step. Users cannot adjust these priorities even if the AI has misclassified them.

---

#### [C3] No Requirements Export — Medium — 1 day

The pipeline stage definition for `LOCKED_REQUIREMENTS` lists `"download"` as an allowed action, but no download button is implemented. Users who want to share requirements outside the platform must manually copy the rendered content.

---

### 2.4 Prompts Module Gaps (4 total)

#### [D1] No Prompt Download Button — Medium — Half a day

The pipeline type definition lists `"download"` as an allowed action for `PROMPTS_GENERATED`, but no download button exists. Users can only copy individual steps.

---

#### [D2] IDE Cannot Be Changed Without Full Regeneration — Medium — 2–3 days

Switching the target IDE after prompts are generated requires a full AI regeneration. Since IDE adaptation is a formatting-only layer that does not change step content, this is wasteful. A re-format should be a local transformation.

---

#### [D3] Prompt Step Content Cannot Be Edited — High — 2–3 days

Like requirements, generated prompt steps are read-only. If a step has an incorrect instruction or missing detail, the user must regenerate all prompts. There is no inline step editing.

---

#### [D4] No Step Notes or Annotations — Low — 1 day

Users working through a build cannot attach notes, decisions, or context to individual steps. This information is lost once the session ends.

---

### 2.5 Execution Module Gaps (5 total)

#### [E1] Failure Output Not Stored — High — Half a day

When a step fails, the platform hashes the failure output (SHA256) for comparison, but does not store the raw text. Users and admins cannot review what the actual error was for previous attempts. The clarification contract references a hash with no way to look up the original message.

**This is a quick win** — adding a `lastFailureOutput` text column (truncated to 2,000 characters) takes half a day and meaningfully improves debuggability.

---

#### [E2] No Way to Abandon a Session — Medium — Half a day

Sessions can be `active`, `blocked`, or `completed`. There is no `abandoned` status. Users who decide mid-execution to start fresh have no way to close the current session. They are left with a perpetually active session they cannot clear.

---

#### [E3] No Session History View — Medium — 1 day

The execution routes only return the current active session. Completed sessions cannot be reviewed after the fact. Users cannot look back at a finished execution to review failure counts, step durations, or escalation events.

---

#### [E4] No Step Time Tracking — Low — Half a day

Steps have no `startedAt` or `completedAt` timestamps. Actual execution duration per step is never recorded, even though this data would improve MVP effort estimates in idea analysis over time.

---

#### [E5] Execution Progress Not Visible on Dashboard — Low — 1 day

The dashboard has no execution progress indicator. A user mid-execution cannot see their progress from the dashboard — they must navigate to the Prompts page.

---

### 2.6 Clarification System Gaps (3 total)

#### [F1] Resolving a Contract Does Not Trigger Upstream Regeneration — High — 2 days

This is the most significant logical gap in the clarification system. When a user resolves a clarification contract, the platform marks it as resolved and stores the resolution data. **It does nothing else.** The underlying gap in requirements or the flawed prompt step remains until the user manually navigates to the appropriate module and triggers regeneration. The resolution data is stored but never used. The loop is not closed.

---

#### [F2] No Notifications for Blocker Contracts — Medium — 2–3 days

There are no notifications (in-app, email, or push) when a new blocker clarification contract is created. A user who leaves their browser after starting execution will not know the pipeline is stuck.

---

#### [F3] No Blocker Summary on Dashboard — Medium — 1 day

Pending blocker clarifications are not surfaced on the dashboard. Users must navigate to the Prompts page to discover them.

---

### 2.7 Admin Console Gaps (4 total)

#### [G1] No Plan Assignment UI — Critical — 1 day

The `BillingService` has a `setUserPlan()` method but there is no UI in the Admin Console to use it. Assigning or changing a user's billing plan requires direct database access. This is not viable for managing paying customers.

---

#### [G2] No Project-Level Admin View — Medium — 2 days

The Admin Console shows user management but has no view of projects across the platform. Admins cannot see how many projects a user has, what stage each is at, or whether projects have been inactive.

---

#### [G3] No Admin Project Access — Medium — 2–3 days

When a user reports a problem, the admin must ask the user to relay artifact IDs, session IDs, and clarification details rather than being able to inspect the project directly.

---

#### [G4] Audit Log Has No Filtering — Medium — 1 day

The audit log returns all entries with no date range, action type, or actor filter. In production with many admin actions, the log is unusable for finding a specific event.

---

### 2.8 User Account Gaps (3 total)

#### [H1] No Password Reset — Critical — 2 days

Local auth users who forget their password have no self-service recovery path. There is no "Forgot Password" flow, no reset endpoint, and no token-based email recovery. Admin intervention is the only option.

---

#### [H2] No Account Settings Page — High — 1–2 days

There is no profile or settings page. Users cannot change their display name, email, or password after registration. This is a standard feature expectation for any web application.

---

#### [H3] No Team Collaboration Features — Medium — 1–2 weeks

Projects are single-owner. There is no concept of project members, shared access, or invitations. The platform cannot be used collaboratively by a team.

---

### 2.9 Billing and Plans Gaps (3 total)

#### [I1] No Payment Integration — Critical — 1–2 weeks

The billing tiers (Free, Pro, Team) exist in the data model but there is no payment processing. No Stripe integration, no checkout flow, no subscription management. Plan assignment requires database access. The billing model is entirely decorative in the current version.

---

#### [I2] No Invoice or Receipt History — Medium — 1 day (once Stripe exists)

No invoice or payment history UI exists. Stripe Customer Portal provides this automatically once integrated.

---

#### [I3] No Usage History or Trend View — Low — 2 days

The billing status panel shows current month usage only. Users cannot see how their usage has changed over time.

---

### 2.10 API and Integration Gaps (3 total)

#### [J1] No Webhook Support — Medium — 3–4 days

There are no webhook endpoints or event dispatch mechanisms. External tools (CI/CD, Slack, Notion) cannot be notified when pipeline events occur.

---

#### [J2] No Public API for Programmatic Access — Low — 1–2 weeks

All API routes are session-authenticated and designed for browser use. There are no API keys, no machine-to-machine authentication, and no public API documentation.

---

#### [J3] No Import from External Documents — Low — 2–3 days

Ideas can only be created by filling in the submission form. Users with an existing concept document (Notion, Google Docs, PDF) cannot feed it directly into the platform.

---

### 2.11 UX and Navigation Gaps (5 total)

#### [K1] No Search — Medium — 2–3 days

There is no search functionality anywhere in the application. Users with many ideas or multiple projects cannot find content without manually browsing.

---

#### [K2] No Empty States for Requirements and Prompts — Medium — 1 day

When a user navigates to Requirements or Prompts before generating anything, there are no illustrated empty states with clear CTAs. First-time users can feel lost.

---

#### [K3] No In-App Help or Contextual Tooltips — Medium — 2–3 days

There are no help tooltips, guidance panels, or documentation links. The platform uses specialised terminology (consensus confidence, integrity level, clarification contract) without explanation.

---

#### [K4] No Loading Skeleton on Dashboard Stats — Low — Half a day

Dashboard stat cards briefly show `0` while data loads rather than a skeleton state. Minor but noticeable.

---

#### [K5] Discard Has No Alternative to Permanent Deletion — Medium — Half a day

Discarding an analysis permanently destroys it. A misclick on "Discard" loses an AI analysis that may have taken 30+ seconds and significant tokens to produce. There is no archive option as an alternative.

---

### 2.12 Security Gaps (3 total)

#### [L1] No Email Verification at Registration — High — 1–2 days

Local auth registration creates an account immediately without verifying the email address. Fake accounts can be created with any email, and password reset (once added) would be unsafe without verified email ownership.

---

#### [L2] No Session Timeout — Medium — Half a day

There is no configured idle timeout or maximum session lifetime. A user who leaves a browser tab open indefinitely remains authenticated. `maxAge` and `rolling` options should be set on the session middleware.

---

#### [L3] No Account Lockout After Failed Logins — High — Half a day

The login route does not rate-limit or lock accounts after repeated failed attempts. Brute-force attacks against local auth accounts are possible.

---

### 2.13 Missing Platform Features (5 total)

#### [M1] No Notifications System — High — 3–5 days

No in-app notification bell, no email notifications, and no notification preferences exist anywhere. Users are not informed of pipeline events unless they are actively viewing the relevant page. This is a foundational gap for any platform with async operations.

---

#### [M2] No Saved Templates or Reusable Contexts — Low — 1–2 days

Users who frequently analyse similar idea types must re-enter the same context fields every time. No template or context library exists.

---

#### [M3] No Onboarding Tutorial — Medium — 2 days

After creating a first project, there is no guided tour. Users unfamiliar with the platform may not understand the pipeline or where to start.

---

#### [M4] No Activity Feed or Project Timeline — Low — 2 days

There is no timeline showing when artifacts were created, ideas validated, requirements generated, etc. Project history is invisible.

---

#### [M5] Theme Preference Not Persisted to Account — Low — Half a day

Dark/light mode preference is stored in `localStorage` only. It is lost when a user clears their browser or switches devices.

---

## Part 3 — Combined Gap Summary

### By Severity

| Severity | Operational Gaps | Feature Gaps | Total |
|---|---|---|---|
| Critical | 2 | 2 | 4 |
| High | 3 | 11 | 14 |
| Medium | 4 | 24 | 28 |
| Low | 5 | 14 | 19 |
| **Total** | **14** | **51** | **65** |

---

### Prioritised Backlog — Top 20 Items

Items that should be addressed first, ranked by combined severity and user impact:

| # | ID | Gap | Type | Effort |
|---|---|---|---|---|
| 1 | I1 | No payment integration (Stripe) | Feature | 1–2 weeks |
| 2 | H1 | No password reset | Feature | 2 days |
| 3 | G1 | No plan assignment UI in Admin Console | Feature | 1 day |
| 4 | — | Persist billing to PostgreSQL | Operational | 1–2 days |
| 5 | — | Rate limit AI generation routes | Operational | 1 day |
| 6 | — | Move artifact storage to database | Operational | 2–3 days |
| 7 | E1 | Store failure output text (not just hash) | Feature | Half a day |
| 8 | B4 | Render signal sharpening fields (hidden AI output) | Feature | 2–3 days |
| 9 | F1 | Post-resolution regeneration prompt | Feature | 2 days |
| 10 | L1 | Email verification at registration | Feature | 1–2 days |
| 11 | L3 | Account lockout after failed logins | Feature | Half a day |
| 12 | M1 | In-app notifications system | Feature | 3–5 days |
| 13 | C1 | Manual editing of requirements | Feature | 3–4 days |
| 14 | C2 | Requirements prioritisation interface | Feature | 1–2 days |
| 15 | D3 | Inline prompt step editing | Feature | 2–3 days |
| 16 | H2 | Account settings page | Feature | 1–2 days |
| 17 | B1 | Edit idea after submission | Feature | 1–2 days |
| 18 | — | Add structured logging (pino) + Sentry | Operational | 1–2 days |
| 19 | A2 | Project deletion | Feature | 1 day |
| 20 | A1 | Fix hardcoded prompts count on dashboard | Feature | 2 hours |

---

## Part 4 — Effort and Timeline Estimate

Assuming a single focused developer:

| Phase | Items | Calendar Time |
|---|---|---|
| Phase 1 — Critical fixes (items 1–6 above) | Payment, password reset, billing DB, rate limiting, artifact DB | 3–4 weeks |
| Phase 2 — High severity features (items 7–16) | Notifications, editing, signal fields, resolution loop, account settings | 3–4 weeks |
| Phase 3 — Medium polish (remaining medium severity) | Session history, team features, search, export, empty states, admin views | 4–6 weeks |
| Phase 4 — Low priority and QoL | Templates, timeline, tooltips, theme persistence | 2–3 weeks |

**Estimated total to a complete, polished v1.0: 12–17 weeks of focused engineering.**

The platform today represents approximately 60–65% of a complete v1.0 product. The core pipeline logic is done and done well. What remains is the commercial plumbing (payments, accounts, team access) and product polish (editing, notifications, search, export).

---

## Part 5 — Strengths to Preserve

These aspects of the platform are well-designed and should not be changed as improvements are made:

- **Pipeline stage enforcement model** — the sequential gating and dual enforcement (frontend + backend) is exactly right
- **IAIProvider interface and ConsensusService** — the multi-provider abstraction is clean and extensible
- **Clarification contract schema** — the hash-based de-duplication, upward-only direction, and severity escalation model are solid; the resolution loop just needs closing
- **Execution integrity classification** — deterministic keyword scanning is the correct approach; do not replace with AI classification
- **Invariant test suite** — the 224 tests encoding behavioural contracts should be expanded, not replaced
- **Shared type contracts** — the `@shared/*` alias structure and Zod validation at boundaries is the right pattern

---

*© 2026 MTE Software Ltd. All rights reserved.*
