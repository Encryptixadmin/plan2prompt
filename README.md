# Plan2Prompt

An AI-powered platform that validates application ideas through multi-provider consensus analysis and converts them into actionable, IDE-ready build prompts. The complete pipeline — **Ideas → Requirements → Prompts** — accelerates the journey from concept to deployable application.

## What It Does

Plan2Prompt guides you through three stages:

1. **Idea Analysis** — Submit an application idea and receive a consensus evaluation from multiple AI providers (OpenAI, Anthropic, Gemini). Get structured feedback on strengths, weaknesses, risks, feasibility scores, and a go/no-go recommendation. Optionally refine your idea through a guided workshop.

2. **Requirements Generation** — Accepted ideas are expanded into comprehensive requirements documents with system overviews, architecture decisions, and risk traceability linking back to identified risks.

3. **Prompt Generation** — Requirements are transformed into sequential, IDE-specific build prompts for Replit, Cursor, Lovable, Windsurf, Warp, or a generic format. Each prompt step includes integrity levels, idempotency flags, and traceability to specific requirements.

All outputs are versioned Markdown artifacts with YAML frontmatter, stored in PostgreSQL.

## MCP Server (IDE Integration)

Plan2Prompt includes a **Model Context Protocol (MCP) server** that lets IDE AI assistants (Cursor, Windsurf, Claude Code, etc.) connect directly to your project. Instead of copy-pasting prompts, your IDE can pull prompt steps, track execution progress, report failures, and access full project context — all automatically.

- **Transport**: Streamable HTTP at `/mcp`
- **Auth**: API keys (generated in Account Settings, `p2p_` prefix, SHA-256 hashed)
- **11 tools**: `start_session`, `get_session_status`, `get_current_step`, `complete_step`, `batch_complete_steps`, `report_failure`, `skip_to_step`, `classify_failure`, `list_clarifications`, `get_clarification`, `resolve_clarification`
- **6 resources**: `project://requirements`, `project://idea-analysis`, `project://prompt-steps`, `project://prompt-steps-structured`, `project://session-state`, `project://execution-progress`

See [MCP_REFERENCE.md](MCP_REFERENCE.md) for full setup instructions and IDE configuration examples.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui (Radix UI) |
| Backend | Node.js, Express |
| Database | PostgreSQL, Drizzle ORM |
| AI Providers | OpenAI, Anthropic, Google Gemini |
| MCP | `@modelcontextprotocol/sdk` (Streamable HTTP) |
| Auth | Replit Auth (OpenID Connect) + API keys |
| Testing | Vitest (273 tests) |

## Project Structure

```
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # UI components (shadcn/ui)
│   │   ├── pages/             # Route pages
│   │   │   ├── landing.tsx    # Public landing page
│   │   │   ├── home.tsx       # Dashboard (pipeline view)
│   │   │   ├── ideas.tsx      # Idea analysis module
│   │   │   ├── requirements.tsx
│   │   │   ├── prompts.tsx
│   │   │   ├── mcp-setup.tsx  # MCP configuration guide
│   │   │   ├── account.tsx    # API keys, data export, deletion
│   │   │   └── admin.tsx      # Admin console (8 tabs)
│   │   ├── hooks/             # Custom hooks (SSE, page titles, etc.)
│   │   └── lib/               # Utilities, query client
│   └── public/                # Static assets, robots.txt, sitemap.xml
│
├── server/                    # Express backend
│   ├── index.ts               # Entry point, graceful shutdown
│   ├── routes/                # API route modules
│   ├── services/
│   │   └── ai/                # AI provider implementations
│   │       ├── consensus.service.ts   # Multi-provider orchestration
│   │       ├── circuit-breaker.ts     # Failure protection
│   │       ├── openai.service.ts
│   │       ├── anthropic.service.ts
│   │       └── gemini.service.ts
│   ├── mcp/                   # MCP server (tools, resources, auth)
│   │   ├── server.ts
│   │   ├── tools/
│   │   └── resources/
│   ├── middleware/             # Auth, rate limiting, project context
│   └── storage.ts             # Database storage interface
│
├── shared/                    # Shared contracts
│   ├── schema.ts              # Drizzle ORM schemas + Zod validation
│   └── types/                 # TypeScript interfaces
│
└── tests/                     # Test suites
    ├── integration/           # API integration tests
    └── invariants/            # Business logic invariant tests
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- At least one AI provider API key (OpenAI, Anthropic, or Gemini)

### Environment Variables

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=your-session-secret

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### Installation

```bash
npm install
npm run db:push    # Apply database schema
npm run dev        # Start development server (port 5000)
```

### Production Build

```bash
npm run build
npm start
```

## API Overview

### Core Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ideas/analyze-stream` | Analyze an idea (SSE streaming) |
| POST | `/api/requirements/generate-stream` | Generate requirements (SSE streaming) |
| POST | `/api/prompts/generate-stream` | Generate build prompts (SSE streaming) |
| GET | `/api/projects/:id/pipeline` | Pipeline status dashboard |

### Artifacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/artifacts` | List artifacts (`?module=ideas\|requirements\|prompts`) |
| GET | `/api/artifacts/:id` | Get artifact by ID |
| GET | `/api/artifacts/:id/versions` | Version history |
| GET | `/api/artifacts/:id/export?format=markdown` | Export as Markdown |
| POST | `/api/artifacts` | Create artifact |
| PUT | `/api/artifacts/:id` | Update (creates new version) |

### AI Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/providers` | List providers and status |
| POST | `/api/ai/consensus` | Multi-provider consensus query |

### Account & Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/account/export` | Export all user data (JSON) |
| DELETE | `/api/account` | Delete account (anonymize + revoke keys) |
| POST | `/api/account/api-keys` | Generate MCP API key |
| GET | `/api/health` | Health check (unauthenticated) |

### MCP Server

| Endpoint | Description |
|----------|-------------|
| `/mcp` | Streamable HTTP MCP endpoint (API key auth) |

## Key Features

- **Multi-Provider AI Consensus** — queries multiple AI providers and synthesizes results with weighted scoring
- **Circuit Breaker** — automatically skips failing AI providers (5-failure threshold, 60s cooldown, auto-recovery)
- **Versioned Artifacts** — immutable version history for all generated content
- **SSE Streaming** — real-time progress updates during AI generation
- **Risk Traceability** — risks identified in idea analysis flow through to requirements and prompt steps
- **Cross-Module Clarifications** — downstream modules can request upstream clarification with severity escalation
- **Execution Sessions** — persistent per-step state tracking for prompt execution in IDEs
- **Admin Console** — 8-tab dashboard with user management, health monitoring, usage tracking, and audit logs
- **Rate Limiting** — PostgreSQL-backed rate limiting on AI generation, login, and registration endpoints
- **Account Data Management** — full data export and GDPR-style account deletion
- **SEO** — meta tags, Open Graph, JSON-LD schema, sitemap, robots.txt, dynamic page titles

## Testing

```bash
npx vitest run              # Run all 273 tests
npx vitest run --reporter=verbose   # Verbose output
```

Tests cover pipeline sequencing, permissions, usage tracking, clarification contracts, traceability, MCP API key management, execution integrity, risk delta, failure classification, health checks, auth, CSRF, error formats, and security headers.

## License

All rights reserved.
