---
applyTo: "**/*.{js,jsx,ts,tsx}"
---

## Purpose

These instructions define coding standards and architectural conventions for the **Next.js 14** code‑base so that AI assistants and human contributors produce consistent, maintainable code.
Note: Always double check the official online documentation when you find difficulties with some sdk, then proceed using the refreshed knowledge.

## Tooling & Runtime

- **Node.js 24.x**
- **Package manager:** npm
- **Next.js 15.x** with the **App Router** (no legacy _pages_ router) and next-auth for authentication.
- **NextAuth.js** for authentication, supporting Google, GitHub, and email/password.
- **TypeScript** is mandatory; `.js` files are allowed only for build scripts.
- **ESLint** with `next/core-web-vitals` rules and **Prettier** for formatting.
- **DaisyUI 5.x** for UI components, built on **Tailwind 4 CSS (with global.css)**.
- **Jest** + **React‑Testing‑Library** for unit/integration tests; **Cypress** for E2E.

## Folder Layout

```text
calendar-assistant/
├── .github/
│   └── prompts/
│       └── main_application.prompt.md  # This guide!
├── public/                             # Static assets
├── settings/                           # Configuration files (e.g., allowed emails, vector search)
├── src/
│   ├── __mocks__/                      # Mock implementations for testing
│   ├── __tests__/                      # Jest tests (unit, integration, component)
│   │   ├── functional/                 # Functional tests
│   │   └── integration/                # Integration tests
│   ├── app/                            # Next.js App Router
│   │   ├── api/                        # API routes (backend logic)
│   │   │   ├── auth/                   # NextAuth.js authentication
│   │   │   ├── chat/                   # Main chat API endpoint (agentic orchestration)
│   │   │   │   ├── route.ts            # Chat API route
│   │   │   │   └── stream/             # Streaming chat API
│   │   │   │       └── route.ts        # Streaming chat route
│   │   │   ├── dev/                    # Development-related API endpoints
│   │   │   ├── reports/                # Reports generation API
│   │   │   └── test/                   # Test-related API endpoints
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Global styles
│   │   ├── page-clean.tsx              # Clean page layout
│   │   └── page.tsx                    # Home page
│   ├── components/                     # React UI components (client & server)
│   ├── appconfig/                      # Application configuration and core logic
│   │   ├── email-filter-manager.ts     # Utility to manage allowed emails configuration
│   │   ├── models.ts                   # Model type definitions and configuration for supported AI models
│   ├── contexts/                       # React Contexts for state management
│   ├── lib/                            # Core libraries, utilities (e.g., auth.ts)
│   ├── services/                       # Backend service logic
│   │   ├── ai-service.ts               # AI model interaction
│   │   ├── calendar-service.ts         # Google Calendar interaction
│   │   └── tool-orchestrator.ts        # Core agentic reasoning engine
│   ├── tools/                          # Extensible tool system
│   │   ├── calendar-tools.ts           # Calendar-specific tools
│   │   ├── email-tools.ts              # Email-specific tools
│   │   ├── file-tools.ts               # File-specific tools
│   │   ├── knowledge-tools.ts          # Knowledge-specific tools
│   │   ├── tool-definitions.ts         # Zod schemas for tool parameters
│   │   ├── tool-registry.ts            # Tool registration and management
│   │   ├── vector-search-tool.ts       # Vector search tool for knowledge base
│   │   └── web-tools.ts                # Web-related tools (e.g., fetching)
│   └── types/                          # TypeScript type definitions
├── eslint.config.mjs                   # ESLint configuration
├── jest.config.js                      # Jest test runner configuration
├── next.config.ts                      # Next.js configuration
├── package.json                        # Project dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── tsconfig.test.json                  # TypeScript configuration for tests
├── tsconfig.tsbuildinfo                # TypeScript build info
├── Dockerfile                          # Docker configuration
├── docker-compose.yml                  # Docker Compose configuration
├── README.md                           # General project README
```

## Coding Standards

1. Functional components only; never use `class` components.
2. Prefer server components; mark interactive pieces with `"use client";` at the top of the file.
3. Enable strict‑mode TypeScript and `noImplicitAny`.
4. Keep components under 200 lines; extract logic to hooks or utilities.
5. Use `next/image` for all raster images and provide accessible `alt` text.
6. Fetch data in the nearest server component and leverage built‑in caching.
7. Validate external data at runtime with Zod.

## API Routes

- REST endpoints live under `app/api/**/route.ts`.
- Parse request bodies with helpers and guard against invalid payloads.
- Return typed `Response` objects with explicit status codes.

## Environment Variables

- Define variables in `.env`; prefix `NEXT_PUBLIC_` for client exposure.
- Never commit `.env*` files to version control.

## Testing & CI

### How to run tests

- **Run all regular (unit, integration, component) tests:**

  ```bash
  npm test
  # or
  npm run test
  ```

- **Run only functional tests** (real API calls, e.g., Google Calendar):

  ```bash
  npm run test:functional
  ```

- **Run a specific functional test:**

  ```bash
  npm run test:functional -- --testNamePattern="<pattern>"
  # Example:
  npm run test:functional -- --testNamePattern="Calendar Operations"
  ```

- **Watch mode:**
  - Regular tests: `npm run test:watch`
  - Functional tests: `npm run test:functional:watch`

> Functional tests are excluded from the default test run and must be run explicitly.

1. Important new logic requires matching tests (`*.test.tsx?`).
2. CI pipeline (`.github/workflows/ci.yml`) runs lint, type‑check, and tests on pull requests.
3. Code coverage must remain ≥ 90 %.

## Commit & PR Guidelines

- Follow Conventional Commits (`feat:`, `fix:`, `chore:` …).
- Each PR targets `develop` and must reference an issue.

## Deployment

- Production is deployed to a private VPS by the **Deploy Calendar Assistant to VPS** GitHub Actions workflow (“deploy.yml”) on every push to `main` (or via manual dispatch). The action connects over SSH, builds a fresh Docker image, and restarts the stack with Docker Compose.
