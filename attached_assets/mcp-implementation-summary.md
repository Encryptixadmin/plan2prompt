# Plan2Prompt MCP Server — Implementation Summary

**Version 1.1.0 | MTE Software Ltd**
**Date: March 2026**

---

## Architecture

The MCP server is embedded within the existing Express backend as a route namespace at `/mcp`. It is not a standalone service. It shares the same PostgreSQL database, Drizzle ORM layer, and service classes (ClassifierService, ArtifactService, storage layer) as the web UI. There is no business logic duplication — the MCP server is a thin transport layer that maps MCP tool/resource calls to existing service methods.

### File Structure

```
server/mcp/
├── server.ts              # Express router, MCP session lifecycle, transport management
├── auth.ts                # API key generation, SHA-256 hashing, Bearer auth, project membership checks
├── tools/
│   ├── execution.ts       # 7 execution tools (start_session, get_session_status, etc.)
│   └── clarifications.ts  # 3 clarification tools (list, get, resolve)
└── resources/
    └── context.ts         # 5 read-only resources (requirements, idea-analysis, etc.)
```

Supporting files:

```
server/routes/account.routes.ts   # API key CRUD endpoints (generate, list, revoke)
server/services/classifier.service.ts   # Deterministic failure pattern matching
server/services/failure-taxonomy.ts     # 12 failure patterns + 1 unknown fallback
shared/schema.ts                        # DB tables: api_keys, execution_sessions, execution_steps, clarification_contracts
```

### Transport

Uses `@modelcontextprotocol/sdk` with **Streamable HTTP** transport (`StreamableHTTPServerTransport`). This is the standard transport for modern MCP clients. The server handles three HTTP methods on `/mcp`:

| Method | Purpose |
|--------|---------|
| `POST /mcp` | All tool calls, resource reads, and the initial `initialize` handshake |
| `GET /mcp` | Server-Sent Events channel for notifications (requires active session) |
| `DELETE /mcp` | Session termination |

### MCP Session Lifecycle

1. Client sends `POST /mcp` with `method: "initialize"` plus `Authorization` and `X-Project-Id` headers
2. Server authenticates the API key, verifies project membership, creates a new `McpServer` instance with all tools/resources registered
3. Server creates a `StreamableHTTPServerTransport` with a generated UUID session ID
4. Server stores the session in an **in-memory Map** (`Map<string, SessionEntry>`) linking the session ID to the transport, McpServer instance, userId, and projectId
5. All subsequent requests include the `mcp-session-id` header to route to the correct session
6. On `DELETE` or transport close, the session is removed from the Map

**Limitation:** Sessions are in-memory only. A server restart drops all active MCP sessions. Clients must reconnect and re-initialize.

---

## Authentication

### API Key Model

Keys are managed via the `api_keys` PostgreSQL table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar (UUID) | Primary key |
| `user_id` | varchar | Owner's user ID |
| `key_hash` | text | SHA-256 hash of the raw key |
| `key_prefix` | varchar(12) | First 8 characters, stored for display (e.g., `p2p_a3f1`) |
| `label` | text | User-provided label (e.g., "Cursor IDE") |
| `created_at` | timestamp | Creation time |
| `last_used_at` | timestamp | Updated on each successful authentication |
| `revoked_at` | timestamp | Set when key is revoked; null if active |

### Key Generation

- Generated via `crypto.getRandomValues(new Uint8Array(32))` producing 64 hex characters
- Prefixed with `p2p_` for easy identification (full key: `p2p_` + 64 hex chars = 68 characters)
- Raw key is shown to the user exactly once at creation time
- Only the SHA-256 hash is stored in the database

### Authentication Flow (per MCP request)

1. Extract `Authorization: Bearer <key>` header
2. SHA-256 hash the provided key
3. Look up the hash in the `api_keys` table
4. Reject if not found or if `revoked_at` is set
5. Update `last_used_at` timestamp (fire-and-forget, non-blocking)
6. Extract `X-Project-Id` header
7. Verify the key's owner is a member of the specified project via `getProjectMember()`
8. If all checks pass, attach `{ userId, projectId }` to the MCP session

### API Key Management Endpoints

All require standard session authentication (logged-in web user):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/account/api-keys` | Generate a new key. Body: `{ "label": "My Key" }`. Returns the raw key once. |
| `GET` | `/api/account/api-keys` | List all keys for the current user (prefix, label, dates, revoked status). |
| `DELETE` | `/api/account/api-keys/:id` | Revoke a key. Immediate and permanent. Returns 409 if already revoked. |

---

## Tools (10)

### Execution Tools (7)

#### 1. `start_session`

Start a new execution session or resume an existing one for a prompt artifact.

**Parameters:**
- `promptArtifactId` (string, required) — The prompt artifact to execute
- `totalSteps` (integer >= 1, required) — Number of steps to create

**Behavior:**
- Looks up the artifact via `artifactService.getById()`
- Checks for an existing active session for this artifact in the project via `storage.getActiveSessionForArtifact()`
- If found: returns the existing session and its steps with `resumed: true`
- If not found: creates a new `execution_sessions` row and N `execution_steps` rows (one per step, all `not_started`, 0 attempts, 0 escalation)

**Returns:** `{ session, steps, resumed: boolean }`

---

#### 2. `get_session_status`

Get full session status including all step states, progress summary, and upstream change detection.

**Parameters:**
- `sessionId` (string, required)

**Behavior:**
- Fetches session and all steps
- Compares current prompt artifact version against the version recorded when the session started
- If versions differ, sets `upstreamChanged: true`
- Computes progress counts: completed, failed, inProgress, notStarted, percentComplete

**Returns:** `{ session, steps, upstreamChanged, progress: { total, completed, failed, inProgress, notStarted, percentComplete } }`

---

#### 3. `get_current_step`

Get the current active step with full prompt content, integrity metadata, and requirement traceability.

**Parameters:**
- `sessionId` (string, required)

**Behavior:**
- Finds the current step: first `in_progress`, then first `not_started`, then last step
- Reads the prompt artifact's `metadata.steps` array to extract rich content for the current step number

**Returns:**
```json
{
  "step": { "stepNumber", "status", "attempts", ... },
  "stepContent": {
    "title": "Step title",
    "body": "Full prompt text",
    "integrityLevel": "safe | caution | critical",
    "isIdempotent": true | false,
    "requirementsCovered": ["REQ-001", "REQ-002"]
  },
  "sessionStatus": "active",
  "totalSteps": 12
}
```

---

#### 4. `complete_step`

Mark a step as completed. Enforces sequential execution.

**Parameters:**
- `sessionId` (string, required)
- `stepNumber` (integer >= 1, required)

**Enforcement rules:**
- Rejects if session status is `blocked` or `completed`
- Rejects if step N-1 is not completed (sequential enforcement)

**Behavior:**
- Sets step status to `completed`
- Generates a SHA-256 success hash (`step-{N}-completed-{timestamp}`, truncated to 16 hex chars)
- Stores the success hash via `storage.setSuccessHash()`
- If all steps are now completed, sets session status to `completed`

**Returns:** `{ completed: true, stepNumber, successHash, sessionCompleted, nextStep, steps }`

---

#### 5. `report_failure`

Report a step failure. Classifies the error, tracks attempts, detects duplicates, and escalates when thresholds are hit.

**Parameters:**
- `sessionId` (string, required)
- `stepNumber` (integer >= 1, required)
- `failureOutput` (string, required) — Raw error output from the IDE

**Behavior — multi-stage pipeline:**

1. **Hash the failure** — SHA-256 of the raw output, truncated to 16 hex chars
2. **Increment attempts** — Calls `storage.incrementStepAttempts(stepId, failureHash)` which increments the `attempts` counter and updates `lastFailureHash`
3. **Duplicate detection** — If the previous failure hash matches the current one AND attempts >= 2, flags `duplicateFailure: true` and sets `duplicateFailureDetected` on the step
4. **Escalation check** — If `attempts >= 3` AND `attempts % 3 === 0`:
   - Increments `escalationLevel` via `storage.incrementStepEscalation()`
   - If `escalationLevel >= 2` (i.e., 6+ total attempts):
     - Creates a `clarification_contracts` row with `severity: "blocker"`, `category: "execution_failure"`, `originatingModule: "execution"`
     - The clarification includes a question asking for upstream review of the step's requirements/prompts
     - Sets `blocked: true` on the response
5. **Classify the failure** — Runs `classifierService.classifyFailure()` (deterministic pattern matching, no AI call)

**Returns:**
```json
{
  "stepNumber": 3,
  "failureHash": "a1b2c3d4e5f6g7h8",
  "attempts": 4,
  "duplicateFailure": false,
  "escalated": false,
  "clarificationCreated": false,
  "blocked": false,
  "classification": {
    "pattern": "DEP_NPM_ERESOLVE",
    "patternName": "NPM Dependency Conflict",
    "category": "dependency",
    "instructionType": "retry_step",
    "recommendation": "Delete node_modules and reinstall",
    "recoverySteps": ["Delete node_modules folder", "Delete package-lock.json", "Run install again"],
    "shouldRetry": true,
    "shouldStop": false
  }
}
```

**Escalation timeline:**

| Attempts | Escalation Level | What happens |
|----------|-----------------|--------------|
| 1-2 | 0 | Classification only |
| 3 | 1 | First escalation triggered |
| 4-5 | 1 | Classification only |
| 6 | 2 | Second escalation + blocker clarification created + step blocked |
| 9 | 3 | Third escalation + another blocker clarification |

---

#### 6. `skip_to_step`

Jump to a specific step number. All prior steps must already be completed.

**Parameters:**
- `sessionId` (string, required)
- `stepNumber` (integer >= 1, required)

**Behavior:**
- Validates every step before the target is `completed`
- Sets the target step status to `in_progress`

**Returns:** `{ skippedTo, steps }`

---

#### 7. `classify_failure`

Classify an error output without modifying any execution state. Useful for understanding an error before deciding how to proceed.

**Parameters:**
- `failureOutput` (string, required)

**Behavior:** Runs `classifierService.classifyFailure()` — pure function, no side effects, no auth required beyond the MCP session.

**Returns:** `{ pattern, patternName, category, instructionType, response }`

---

### Clarification Tools (3)

#### 8. `list_clarifications`

List active (pending) clarification contracts for the current project.

**Parameters:**
- `module` (string, optional) — Filter by originating module: `execution`, `ideas`, or `requirements`

**Behavior:**
- If `module` provided: calls `storage.listPendingClarificationsByModule(projectId, module)`
- Otherwise: calls `storage.listPendingClarificationsByProject(projectId)`

**Returns:** `{ count, contracts: [{ id, title, category, severity, originatingModule, occurrenceCount, createdAt }] }`

---

#### 9. `get_clarification`

Get full details of a specific clarification contract including the questions that need answers.

**Parameters:**
- `clarificationId` (string, required)

**Behavior:**
- Fetches the contract, verifies it belongs to the current project
- Parses `requiredClarifications` JSON string into array of `{ field, question, expectedAnswerType }`

**Returns:** Full contract details including `requiredClarifications` array.

---

#### 10. `resolve_clarification`

Submit a resolution for a pending clarification contract.

**Parameters:**
- `clarificationId` (string, required)
- `resolutionData` (object, required) — Key-value pairs matching the required clarification fields

**Behavior:**
- Verifies the contract is `pending` (rejects if already resolved)
- Updates status to `resolved` and stores `resolutionData` as JSON

**Returns:** `{ resolved: true, clarificationId, status: "resolved" }`

---

## Resources (5)

All resources are read-only. They provide project context to the IDE's AI assistant.

### 1. `project://requirements`

The full requirements document for the active project. Returns the latest requirements-type artifact's Markdown content (with YAML frontmatter). Returns "No requirements document found" if none exist.

### 2. `project://idea-analysis`

The latest idea analysis artifact. Returns the original Markdown content with a `## Structured Metadata` section appended containing the full artifact metadata as a JSON code block (strengths, weaknesses, risks, feasibility scores, profiles).

### 3. `project://prompt-steps`

All prompt steps from the latest prompts artifact, formatted as Markdown. Each step includes:
- Step number and title
- Integrity level (`safe` / `caution` / `critical`)
- Idempotency flag (Yes/No)
- Requirement IDs covered
- Full prompt body text

Steps are separated by horizontal rules.

### 4. `project://session-state`

Current execution session state as JSON. Finds the active session (or falls back to the most recent session). Includes:
- Session metadata (id, status, promptArtifactId, createdAt)
- Progress summary (total, completed, failed, inProgress, notStarted, percentComplete)
- Active step number
- Failure history per step (attempts, lastFailureHash, escalationLevel, duplicateFailureDetected)

### 5. `project://execution-progress`

Overall execution progress as JSON. Similar to session-state but includes a `blocked` count (steps with `escalationLevel >= 2`) and omits some session metadata. Failure history includes stepNumber, attempts, lastFailureHash, and escalationLevel.

---

## Failure Classification System

The classifier (`ClassifierService`) uses deterministic pattern matching — no AI calls. It scores error output against 12 predefined failure patterns plus 1 unknown fallback.

### Pattern Taxonomy (13 total)

| ID | Category | Name | Retry Allowed |
|----|----------|------|---------------|
| `DEP_NPM_ERESOLVE` | dependency | NPM Dependency Conflict | Yes |
| `SYNTAX_TS_COMPILE` | syntax | TypeScript Compilation Error | Yes |
| `SYNTAX_JS_PARSE` | syntax | JavaScript Parse Error | Yes |
| `RUNTIME_MODULE_NOT_FOUND` | runtime | Module Not Found | Yes |
| `RUNTIME_UNDEFINED_REFERENCE` | runtime | Undefined Reference Error | Yes |
| `RUNTIME_TYPE_ERROR` | runtime | Runtime Type Error | Yes |
| `BUILD_VITE_FAIL` | build | Vite Build Failure | Yes |
| `BUILD_WEBPACK_FAIL` | build | Webpack Build Failure | Yes |
| `DB_CONNECTION_REFUSED` | database | Database Connection Refused | Yes |
| `DB_MIGRATION_FAIL` | database | Database Migration Failure | No |
| `AUTH_TOKEN_INVALID` | auth | Authentication Token Error | No |
| `NETWORK_TIMEOUT` | network | Network Timeout | Yes |
| `UNKNOWN_UNCLASSIFIED` | unknown | Unclassified Failure | No |

### Matching Algorithm

1. Normalize the error output (lowercase, trim)
2. Score each pattern by checking its `detectionHints` array against the output:
   - Regex hints (containing `.*` or `\d`): +2 points per match
   - String literal hints: +1 point per match
3. Best match with score >= 2 wins → returns `KnownFailureResponse` with recovery steps
4. If no pattern scores >= 2 → returns `UnknownFailureResponse` with `stop_execution` instruction

### Instruction Types

| Type | Meaning |
|------|---------|
| `retry_step` | Safe to retry the current step after following recovery steps |
| `regenerate_prompts` | The prompts themselves may be wrong; consider regenerating |
| `stop_execution` | Do not continue; manual intervention needed |

---

## Database Tables

### `api_keys`

Stores hashed API keys for MCP authentication. One user can have multiple keys. Keys can be revoked but not deleted.

### `execution_sessions`

One session per prompt artifact per project. Tracks overall execution status (`active`, `completed`, `blocked`) and which version of the prompt artifact the session was started against.

### `execution_steps`

One row per step per session. Tracks:
- `status`: not_started → in_progress → completed/failed
- `attempts`: cumulative failure count
- `lastFailureHash`: SHA-256 hash of the most recent error output (for duplicate detection)
- `escalationLevel`: incremented every 3 failures
- `successHash`: set when step is completed
- `reexecutionCount`: tracks re-executions
- `integrityOverrideConfirmed`: whether user confirmed override for critical steps
- `duplicateFailureDetected`: flag for consecutive identical errors

### `clarification_contracts`

Created automatically when escalation level reaches 2+. Used by both the MCP server and the web UI. Tracks the question, originating module, severity, resolution status, and resolution data.

---

## IDE Configuration

### Cursor

`.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "plan2prompt": {
      "url": "https://your-app-url.replit.app/mcp",
      "headers": {
        "Authorization": "Bearer p2p_your_api_key_here",
        "X-Project-Id": "your-project-id-here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add plan2prompt \
  --transport http \
  --url "https://your-app-url.replit.app/mcp" \
  --header "Authorization: Bearer p2p_your_api_key_here" \
  --header "X-Project-Id: your-project-id-here"
```

### Any MCP Client

- **URL:** `https://your-app-url.replit.app/mcp`
- **Transport:** Streamable HTTP
- **Required headers:** `Authorization: Bearer <key>`, `X-Project-Id: <project-id>`
- The client must send an `initialize` request first — the server returns an `mcp-session-id` header that must be included in all subsequent requests

---

## Constraints Enforced

The MCP server respects all platform constraints identically to the web UI:

1. **Sequential step execution** — Step N cannot be completed until step N-1 is completed
2. **Session status gates** — Cannot complete steps on blocked or already-completed sessions
3. **Project isolation** — Every request verifies project membership; data from one project is never accessible via another project's ID
4. **Escalation rules** — Failures accumulate per step with automatic escalation at thresholds (3, 6, 9...)
5. **Blocker creation** — At escalation level 2+, a clarification contract with `severity: "blocker"` is created automatically
6. **Duplicate failure detection** — Consecutive identical error hashes are flagged
7. **Upstream change detection** — `get_session_status` compares artifact versions and flags `upstreamChanged: true` if the prompt artifact has been modified since the session started

---

## What Was NOT Built

The following items from the feature spec are not implemented:

1. **MCP Notifications (push)** — The server is request/response only. There is no server-initiated push when clarifications are created or sessions are invalidated. The IDE must poll.
2. **Multi-project support** — Each MCP connection is bound to a single project via the `X-Project-Id` header. Switching projects requires a new connection.
3. **Webhook bridge** — No adapter for non-MCP clients.
4. **Step timing/analytics** — No time tracking on step execution.
5. **IDE template deprecation** — The six hardcoded IDE format templates remain in the codebase. The MCP server serves structured data, but the template system hasn't been removed.
6. **Rate limiting on MCP** — MCP tool calls are not rate-limited separately from the web UI. The existing rate limiter on generation routes does not cover MCP endpoints.
7. **Offline reconciliation** — No batch step-completion mechanism for reconnecting IDEs.

---

*Generated from codebase analysis — March 2026*
