# Plan2Prompt MCP Server — Feature Specification

**Version 1.1 | MTE Software Ltd**
**Date: March 2026**
**Status: Implemented — see `plan2prompt-mcp-server-reference.md` for the full technical reference**

---

## Problem Statement

Plan2Prompt's execution flow has a manual gap at its centre. The platform generates structured, traceable build instructions — then the user copies them into their IDE and works through them by hand, switching between browser and editor to report progress, review failures, and resolve clarifications. Every step crossing is a copy-paste. The platform loses visibility the moment the user leaves the browser, and regains it only when they come back to click a button.

This friction directly undermines two of the platform's strongest design decisions: execution traceability and the clarification feedback loop. Both depend on real-time awareness of what's happening during the build. Today, that awareness is delayed and manual.

The people who feel this most are solo developers, founders, and prototyping leads — exactly the users Plan2Prompt is built for. They are deep in their IDE, building. Asking them to context-switch to a browser to advance a step counter is the kind of workflow tax that makes people stop using the tracking features altogether.

---

## Goals

1. **Eliminate the copy-paste gap.** IDE AI assistants pull build steps directly from Plan2Prompt. No browser tab needed during execution.

2. **Make execution traceability automatic.** Step completion, failure reporting, and session progression happen as natural byproducts of the developer working in their IDE — not as manual reporting tasks.

3. **Close the failure feedback loop in real time.** When a step fails, the IDE sends the error to Plan2Prompt's classifier and gets structured recovery steps back immediately, without the developer leaving their editor.

4. **Surface planning intelligence where it's needed.** The idea analysis, risk drivers, requirements, and assumption dependencies become live context available to the IDE's AI assistant while it's helping the developer build — not a report they read once and forget.

5. **Remove the need for IDE-specific prompt formatting.** The MCP server serves structured data. Each IDE client renders it however suits its agent model. The six hardcoded IDE format templates become unnecessary over time.

---

## Non-Goals

1. **Autonomous execution.** The MCP server does not execute code, trigger builds, or take actions in the developer's environment. It serves context and accepts reports. The platform's core principle — "Platform decides → AI assists → IDE executes → Platform judges" — applies without exception.

2. **Replacing the web UI.** The browser interface remains the primary experience for idea submission, analysis review, requirements generation, workshop refinement, and admin functions. The MCP server covers execution and context retrieval only.

3. **Building IDE plugins.** MCP is a protocol, not a plugin framework. Any MCP-compatible client can connect. We do not build or maintain IDE-specific extensions.

4. **Real-time collaboration.** This is a single-user execution tool. Multiple developers connected to the same project session is out of scope. Team features are a separate roadmap item.

5. **Bidirectional artefact mutation.** The IDE cannot modify ideas, requirements, or prompt steps through the MCP server. It can read them and report execution outcomes. Editing flows remain in the web UI.

---

## User Stories

### Solo Developer Executing a Build

As a solo developer working in Cursor (or Windsurf, Claude Code, VS Code, Replit, etc.), I want my IDE's AI assistant to know what build step I'm on, what the step requires, and what requirements it traces back to, so that I can stay in my editor and let the AI guide me through the build without switching to a browser.

As a solo developer whose build step just failed, I want the IDE to send the error output to Plan2Prompt and get back a classified failure pattern with recovery steps, so I can fix the issue immediately without manually copying errors between tabs.

As a solo developer who has just completed a step, I want the IDE to mark it done in Plan2Prompt automatically, so the execution session stays in sync and I can see my progress without opening the browser.

### Founder Reviewing Build Progress

As a non-technical founder who has planned a build in Plan2Prompt and handed the prompts to a developer, I want to see execution progress update in the web dashboard in real time as the developer works through steps in their IDE, so I have visibility without interrupting them.

### Prototyping Lead Managing Context

As a prototyping lead working through a complex build, I want my IDE's AI assistant to have access to the full requirements document, the risk drivers, and the assumption dependencies while it helps me code, so its suggestions are grounded in the actual plan rather than generic patterns.

---

## Requirements

### Must-Have (P0)

**MCP Server Foundation**

The platform exposes a Model Context Protocol server that any MCP-compatible client can connect to. The server authenticates using API keys (one key per user, generated in account settings). The server implements the MCP specification for tools and resources.

**Step Progression Tools**

The server exposes tools that allow the connected IDE to: retrieve the current active step (with full content, integrity level, traceability metadata, and requirements covered), mark the current step as complete (triggering success hash generation and session advancement), report a step failure (sending error output to the Classifier Service and returning the failure pattern, recovery steps, and retry/stop recommendation), and skip to a specific step (respecting sequential enforcement rules — the server rejects out-of-order requests).

**Context Resources**

The server exposes read-only resources that give the IDE's AI assistant access to: the full requirements document for the active project, the idea analysis including signal sharpening fields (confidence assessment, risk drivers, scope warnings, assumption dependencies, failure mode narrative), the list of all prompt steps with their content, integrity levels, and traceability links, and the current execution session state (progress, active step, failure history).

**Session Management**

The IDE can start a new execution session, resume an existing active session, and query session status. Session state is identical whether viewed from the MCP client or the web UI — both read and write the same database records.

**Failure Classification Integration**

When the IDE reports a step failure, the server runs the existing Classifier Service (deterministic pattern matching against the 12+ failure taxonomy) and returns the result. If the failure triggers escalation thresholds (3 cumulative failures, duplicate failure detection), the clarification contract is created automatically and the IDE is informed that the step is now blocked.

### Nice-to-Have (P1)

**Clarification Contract Handling**

The server exposes tools to: list active clarification contracts for the current project, retrieve the detail of a specific contract (including required clarifications with their expected answer types), and submit a resolution for a contract. This allows developers to resolve blockers without leaving their IDE for straightforward clarifications. Complex ones can still be handled in the web UI.

**Notifications via MCP**

When a clarification contract is created, escalated, or when a session is invalidated due to upstream artefact changes, the server pushes a notification to the connected client. This replaces the need for the developer to poll or check the browser.

**Progress Reporting**

The server exposes a resource showing overall execution progress: total steps, completed steps, failed steps, blocked steps, and estimated completion based on step complexity. This data is already computable from existing session/step records.

### Future Considerations (P2)

**Multi-Project Support**

Allow the IDE to switch between projects without reconnecting. The current design assumes one active project per connection.

**Webhook Bridge**

For IDEs or tools that don't natively support MCP but do support webhooks, expose a webhook adapter that translates MCP events into HTTP callbacks.

**Execution Analytics Feed**

Expose step timing data (once step time tracking is implemented) as a resource, enabling IDE-side dashboards or AI assistants that can estimate remaining build time.

**IDE Prompt Rendering**

Rather than serving pre-formatted prompt text, serve structured step data (title, body, requirements covered, constraints, integrity level) and let each IDE's client format it for their agent model. This replaces the six hardcoded IDE format templates with a single structured output.

---

## Technical Considerations

The MCP server should be a separate Express route namespace (e.g., `/mcp/`) within the existing backend, not a standalone service. It shares the same database, services, and business logic. Authentication uses API keys rather than session cookies, since IDE clients won't carry browser sessions.

The existing services — ClassifierService, ExecutionService, ClarificationService, ArtifactStorageService — already contain all the business logic needed. The MCP server is a thin transport layer that maps MCP tool calls to existing service methods. No business logic duplication.

The server must respect all existing constraints: pipeline stage enforcement, sequential step execution, integrity level controls, and the clarification escalation rules. The MCP transport does not bypass any of these. A request to complete step 5 when step 4 is incomplete must be rejected, regardless of whether it comes from the browser or the IDE.

API key management: add an `api_keys` table (userId, key, label, createdAt, lastUsedAt). Users generate and revoke keys from the account settings page. Keys are hashed (bcrypt or SHA256) before storage. Each request authenticates by passing the key in an `Authorization: Bearer` header.

---

## Success Metrics

**Leading indicators** (change within weeks of launch):

- MCP connection count — target: 30% of active users connect an IDE within the first month
- Steps completed via MCP vs. web UI — target: MCP accounts for 50%+ of step completions within 8 weeks
- Failure report submission rate — target: 80%+ of failures are reported via MCP (vs. ~40% estimated manual reporting rate today)

**Lagging indicators** (change over 1–3 months):

- Execution session completion rate — target: 15% increase (hypothesis: removing the copy-paste friction means more users finish their builds)
- Clarification contract resolution time — target: 30% reduction (hypothesis: IDE-side notifications and in-editor resolution reduce the time contracts sit unresolved)
- User retention at 30 days — target: 10% increase (hypothesis: deeper IDE integration makes the platform stickier)

---

## Open Questions

1. **MCP specification maturity** — MCP is relatively new. Which version of the spec should we target, and how do we handle clients that implement different spec versions? **(Engineering)**

2. **Rate limiting** — Should MCP tool calls share the same rate limits as the web UI, or have separate limits? A fast-moving IDE agent might hit step progression endpoints more frequently than a human clicking buttons. **(Engineering / Product)**

3. **Offline/disconnected behaviour** — What happens when the IDE loses connection mid-execution? Should the server support a reconciliation mechanism where the IDE can report a batch of step completions when it reconnects? **(Engineering)**

4. **API key vs. OAuth** — API keys are simpler but less secure for long-lived connections. Should we consider OAuth device flow for IDE authentication instead? **(Engineering / Security)**

5. **Pricing implications** — Does MCP access come with all plans, or is it a Pro/Team feature? It significantly increases the platform's value proposition, but also increases API surface and support burden. **(Product / Commercial)**

---

## Implementation Status

The MCP server has been built and is operational. The full technical reference, including all tools, resources, authentication, and IDE configuration examples, is documented in `plan2prompt-mcp-server-reference.md`.

**What shipped (P0 + partial P1):**

- 10 tools: 7 execution tools (start_session, get_session_status, get_current_step, complete_step, report_failure, skip_to_step, classify_failure) and 3 clarification tools (list_clarifications, get_clarification, resolve_clarification)
- 5 resources: project://requirements, project://idea-analysis, project://prompt-steps, project://session-state, project://execution-progress
- API key authentication with SHA-256 hashing, project isolation via X-Project-Id, key management UI in account settings
- Streamable HTTP transport
- Tested with Cursor and Claude Code

**Remaining from spec (P1/P2):**

- MCP-native notifications (push events for blocker creation, session invalidation, artefact changes)
- Multi-project support without reconnecting
- Webhook bridge for non-MCP tools
- Execution analytics feed (depends on step time tracking)
- Structured step data for IDE-side rendering (replacing hardcoded format templates)

The MCP server is Plan2Prompt's primary differentiator. While other tools generate prompts, none provide a live, bidirectional build orchestration layer that sits inside the developer's existing IDE. This is the feature that moves Plan2Prompt from "plan and copy-paste" to "plan and build."

---

*© 2026 MTE Software Ltd. All rights reserved.*
