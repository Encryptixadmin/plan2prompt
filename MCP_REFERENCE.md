# Plan2Prompt MCP Server Reference

The Plan2Prompt MCP (Model Context Protocol) server allows IDE AI assistants like Cursor, Windsurf, Claude Code, and others to connect directly to your Plan2Prompt project. Instead of copying and pasting prompts between the browser and your IDE, the MCP server lets your IDE pull prompt steps, track progress, report failures, and access project context automatically.

---

## Getting Started

### 1. Generate an API Key

Go to your **Account Settings** page (`/account`) in Plan2Prompt and click **Generate New Key**. Give it a label (e.g. "Cursor IDE") and save the key somewhere safe — it's only shown once.

All keys start with `p2p_` for easy identification.

### 2. Find Your Project ID

Your Project ID is visible in the URL when viewing your project, or in the project settings. It looks like: `292dfa50-476d-4d5c-8583-a07b225ed33c`.

### 3. Configure Your IDE

Add the Plan2Prompt MCP server to your IDE's MCP configuration:

**Server URL:**
```
https://your-app-url.replit.app/mcp
```

**Required Headers (sent with every request):**
```
Authorization: Bearer p2p_your_api_key_here
X-Project-Id: your-project-id-here
```

**Transport:** Streamable HTTP (the standard for modern MCP clients)

#### Example: Cursor Configuration

In your `.cursor/mcp.json`:
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

#### Example: Claude Code Configuration

```bash
claude mcp add plan2prompt \
  --transport http \
  --url "https://your-app-url.replit.app/mcp" \
  --header "Authorization: Bearer p2p_your_api_key_here" \
  --header "X-Project-Id: your-project-id-here"
```

---

## Tools (10 total)

Tools are actions the IDE can perform. They read or modify state in your Plan2Prompt project.

### Execution Tools (7)

#### `start_session`
Start a new execution session for a prompt artifact, or resume an existing one.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `promptArtifactId` | string | Yes | The ID of the prompt artifact to execute |
| `totalSteps` | integer (min 1) | Yes | Total number of steps in the prompt |

**Returns:** Session object, list of step states, and whether the session was resumed or newly created.

**Example usage:**
```
Start a session for prompt artifact abc-123 with 8 steps.
```

---

#### `get_session_status`
Get the full status of an execution session including all step states, progress summary, and upstream change detection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The execution session ID |

**Returns:**
- Session details (status, artifact ID)
- All step states
- Whether the upstream prompt artifact has changed since the session started
- Progress summary: total, completed, failed, in-progress, not-started counts, and percent complete

---

#### `get_current_step`
Get the current active step with its full prompt content, integrity level, idempotency flag, and requirement traceability links.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The execution session ID |

**Returns:**
- Step record (number, status, attempts)
- Step content from the prompt artifact:
  - `title` — the step's title
  - `body` — the full prompt text to execute
  - `integrityLevel` — `safe`, `caution`, or `critical`
  - `isIdempotent` — whether the step can be safely re-run
  - `requirementsCovered` — list of requirement IDs this step addresses
- Session status and total step count

---

#### `complete_step`
Mark a step as completed and advance the session. Enforces sequential execution — the previous step must be completed first.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The execution session ID |
| `stepNumber` | integer (min 1) | Yes | The step number to complete |

**Returns:**
- Completion confirmation with success hash
- Whether the entire session is now complete
- Next step number (or null if session is done)
- Updated step states

**Rules enforced:**
- Steps must be completed in order (step N-1 must be completed before step N)
- Cannot complete steps on a blocked or already-completed session

---

#### `report_failure`
Report that a step failed. Automatically classifies the failure, tracks attempts, detects duplicate failures, and escalates when thresholds are hit.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The execution session ID |
| `stepNumber` | integer (min 1) | Yes | The step number that failed |
| `failureOutput` | string | Yes | The raw error output from the IDE |

**Returns:**
- `failureHash` — hash of the error for duplicate detection
- `attempts` — total attempts so far
- `duplicateFailure` — true if the same error hash occurred again
- `escalated` — true if escalation threshold was crossed (every 3 failures)
- `clarificationCreated` — true if a blocker clarification contract was created
- `blocked` — true if the step is now blocked
- `classification` — failure classification result:
  - `pattern` / `patternName` — the identified error pattern
  - `category` — error category (e.g. dependency, syntax, runtime)
  - `instructionType` — what to do: `retry`, `retry_step`, or `stop`
  - `recommendation` — human-readable suggested action
  - `recoverySteps` — list of specific recovery instructions
  - `shouldRetry` / `shouldStop` — boolean flags

**Escalation rules:**
- Every 3 consecutive failures triggers escalation
- At escalation level 2+, a blocker clarification contract is created automatically
- Duplicate failures (same error hash twice in a row) are flagged

---

#### `skip_to_step`
Jump to a specific step number. All prior steps must already be completed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The execution session ID |
| `stepNumber` | integer (min 1) | Yes | The step number to skip to |

**Returns:** Confirmation and updated step states.

---

#### `classify_failure`
Classify an error output without modifying any execution state. Useful for understanding an error before deciding how to proceed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `failureOutput` | string | Yes | The raw error output to classify |

**Returns:**
- `pattern` / `patternName` — the identified error pattern
- `category` — error category
- `instructionType` — recommended action (`retry`, `retry_step`, `stop`)
- `response` — full classification response with details

---

### Clarification Tools (3)

#### `list_clarifications`
List active (pending) clarification contracts for the current project. Clarification contracts are created when downstream steps need upstream review — for example, when a build step fails repeatedly.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | string | No | Filter by originating module: `execution`, `ideas`, or `requirements` |

**Returns:** Count and list of contracts, each with: id, title, category, severity, originating module, occurrence count, and creation date.

---

#### `get_clarification`
Get the full details of a specific clarification contract, including the list of questions that need answers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clarificationId` | string | Yes | The clarification contract ID |

**Returns:** Full contract details including `requiredClarifications` — an array of questions with `field`, `question`, and `expectedAnswerType`.

---

#### `resolve_clarification`
Submit a resolution for a pending clarification contract.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clarificationId` | string | Yes | The clarification contract ID |
| `resolutionData` | object | Yes | Key-value pairs matching the required clarification fields |

**Returns:** Confirmation that the clarification was resolved.

---

## Resources (5)

Resources are read-only data the IDE can pull from your project at any time.

### `project://requirements`
The full requirements document for the active project (latest locked requirements artifact). Returned as Markdown with YAML frontmatter.

### `project://idea-analysis`
The latest idea analysis with the original Markdown content plus structured metadata appended as a JSON block. Includes strengths, weaknesses, risks, feasibility scores, and profile assessments.

### `project://prompt-steps`
All prompt steps from the latest prompts artifact, formatted as Markdown. Each step includes:
- Step number and title
- Integrity level (`safe` / `caution` / `critical`)
- Idempotency flag
- Requirement IDs covered
- Full prompt body text

### `project://session-state`
Current execution session state as JSON. Includes:
- Session ID, status, and linked prompt artifact
- Progress summary (total, completed, failed, in-progress, not-started, percent complete)
- Currently active step number
- Failure history per step (attempts, last failure hash, escalation level, duplicate detection)

### `project://execution-progress`
Overall execution progress as JSON. Similar to session-state but focused on aggregate metrics:
- Step counts by status (completed, failed, in-progress, blocked, not-started)
- Completion percentage
- Current step number
- Failure history with escalation levels

---

## Typical Workflow

Here's how an IDE assistant would use these tools in a typical build session:

1. **Read the requirements** — access `project://requirements` to understand what needs to be built
2. **Read the prompt steps** — access `project://prompt-steps` to see all build steps
3. **Start a session** — call `start_session` with the prompt artifact ID and step count
4. **Get the first step** — call `get_current_step` to get the prompt for step 1
5. **Execute the step** — carry out the instructions in the IDE
6. **Complete the step** — call `complete_step` to mark it done and move forward
7. **If something fails** — call `report_failure` with the error output to get classification and recovery guidance
8. **Repeat** until all steps are completed
9. **Check for clarifications** — call `list_clarifications` if any blockers were created during execution
10. **Resolve clarifications** — call `resolve_clarification` to unblock the session

---

## Authentication and Security

- **API keys** are SHA-256 hashed before storage — the raw key is never stored in the database
- **Project isolation** is enforced on every request via the `X-Project-Id` header and verified against project membership
- **Revoked keys** are immediately rejected
- **Last-used timestamps** are updated on each successful authentication
- Keys use the `p2p_` prefix for easy identification (the prefix is stored for display purposes)

---

## API Key Management

Manage your keys from the **Account Settings** page (`/account`):

| Action | How |
|--------|-----|
| **Generate** | Click "Generate New Key", enter a label, copy the key immediately |
| **List** | All your keys are shown in the table with prefix, label, dates, and status |
| **Revoke** | Click the trash icon on any key row — this is immediate and permanent |

REST endpoints for programmatic key management:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/account/api-keys` | Generate a new key (body: `{ "label": "My Key" }`) |
| `GET` | `/api/account/api-keys` | List all your keys |
| `DELETE` | `/api/account/api-keys/:id` | Revoke a key |

These endpoints require standard session authentication (you must be logged in to the web app).
