---
applyTo: "**/*.{js,jsx,ts,tsx}"
---

## 1. Core Architecture: Agentic Tool System

This application uses an agentic AI system. Your primary role is to build and maintain the tools this system uses.

- **`ToolOrchestrator` (`src/services/tool-orchestrator.ts`):** The AI "brain." It analyzes user requests, plans which tools to use, executes them, and synthesizes a final answer.
- **`ToolRegistry` (`src/tools/tool-registry.ts`):** A central registry where all available tools are defined. **To add a tool, you must register it here.**

## 2. Tool Development (CRITICAL RULE)

Follow this pattern precisely when creating a new tool:

1.  **Define Parameters with Zod:** In `src/tools/tool-definitions.ts`, create a Zod schema for the tool's parameters. **Every parameter MUST have a `.describe()`** call explaining its purpose for the AI.
    ```typescript
    export const MyToolParamsSchema = z.object({
      targetId: z.string().describe("The ID of the target entity."),
    });
    ```
2.  **Implement the Tool Executor:** In a `src/tools/*.ts` file, write an `async` function that takes the validated parameters and returns a `ToolResult` object (`{ success: boolean; data?: T; error?: string; message?: string; }`).
    ```typescript
    async function myToolExecutor(
      params: z.infer<typeof MyToolParamsSchema>
    ): Promise<ToolResult> {
      // ... logic ...
    }
    ```
3.  **Register the Tool:** In `src/tools/tool-registry.ts`, call `registry.registerTool()` with the tool's name, a clear `description` for the AI, the Zod schema, and the executor function.

## 3. Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Authentication:** NextAuth.js
- **UI:** DaisyUI 5 & Tailwind CSS 4
- **Testing:** Jest & React Testing Library
- **Validation:** Zod
- **Linting:** ESLint & Prettier (`eslint.config.mjs`)

## 4. Folder Layout

```text
src/
├── __tests__/          # Jest tests (mirroring src structure)
├── app/                # Next.js App Router (Pages and API Routes)
│   ├── api/            # Backend API routes (e.g., /api/chat/route.ts)
│   └── ...
├── components/         # React UI components (Client & Server)
├── lib/                # Core libraries, utilities (e.g., auth.ts)
├── services/           # Backend service logic (e.g., tool-orchestrator.ts)
├── tools/              # Agentic tools, definitions, and registry
└── types/              # Global TypeScript type definitions
```

## 5. Coding Standards

- **TypeScript:** Use strict mode. Avoid `any`. Use `interface` for object shapes, `type` for unions/intersections.
- **React:** Use functional components with Hooks. Default to Server Components; use `'use client';` only for interactivity.
- **UI:** Leverage DaisyUI components first. Use Tailwind utilities for custom styling.
- **Validation:** Validate all external data and API inputs with Zod.
- **Naming:** `camelCase` for functions/variables, `PascalCase` for components/types, `UPPER_SNAKE_CASE` for constants.

## 6. Testing

- **Requirement:** All new features, bug fixes, and tools **must** be accompanied by tests in `src/__tests__/`.
- **Mocks:** Use `jest.mock()` to mock dependencies, especially external API calls and services.
- **Commands:**
  - `npm test`: Run all unit, integration, and component tests.
  - `npm run test:watch`: Run tests in watch mode.
  - `npm run test:coverage`: Generate a coverage report.

## 7. Commits & Version Control

- Follow the Conventional Commits specification (e.g., `feat:`, `fix:`, `docs:`, `test:`).

## 8. GitHub Copilot Interaction Protocol

**Your primary objective is to generate high-quality, tested code that strictly adheres to the project's architecture and standards defined in this document.**

Follow this workflow for every user request:

a. **Analyze & Clarify:**

    - First, analyze the user's request and the existing codebase using your `#codebase` tool.
    - If the request is complex or ambiguous, ask clarifying questions before proceeding.

b. **Plan Ahead:**

    - Before writing any code, present a concise, step-by-step implementation plan.
    - Mention which files you will create or modify.
    - **Identify if any documentation in the `docs/` folder or prompts in `.github/prompts/` need updating as part of your plan.**
    - Use your web search tool to find up-to-date information on any libraries or APIs involved.
    - **Wait for user approval of the plan before executing.**

c. **Execute Step-by-Step:**

    - Implement the plan one step at a time.
    - After each significant code generation, briefly state what you did and what the next step is.
    - Always reference the existing code and the project's instructions to ensure consistency.
    - **After applying changes, check the `#problems` panel to ensure no new errors or warnings were introduced.**

d. **Test Everything:** - Generating tests is **mandatory**. For any new function, component, or tool you create, you must also generate corresponding tests following the project's testing guidelines.

### How to Approach Common Tasks

- **Adding a New Feature:** Plan the UI components, API endpoints, service logic, and any new agentic tools. Define types first, then implement, and finally write tests.
- **Fixing a Bug:** First, write a failing test that reproduces the bug. Then, implement the fix. Finally, ensure all tests pass.
- **Refactoring Code:** Ensure the code to be refactored has adequate test coverage _before_ you begin. Make small, incremental changes and run tests after each change.
- **Updating Documentation:** If your changes affect user-facing features or APIs, update the relevant documentation in the `docs/` folder. If you modify prompts, ensure they are clear and concise.
- **Handling Errors:** If you encounter an error, first check the `#problems` panel. If the error is not clear, search for it online or ask for clarification. Always provide a clear error message in your code when throwing exceptions.
- **Using External Libraries:** Always check if the library is already used in the project. If not, ensure it aligns with the project's standards before integrating it.
