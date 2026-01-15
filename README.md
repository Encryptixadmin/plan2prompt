# Production-Ready Web Platform

A scalable, modular web platform built for extensibility and maintainability.

## Purpose

This platform serves as a foundation for building production-grade web applications with:
- Modular architecture supporting independent feature modules
- AI service integration capabilities (OpenAI, Anthropic, Gemini)
- Structured Markdown outputs as first-class artefacts
- Clean separation between frontend, backend, and shared contracts

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Validation | Zod |
| Data | PostgreSQL (or in-memory for development) |

## Project Structure

```
/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities and helpers
│   │   └── hooks/          # Custom React hooks
│   └── index.html
│
├── server/                 # Express backend application
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Data storage interface
│   └── index.ts            # Server entry point
│
├── shared/                 # Shared code between frontend/backend
│   ├── schema.ts           # Database schemas (Drizzle ORM)
│   └── types/              # TypeScript type contracts
│
└── outputs/                # Generated Markdown artefacts (future)
```

## API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Backend health check |

### Artifact Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/artifacts` | List all artefacts (query: `?module=x`) |
| GET | `/api/artifacts/:id` | Get artefact by ID |
| GET | `/api/artifacts/:id/reference` | Get artefact reference for module passing |
| GET | `/api/artifacts/:id/versions` | Get version history |
| GET | `/api/artifacts/path/*` | Load artefact by file path |
| POST | `/api/artifacts` | Create new artefact |
| PUT | `/api/artifacts/:id` | Update artefact (creates new version) |

## Development

The application runs on port 5000 with hot module replacement enabled.

```bash
npm run dev
```

## Architecture Principles

1. **Schema-First**: Define data models before implementation
2. **Service Abstraction**: AI logic behind service interfaces
3. **Type Safety**: Full TypeScript coverage with Zod validation
4. **Markdown Artefacts**: Module outputs saved as structured `.md` files

## Status

- [x] Project structure initialized
- [x] Frontend configured (React + Vite + Tailwind)
- [x] Backend configured (Express)
- [x] Shared types established
- [ ] AI service interfaces (pending)
- [ ] Module implementations (pending)
- [ ] Authentication (pending)
