# Plan2Prompt — Feature & Functionality Gap Assessment

**Version 1.0.5 | MTE Software Ltd**
**Assessment Date: February 2026**

---

## Methodology

This assessment was conducted by reading every source file in the platform: all routes, services, shared types, frontend pages, and components. Gaps are based on verified code evidence — not assumptions. Each gap is rated by:

- **User Impact**: who is affected and how
- **Severity**: Critical / High / Medium / Low
- **Effort**: Hours / Days / Weeks

---

## A. Pipeline Gaps

### A1. Build Prompts Count on Dashboard is Hardcoded to Zero

**Evidence**: `client/src/pages/home.tsx` line 63: `count: 0` for the Build Prompts pipeline card. The count never updates regardless of how many prompt artifacts exist.

**User Impact**: Users cannot see at a glance how many prompt sets have been generated. The dashboard stat is incorrect.

**Severity**: Medium
**Effort**: 1–2 hours — add a query to `/api/prompts` and wire the count.

---

### A2. No Way to Delete a Project

**Evidence**: `server/routes/project.routes.ts` exposes GET (list), POST (create), PUT (rename), but no DELETE endpoint. The `ProjectSwitcher` UI has no delete option.

**User Impact**: Users accumulate projects with no way to remove test projects, abandoned ideas, or duplicates. Over time the project switcher becomes cluttered.

**Severity**: Medium
**Effort**: 1 day — add DELETE route with cascade handling, add confirmation dialog in UI.

---

### A3. No Cross-Idea Pipeline Navigation

**Evidence**: The dashboard links to module pages (Ideas, Requirements, Prompts) but does not show which specific idea is at which pipeline stage. There is no per-idea pipeline progress view.

**User Impact**: Users with more than one idea cannot tell at a glance which idea is ready for requirements generation and which is not. They must navigate into each module separately.

**Severity**: Medium
**Effort**: 2–3 days — add a per-idea pipeline status view to the dashboard.

---

### A4. Requirements and Prompts Modules Have No Link Back to Source Idea

**Evidence**: The Requirements and Prompts pages render their content but include no "View Source Idea" link or breadcrumb connecting back to the originating idea artifact.

**User Impact**: Users lose context when reviewing requirements — they cannot quickly return to the idea analysis that generated them.

**Severity**: Low
**Effort**: Half a day — add a link from requirements/prompts back to the source idea.

---

## B. Ideas Module Gaps

### B1. Ideas Cannot Be Edited After Submission

**Evidence**: The ideas form submits and displays results. If the result is accepted, there is no way to edit the original title, description, or context fields. The only option is to discard the idea and start over.

**User Impact**: If a user accepts an idea and later realises the title is wrong or the description needs a small update, they must re-run the entire analysis. This is wasteful — a single analysis call can cost significant AI tokens.

**Severity**: High
**Effort**: 1–2 days — add an edit mode that updates idea metadata without re-triggering analysis.

---

### B2. Workshop Can Only Be Run Once Per Idea

**Evidence**: The workshop flow runs once, producing a refined analysis. There is no mechanism to run a second round of workshop questions on the refined analysis. Once workshop answers are submitted, the only options are accept or discard.

**User Impact**: Users who want to iterate through multiple refinement rounds (e.g., address commercial risks in round 1, then technical risks in round 2) cannot do so. They would need to discard and start again.

**Severity**: Medium
**Effort**: 2–3 days — support iterative workshop rounds by threading refined analyses back into the workshop.

---

### B3. No Idea Archiving — Only Discard

**Evidence**: The only non-accept outcome from an analysis is "Discard", which permanently removes the analysis. There is no archive or soft-delete.

**User Impact**: A `stop` recommendation is valuable institutional knowledge — it records why an idea was rejected. Discarding it loses that record permanently.

**Severity**: Medium
**Effort**: 1 day — add archive status to ideas; archived ideas are hidden by default but can be reviewed.

---

### B4. Signal Sharpening Fields Not Rendered in Full

**Evidence**: The `IdeaAnalysis` type includes `confidenceAssessment`, `primaryRiskDrivers`, `scopeWarnings`, `assumptionDependencies`, and `failureModeNarrative`. Reviewing `ideas.tsx`, these fields are not visibly rendered in the current analysis results UI. Only the standard strengths/weaknesses/risks/profiles panels are shown.

**User Impact**: A significant portion of the AI analysis output is generated but never shown to the user. Risk drivers, scope warnings, assumption dependencies, and failure mode narratives are entirely hidden.

**Severity**: High
**Effort**: 2–3 days — add UI panels for each signal sharpening field.

---

### B5. No Side-by-Side Idea Comparison

**Evidence**: No comparison view exists for evaluating two ideas within the same project.

**User Impact**: Teams validating multiple ideas for the same product area cannot compare them systematically. They must navigate between separate idea views and compare manually.

**Severity**: Low
**Effort**: 2–3 days — add a comparison view that renders two `IdeaAnalysis` results side by side.

---

### B6. Research Brief Not Shown to User

**Evidence**: The `ResearchService` generates a research brief before analysis. This brief is injected into the AI prompt but is never surfaced to the user. Users have no visibility into what competitive/regulatory context the AI was working with.

**User Impact**: Users cannot review or correct the research brief if it contains inaccurate assumptions about the market or regulatory environment. This can silently skew the entire analysis.

**Severity**: Medium
**Effort**: 1 day — add a collapsible "Research Context" panel on the idea analysis page.

---

## C. Requirements Module Gaps

### C1. Requirements Cannot Be Manually Edited

**Evidence**: Requirements are AI-generated and rendered read-only. There is no editing interface for individual Functional Requirements, NFRs, or Architecture Decisions.

**User Impact**: If the AI misses a requirement or phrases one incorrectly, the user must regenerate the entire document. There is no way to add a missing requirement, edit a description, or remove an irrelevant entry without a full re-run.

**Severity**: High
**Effort**: 3–4 days — add inline editing for individual requirements with change tracking.

---

### C2. No Requirements Prioritisation Interface

**Evidence**: Functional Requirements are assigned priority values by AI (`high`, `medium`, `low`) but there is no UI for users to adjust these priorities.

**User Impact**: The priority assignment directly influences which requirements get dedicated prompt steps vs. which are grouped together. If AI assigns wrong priorities, the resulting build plan will be structured incorrectly, but the user cannot correct it.

**Severity**: High
**Effort**: 1–2 days — add drag-or-select priority controls per requirement.

---

### C3. No Requirements Export or Download

**Evidence**: The pipeline stage definition for `LOCKED_REQUIREMENTS` lists `"view"` and `"regenerate"` as allowed actions. There is no download action implemented for requirements artifacts in the UI.

**User Impact**: Users who want to share requirements with a client or team member outside the platform cannot do so without manually copying the rendered content.

**Severity**: Medium
**Effort**: 1 day — add a download button that serves the Markdown artifact file.

---

## D. Prompts Module Gaps

### D1. No Prompt Download Button Despite Being Defined as an Allowed Action

**Evidence**: `shared/types/pipeline.ts` `PROMPTS_GENERATED.allowedActions` includes `"download"`. No download button exists in the prompts UI.

**User Impact**: Users cannot save their build prompts to a local file. They can only copy individual steps or view the artifact preview.

**Severity**: Medium
**Effort**: Half a day — add a download button wired to the artifact file endpoint.

---

### D2. IDE Cannot Be Changed Without Full Regeneration

**Evidence**: Once prompts are generated for a specific IDE, changing the IDE requires full regeneration. There is no "re-format for different IDE" option that preserves the existing step content while only changing formatting.

**User Impact**: A user who generated prompts for Cursor and then decides to use Replit must spend AI tokens on a full re-run, even though the step content is the same.

**Severity**: Medium
**Effort**: 2–3 days — separate the formatting layer from generation so IDE re-formatting is a local-only transformation.

---

### D3. Step Content Cannot Be Edited

**Evidence**: Like requirements, generated prompt steps are read-only. There is no inline editing for step titles or prompt bodies.

**User Impact**: If a generated step has an incorrect instruction or misses a detail, the user must regenerate all prompts. They cannot tweak a single step.

**Severity**: High
**Effort**: 2–3 days — add inline step editing with change tracking and a flag that the step was manually modified.

---

### D4. No Prompt Step Notes or Annotations

**Evidence**: There is no mechanism for users to attach notes or annotations to individual steps during execution.

**User Impact**: Users working through a build cannot record decisions, deviations, or contextual notes alongside individual steps. This information is lost.

**Severity**: Low
**Effort**: 1 day — add a notes field per step in the execution session.

---

## E. Execution Module Gaps

### E1. Failure Output Is Not Stored

**Evidence**: `execution.routes.ts` hashes the failure output via SHA256 but does not store the raw failure text. Only the hash is persisted.

**User Impact**: Users cannot review what the actual failure output was for previous attempts on a step. The clarification contract references a hash but cannot show the original error message.

**Severity**: High
**Effort**: Half a day — add a `lastFailureOutput` text column to `execution_steps` and store the raw output (truncated to a safe length, e.g., 2,000 characters).

---

### E2. No Way to Abandon a Session

**Evidence**: Sessions can have status `active`, `blocked`, or `completed`. There is no `abandoned` status and no UI action to explicitly close a session without completing it.

**User Impact**: Users who decide mid-execution that the plan needs to be regenerated from scratch have no way to mark the session as done. They are left with a perpetually `active` session they cannot clear.

**Severity**: Medium
**Effort**: Half a day — add abandoned status, an "Abandon Session" button with confirmation, and handle the state in the UI.

---

### E3. No Session History View

**Evidence**: The execution route `GET /api/execution/sessions/artifact/:artifactId` only returns the active session. Completed and abandoned sessions cannot be reviewed.

**User Impact**: Users cannot look back at a completed execution session to review which steps failed, how many attempts they took, or what the final state was. Once a session is completed, the history is effectively inaccessible from the UI.

**Severity**: Medium
**Effort**: 1 day — add a `GET /api/execution/sessions` endpoint listing all sessions for a project, with a history view in the UI.

---

### E4. No Step Time Tracking

**Evidence**: Execution steps have no `startedAt` or `completedAt` timestamps. Duration per step is not recorded.

**User Impact**: Users and admins have no visibility into how long each step takes in practice. This data would be valuable for improving MVP effort estimates in idea analysis.

**Severity**: Low
**Effort**: Half a day — add `startedAt` and `completedAt` timestamps to execution steps.

---

### E5. Execution Progress Not Visible on Dashboard

**Evidence**: The dashboard shows idea count, requirements count, and build prompts count (hardcoded to 0), but has no execution progress indicator. A user mid-execution cannot see their progress from the dashboard.

**User Impact**: Users must navigate to the Prompts page to check execution progress. There is no at-a-glance status.

**Severity**: Low
**Effort**: 1 day — add an execution progress card to the dashboard when an active session exists.

---

## F. Clarification System Gaps

### F1. Resolving a Contract Does Not Trigger Upstream Re-generation

**Evidence**: `clarification.routes.ts` marks a contract as resolved and stores resolution data. However, there is no mechanism to automatically (or even prompt the user to) regenerate the upstream artifact using the resolution data.

**User Impact**: Resolving a clarification contract does nothing beyond marking it resolved in the UI. The underlying issue — the gap in requirements or the flawed prompt step — remains until the user manually navigates to the appropriate module and triggers regeneration.

**Severity**: High
**Effort**: 2 days — after resolution, prompt the user with a "Regenerate [Requirements/Prompts]" call to action that pre-fills context from the resolution data.

---

### F2. No Email or In-App Notification for Blocker Contracts

**Evidence**: Clarification contracts appear in the `ClarificationPanel` component on the Prompts page. There are no notifications (in-app bell, email, or push) when a new blocker contract is created.

**User Impact**: A user who closes the browser after starting an execution session will not know a blocker clarification was raised until they return and navigate back to the Prompts page.

**Severity**: Medium
**Effort**: 2–3 days for in-app notification system; 3–4 days to add email notifications.

---

### F3. No Clarification Summary on Dashboard

**Evidence**: Pending blocker clarifications are not surfaced on the dashboard. Users must navigate to the Prompts page to discover them.

**User Impact**: Users who have active blockers may not realise the pipeline is stuck until they happen to visit the right page.

**Severity**: Medium
**Effort**: 1 day — add a "Pending Blockers" warning card to the dashboard when unresolved blocker contracts exist.

---

## G. Admin Console Gaps

### G1. No Plan Assignment UI

**Evidence**: The `BillingService` has a `setUserPlan()` method but there is no UI in the Admin Console for admins to assign or change a user's billing plan. Admins cannot move a user from Free to Pro from the interface.

**User Impact**: Plan management requires direct database access. This is not viable for a production system where admins need to manage paying customers.

**Severity**: Critical
**Effort**: 1 day — add plan assignment controls to the Users tab in the Admin Console.

---

### G2. No Project-Level Admin View

**Evidence**: The Admin Console shows user management but has no view of all projects across all users. Admins cannot see how many projects a user has, what stage each project is at, or whether any projects have been inactive for a long time.

**User Impact**: Admins have no operational visibility into platform usage at the project level — only user counts and generation totals.

**Severity**: Medium
**Effort**: 2 days — add a Projects tab to the Admin Console.

---

### G3. No Ability to Impersonate or View a User's Project

**Evidence**: There is no admin "view as user" or "access project" mechanism.

**User Impact**: When a user reports a problem, the admin must ask the user for artifact IDs, session IDs, and clarification contract details rather than being able to inspect the project directly.

**Severity**: Medium
**Effort**: 2–3 days — add read-only admin project access.

---

### G4. Audit Log Has No Filtering or Search

**Evidence**: The audit log endpoint returns all entries. There is no date range filter, action type filter, or actor search.

**User Impact**: In a production system with many admin actions, the audit log becomes unusable without filtering. Finding a specific action requires scanning the full log.

**Severity**: Medium
**Effort**: 1 day — add filter parameters to the audit log endpoint and filter controls to the Admin Console UI.

---

## H. User Account Gaps

### H1. No Password Reset for Local Auth Users

**Evidence**: The auth page has login and registration. There is no "Forgot Password" link, no password reset endpoint, and no token-based reset flow.

**User Impact**: Any local auth user who forgets their password has no self-service recovery path. They would need admin intervention to regain access.

**Severity**: Critical
**Effort**: 2 days — add password reset flow with email link and token-based verification.

---

### H2. No Account Settings Page

**Evidence**: There is no account settings or profile page in the application. Users cannot change their display name, email address, or password after registration.

**User Impact**: Users are locked into the credentials they registered with. This is not acceptable for a production application.

**Severity**: High
**Effort**: 1–2 days — add an account settings page with password change (for local auth) and display name editing.

---

### H3. No Team or Collaboration Features

**Evidence**: Projects are single-owner. There is no concept of project members, shared access, or invitations.

**User Impact**: The platform cannot be used collaboratively. Agencies or teams cannot work on the same project together.

**Severity**: Medium (for v1), High (for growth)
**Effort**: 1–2 weeks — requires project members table, invitation system, and role-based project permissions.

---

## I. Billing and Plans Gaps

### I1. No Payment Integration

**Evidence**: The billing system tracks plans and usage but has no payment processing. There is no Stripe integration, no checkout flow, and no way for users to upgrade their plan from within the application.

**User Impact**: The billing tiers exist (Free, Pro, Team) but are entirely decorative — users cannot actually pay to upgrade. Plan assignment requires admin database access.

**Severity**: Critical
**Effort**: 1–2 weeks — integrate Stripe (Checkout, Customer Portal, Webhooks for subscription events).

---

### I2. No Invoice or Receipt History

**Evidence**: No invoice or payment history UI exists anywhere in the application.

**User Impact**: Users who do pay (if payment is added) would have no way to access receipts or invoices from within the platform.

**Severity**: Medium
**Effort**: 1 day (if Stripe integration exists — Stripe Customer Portal provides this automatically).

---

### I3. No Usage History or Trend View for Users

**Evidence**: The `BillingStatus` component shows current month usage. There is no historical usage chart or trend view.

**User Impact**: Users cannot see how their usage has grown over time or anticipate when they might need to upgrade.

**Severity**: Low
**Effort**: 2 days — add monthly usage history to the billing schema and a chart component.

---

## J. API and Integration Gaps

### J1. No Webhook Support

**Evidence**: There are no webhook endpoints or event dispatch mechanisms anywhere in the codebase.

**User Impact**: External systems (CI/CD pipelines, Slack, Notion, project management tools) cannot be notified when pipeline events occur (idea validated, requirements generated, execution completed).

**Severity**: Medium
**Effort**: 3–4 days — add webhook registration, event dispatch, and delivery retry logic.

---

### J2. No Public API for Programmatic Access

**Evidence**: All API routes are session-authenticated and designed for browser consumption only. There are no API keys, no public API documentation, and no programmatic access model.

**User Impact**: Teams that want to trigger Plan2Prompt analyses from their own tooling (e.g., as part of a sprint planning process) cannot do so.

**Severity**: Low (for v1), High (for enterprise)
**Effort**: 1–2 weeks — API key management, token authentication middleware, public API documentation.

---

### J3. No Import from External Sources

**Evidence**: Ideas can only be created by filling in the platform's form. There is no way to import an existing idea brief, PRD, or specification from a document.

**User Impact**: Users who already have a concept written up in Notion, Google Docs, or a PDF cannot feed it directly into the platform.

**Severity**: Low
**Effort**: 2–3 days — add a "paste or import text" option on the idea submission form.

---

## K. UX and Navigation Gaps

### K1. No Search Across Ideas, Requirements, or Prompts

**Evidence**: There is no search functionality anywhere in the application.

**User Impact**: Users with many ideas or multiple projects cannot find content without manually browsing through each module.

**Severity**: Medium
**Effort**: 2–3 days — add a global search over idea titles, requirement descriptions, and prompt step titles.

---

### K2. No Empty States for Requirements and Prompts

**Evidence**: When a user navigates to Requirements or Prompts before generating anything, the pages likely render empty content or a basic message. There are no illustrated empty states with clear CTAs guiding the user to the next action.

**User Impact**: New users who navigate to these pages early can feel lost. Strong empty states with contextual guidance significantly improve completion rates.

**Severity**: Medium
**Effort**: 1 day — add empty state components with clear CTAs and context.

---

### K3. No In-App Help or Contextual Documentation

**Evidence**: There are no help tooltips, guidance panels, or links to documentation anywhere in the platform.

**User Impact**: First-time users who do not understand what "consensus confidence" or "integrity level" means have no in-app reference. The platform uses specialised terminology without explanation.

**Severity**: Medium
**Effort**: 2–3 days — add help tooltips (using shadcn Tooltip) on key terms and info icons next to complex concepts.

---

### K4. No Loading States for Idea Count on Dashboard

**Evidence**: The dashboard pipeline cards use `ideaCount` and `reqCount` from queries, but there are no skeleton/loading states shown while these load. The counts may briefly show `0` before data arrives.

**User Impact**: Minor visual flicker on page load. Less significant but contributes to a polished feel.

**Severity**: Low
**Effort**: Half a day — add skeleton loading states to the stat cards.

---

### K5. No Confirmation Before Discarding an Analysis

**Evidence**: The "Discard" button on the analysis results appears to immediately destroy the analysis result. Looking at the flow, there is an `AlertDialog` in the code, but the discard action permanently removes the analysis without any recovery option.

**User Impact**: A misclick on "Discard" permanently loses an AI analysis that cost tokens to generate and may have taken 30+ seconds to produce.

**Severity**: Medium
**Effort**: Half a day — verify the AlertDialog is properly wired; add archive as an alternative to permanent deletion.

---

## L. Security Gaps (Beyond Infrastructure)

### L1. No Email Verification for Local Auth Registration

**Evidence**: Local auth registration creates an account immediately without verifying the email address is real or owned by the registrant.

**User Impact**: Fake accounts can be created with any email address. This enables abuse, impersonation, and makes password reset (when added) unsafe.

**Severity**: High
**Effort**: 1–2 days — add email verification token flow at registration.

---

### L2. No Session Timeout or Idle Session Expiry

**Evidence**: Sessions are PostgreSQL-backed but there is no configured idle timeout or maximum session lifetime visible in the codebase.

**User Impact**: A user who leaves a browser tab open indefinitely remains authenticated with no expiry. This is a security risk on shared or public machines.

**Severity**: Medium
**Effort**: Half a day — configure `maxAge` and `rolling` options on the session middleware.

---

### L3. No Account Lockout After Failed Login Attempts

**Evidence**: The local auth login route does not implement any rate limiting or lockout after repeated failed attempts.

**User Impact**: Brute-force attacks against local auth accounts are possible.

**Severity**: High
**Effort**: Half a day — add login attempt tracking and temporary lockout after 5 consecutive failures.

---

## M. Missing Platform Features

### M1. No Notifications System

**Evidence**: The platform has no notifications system — no in-app notification bell, no email notifications, and no notification preferences.

**User Impact**: Users are not informed of important pipeline events unless they are actively viewing the relevant page. This is a foundational gap for any platform with async operations.

**Severity**: High
**Effort**: 3–5 days — add a notifications table, an in-app notification bell with unread count, and email delivery for critical events.

---

### M2. No Saved Templates or Reusable Idea Contexts

**Evidence**: There is no template or context library. Users who frequently analyse similar types of ideas (e.g., always SaaS commercial products with a specific team size and budget) must re-enter the same context fields every time.

**User Impact**: Repetitive data entry for power users. Reduces the platform's efficiency for frequent users.

**Severity**: Low
**Effort**: 1–2 days — add a "save as template" option that preserves context fields for reuse.

---

### M3. No Onboarding Tutorial or Guided Tour

**Evidence**: The onboarding modal asks for a project name. After that, there is no guided tour of the platform's features.

**User Impact**: New users who are not already familiar with the platform from the landing page may not understand what to do after creating their first project.

**Severity**: Medium
**Effort**: 2 days — add a step-by-step guided tour using a library like `react-joyride`.

---

### M4. No Activity Feed or Project Timeline

**Evidence**: There is no timeline view showing when artifacts were created, when ideas were validated, when requirements were generated, etc.

**User Impact**: Users and admins cannot see the history of activity on a project. This is particularly valuable for team use cases.

**Severity**: Low
**Effort**: 2 days — add an activity log table and a timeline panel on the project dashboard.

---

### M5. No Dark/Light Mode Preference Saved to Account

**Evidence**: Theme preference is stored in `localStorage`. It is device-specific and lost if the user clears their browser or switches devices.

**User Impact**: Minor inconvenience — users must set their theme preference again on each new device.

**Severity**: Low
**Effort**: Half a day — persist theme preference to the users table and load it on login.

---

## Prioritised Backlog — Top 15 Gaps to Close First

Ranked by combined severity and user impact:

| # | Gap | Severity | Effort |
|---|---|---|---|
| 1 | **I1** — No payment integration (Stripe) | Critical | 1–2 weeks |
| 2 | **G1** — No plan assignment UI in Admin Console | Critical | 1 day |
| 3 | **H1** — No password reset for local auth users | Critical | 2 days |
| 4 | **F1** — Resolving a clarification does not trigger upstream regeneration | High | 2 days |
| 5 | **E1** — Failure output not stored (only hash retained) | High | Half a day |
| 6 | **B4** — Signal sharpening fields not rendered (hidden AI output) | High | 2–3 days |
| 7 | **C1** — Requirements cannot be manually edited | High | 3–4 days |
| 8 | **C2** — No requirements prioritisation interface | High | 1–2 days |
| 9 | **D3** — Prompt step content cannot be edited | High | 2–3 days |
| 10 | **H2** — No account settings page | High | 1–2 days |
| 11 | **L1** — No email verification at registration | High | 1–2 days |
| 12 | **L3** — No account lockout after failed login attempts | High | Half a day |
| 13 | **M1** — No notifications system | High | 3–5 days |
| 14 | **B1** — Ideas cannot be edited after submission | High | 1–2 days |
| 15 | **A1** — Build prompts count hardcoded to zero on dashboard | Medium | 1–2 hours |

---

## Summary

| Category | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Pipeline | 0 | 0 | 3 | 1 | 4 |
| Ideas Module | 0 | 2 | 2 | 2 | 6 |
| Requirements Module | 0 | 2 | 1 | 0 | 3 |
| Prompts Module | 0 | 1 | 2 | 1 | 4 |
| Execution Module | 0 | 1 | 2 | 2 | 5 |
| Clarification System | 0 | 1 | 2 | 0 | 3 |
| Admin Console | 0 | 0 | 3 | 1 | 4 |
| User Account | 1 | 1 | 1 | 0 | 3 |
| Billing and Plans | 1 | 0 | 1 | 1 | 3 |
| API and Integrations | 0 | 0 | 1 | 2 | 3 |
| UX and Navigation | 0 | 0 | 3 | 2 | 5 |
| Security | 0 | 2 | 1 | 0 | 3 |
| Missing Platform Features | 0 | 1 | 2 | 2 | 5 |
| **Total** | **2** | **11** | **24** | **14** | **51** |

**51 identified gaps across 13 categories.** The 2 critical and 11 high severity gaps represent the clearest path to a complete, shippable v1.0 product. The 24 medium severity gaps represent the difference between a functional product and a polished one. The 14 low severity gaps are quality-of-life improvements for future iterations.

---

*© 2026 MTE Software Ltd. All rights reserved.*
