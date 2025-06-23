# GitHub Copilot Guide: CalendarGPT Project

**Welcome, GitHub Copilot!** This document is your primary guide for understanding and contributing to the CalendarGPT project. Please refer to it for project structure, architectural patterns, coding conventions, testing practices, and development workflows. Your goal is to help develop and maintain this application consistently and effectively.

## 1. Project Overview: CalendarGPT - AI Calendar Assistant

A friendly, professional AI assistant for managing Google Calendar events, built with Next.js, TypeScript, and modern web technologies.

### 1.1. Core Mission

To provide an intelligent, intuitive, and extensible calendar management solution leveraging agentic AI.

### 1.2. Key Features

- 🤖 **Natural Language Processing**: Create, update, and manage calendar events using plain English.
- 🧠 **Agentic AI Orchestration**: Multi-step reasoning with intelligent tool usage and iterative problem solving.
- ⚡ **Advanced Tool System**: Extensible architecture supporting calendar tools with plans for email, file, and web tools.
- 📅 **Google Calendar Integration**: Seamless integration with your Google Calendar.
- 📊 **Weekly Reports**: Generate comprehensive weekly work reports with AI-powered summaries.
- 💬 **Chat Interface**: Intuitive chat-based interaction with three operation modes (Legacy, Tools, Agentic).
- 🎛️ **Dual AI Models**: Separate model selection for chat conversation and tool orchestration.
- 🔍 **Development Transparency**: Full visibility into AI reasoning steps and tool execution in development mode.
- 🎨 **Modern UI**: Beautiful interface built with DaisyUI and Tailwind CSS.
- 🔐 **Secure Authentication**: Google OAuth2 integration with NextAuth.js.
- ✅ **Test Coverage**: Comprehensive test suite using Jest and Testing Library.
- 📚 **Knowledge Base Search**: Factual-only search of internal documents and policies using the vectorFileSearch tool, with a strict fallback when no results are found.

## 2. Technology Stack

- **Framework**: Next.js 15+ with TypeScript
- **AI Architecture**: Agentic tool orchestration with multi-step reasoning (`ToolOrchestrator`, `ToolRegistry`)
- **Tool System**: Extensible `ToolRegistry` and `ToolOrchestrator` for scalable AI workflows (see `src/tools/` and `src/services/tool-orchestrator.ts`)
- **Vector Search Tool**: OpenAI v1/responses API integration for factual search over internal knowledge stores (`src/tools/vector-search-tool.ts`, `settings/vector-search.json`)
- **Authentication**: NextAuth.js with Google OAuth2 (`src/lib/auth.ts`)
- **UI**: DaisyUI 5, Tailwind CSS 4, Lucide React icons
- **APIs**: Google Calendar API, OpenAI API (supporting GPT-4o, GPT-4o Mini, and other models via OpenRouter)
- **State Management**: React Context API, React Query (implicitly via Next.js app router patterns for server components)
- **Testing**: Jest, React Testing Library, Testing Library (`jest.config.js`, `src/__tests__/`)
- **Type Safety**: Full TypeScript implementation with Zod schema validation (`src/types/`, tool definitions)
- **Linting/Formatting**: ESLint (`eslint.config.mjs`), Prettier (integrated via ESLint)

## 3. Setup and Usage

(This section remains largely the same as it's for human developers, but it's good context for you too.)

### 3.1. Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Google Cloud Console project with Calendar API enabled
- An OpenAI API key

### 3.2. Setup Instructions

```bash
git clone <repository-url>
cd calendar-assistant
npm install
```

### 3.3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI API
OPENAI_API_KEY=your-openai-api-key
```

Generate a secure `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3.4. Run the Application

```bash
# Development mode
npm run dev

# Build and start production
npm run build
npm start
```

Visit `http://localhost:3000` to access the application.

### 3.5. Application Usage Overview

### Agentic Chat Interface

CalendarGPT features three operation modes:

#### 1. **Legacy Mode**

Traditional JSON-based calendar operations for backward compatibility.

#### 2. **Tools Mode**

Simple tool-based responses with single tool calls.

#### 3. **Agentic Mode** (NEW!)

Advanced multi-step reasoning where the AI:

- Analyzes your request and plans which tools to use
- Executes tools iteratively based on intermediate results
- Evaluates when sufficient information is gathered
- Synthesizes comprehensive, well-formatted responses
- Shows all reasoning steps in development mode

### Natural Language Commands

CalendarGPT understands complex natural language commands:

- **Create Events**: "Schedule a meeting with John tomorrow at 2 PM"
- **Search Events**: "Show me all Nespola events from March to June 2025"
- **Complex Queries**: "What meetings do I have this week and are there any conflicts?"
- **Update Events**: "Move my 3 PM meeting to 4 PM"
- **Delete Events**: "Cancel my meeting with Sarah on Friday"

### Dual AI Model Selection

- **Chat AI Model**: Handles general conversation and legacy operations
- **Orchestrator AI Model**: Powers the agentic reasoning and tool orchestration
- **Supported Models**: GPT-4o, GPT-4o Mini, o3, o3-mini, and OpenRouter models (DeepSeek, Gemini, etc.)

### Development Mode

Enable development mode to see:

- Step-by-step AI reasoning process
- Tool call parameters and responses
- Execution timing and performance metrics
- Error details for debugging

### Weekly Reports

Generate comprehensive weekly work reports:

1. Navigate to the "Reports" tab
2. Select the week you want to analyze
3. Click "Generate Report"
4. Download the report as a text file

### Event Management

View and manage your calendar events:

1. Go to the "Events" tab
2. See your upcoming events for the next 7 days
3. Use the dropdown menu to edit or delete events

## 4. API Endpoints

### Authentication

- `GET/POST /api/auth/[...nextauth]` - NextAuth.js authentication handlers

### Chat API

- `POST /api/chat` - Process natural language calendar commands

### Reports API

- `POST /api/reports/weekly` - Generate weekly work reports

## 5. Project Structure and Architecture

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

### 4.1. Agentic Architecture (Key for Copilot)

This is the heart of CalendarGPT's intelligence. Understand it well.

#### 4.1.1. ToolRegistry (`src/tools/tool-registry.ts`)

- **Purpose**: Central hub for all available tools.
- **Extensibility**: Designed for easy addition of new tools and categories.
- **Schema Validation**: Uses Zod for strict parameter validation of tools, ensuring type safety and clear contracts.
- **Tool Discovery**: Allows the `ToolOrchestrator` to find and understand available tools.
- **Your Role**: When adding a new tool, you MUST register it here with a clear Zod schema for its parameters and a concise description.

#### 4.1.2. ToolOrchestrator (`src/services/tool-orchestrator.ts`)

- **Purpose**: Manages the agentic, multi-step reasoning process.
- **Workflow**:
  1.  **Analysis**: Analyzes user requests to understand intent.
  2.  **Planning**: Decides which tool(s) to use, in what order, and with what parameters. This may involve multiple iterations.
  3.  **Execution**: Calls tools via the `ToolRegistry`.
  4.  **Evaluation**: Assesses tool outputs and decides if the goal is met or if more steps/tools are needed.
  5.  **Synthesis**: Combines information from tool calls into a comprehensive, user-friendly response.
- **Context Awareness**: Maintains context across multiple tool calls.
- **Error Handling**: Implements basic error handling and can report tool failures.
- **Your Role**: When implementing features requiring complex actions, think about how the `ToolOrchestrator` can break down the task. Your prompts to the orchestrator (via `ai-service.ts`) should be clear about the overall goal.

#### 4.1.3. Supported Tool Categories

- **Current**: `calendar-tools.ts`, `web-tools.ts`
- **Future**: Email, file operations, etc. The system is designed for this expansion.

#### 4.1.4. Agentic Workflow (High-Level)

User Request → AI Analysis (Orchestrator) → Planning (Tool Selection) → Iterative Tool Execution & Evaluation → Synthesized Response.

#### 4.1.5. Development Mode Insights

Development mode provides visibility into the orchestrator's reasoning steps, tool calls, parameters, and responses. Use this for debugging and understanding agent behavior.

## 6. Development Guidelines (Your Rulebook)

Adhere to these guidelines strictly to maintain code quality, consistency, and project health.

### 6.1. General Principles

- **Clarity and Readability**: Write code that is easy to understand. Use descriptive names for variables, functions, and classes.
- **Modularity**: Break down complex logic into smaller, reusable functions or components.
- **DRY (Don't Repeat Yourself)**: Avoid code duplication.
- **SOLID Principles**: Apply them where appropriate, especially in service and tool design.

### 6.2. Code Style & Formatting

- **ESLint & Prettier**: The project uses ESLint (config: `eslint.config.mjs`) which integrates Prettier. **All code MUST conform to these rules.** Ensure your editor is set up to format on save or run `npm run lint -- --fix` and `npm run format` regularly.
- **TypeScript First**:
  - Use TypeScript for all new code.
  - Employ strong typing. Avoid `any` where possible; use `unknown` for safer alternatives if type is truly unknown, or define specific types/interfaces.
  - Use `interfaces` for public APIs and object shapes, `type` for utility types, unions, intersections.
  - Leverage TypeScript's utility types (e.g., `Partial`, `Readonly`, `ReturnType`).
- **React Best Practices**:
  - Prefer functional components with Hooks.
  - Use Server Components where appropriate for performance (default in Next.js App Router).
  - Clearly distinguish Client Components (`'use client';`) when interactivity or browser APIs are needed.
  - Follow rules of Hooks.
- **Comments**:
  - Write JSDoc comments for public functions, classes, and complex type definitions, explaining purpose, parameters, and return values if not obvious.
  - Add inline comments to explain complex or non-obvious logic.
  - **Do not over-comment simple, self-explanatory code.**
- **Naming Conventions**:
  - `camelCase` for variables and functions.
  - `PascalCase` for classes, React components, and type/interface names.
  - `UPPER_SNAKE_CASE` for constants.
  - Boolean variables/functions should sound like questions (e.g., `isValid`, `shouldUpdate`).

### 6.3. UI Development (`src/components/`, `src/app/`)

- **DaisyUI & Tailwind CSS**:
  - Leverage DaisyUI components for consistency (`Button`, `Card`, `Modal`, etc.).
  - Use Tailwind CSS utility classes for custom styling and layout.
  - Strive for a clean, intuitive, and responsive UI.
- **Lucide React Icons**: Use for iconography.
- **Accessibility (a11y)**: Keep accessibility in mind. Use semantic HTML and ARIA attributes where necessary.
- **State Management**:
  - For local component state, use `useState` and `useReducer`.
  - For global state or cross-component state, consider React Context or if complexity grows, libraries like Zustand or Jotai (currently not in use, discuss before adding).
  - For server state, caching, and mutations (e.g., API calls), Next.js App Router's model with Server Components and Server Actions is preferred. Client components can use `fetch` or libraries like `SWR`/`TanStack Query` if needed (currently not explicitly used, discuss before adding).

### 6.4. Backend Development (`src/app/api/`, `src/services/`)

- **Next.js API Routes**: Follow Next.js conventions for API route handlers.
- **Service Layer**: Encapsulate business logic in services (`src/services/`). Services should be testable and potentially reusable.
- **Error Handling**: Implement robust error handling. Return meaningful error messages and HTTP status codes from API endpoints.
- **Security**:
  - Validate all inputs (especially from users or external APIs). Zod is excellent for this.
  - Sanitize outputs where appropriate.
  - Be mindful of authentication and authorization for sensitive operations.

### 6.5. Tool Development (`src/tools/`) - Crucial for Agentic Features

This is a core area of development. Follow these patterns meticulously.

#### 6.5.1. Adding a New Tool

1.  **Define Parameters with Zod**: In `src/tools/tool-definitions.ts` (or a new category-specific definition file), create a Zod schema for the tool's input parameters.
    - Each parameter MUST have a `.describe()` call explaining its purpose clearly. This description is used by the AI to understand how to use the tool.
    ```typescript
    export const MyNewToolParamsSchema = z.object({
      targetId: z.string().describe("The ID of the target entity."),
      isUrgent: z
        .boolean()
        .optional()
        .describe("Set to true if the operation is urgent."),
    });
    ```
2.  **Implement the Tool Logic**:
    - Create or update a tool category file (e.g., `src/tools/my-category-tools.ts`).
    - Write an `async` function that takes the validated parameters and performs the tool's action.
    - The function MUST return a `ToolResult` object:
      ```typescript
      interface ToolResult<T = unknown> {
        success: boolean;
        data?: T;
        error?: string; // For technical/internal errors
        message?: string; // User-facing message or summary of action
      }
      ```
    - Example:
      ```typescript
      async function myNewToolExecutor(
        params: z.infer<typeof MyNewToolParamsSchema>
      ): Promise<ToolResult<{ outcome: string }>> {
        try {
          // ... tool logic ...
          return {
            success: true,
            data: { outcome: "Achieved" },
            message: "Tool executed successfully.",
          };
        } catch (e) {
          const error = e instanceof Error ? e.message : "Unknown error";
          return {
            success: false,
            error: `MyNewTool failed: ${error}`,
            message: "Failed to execute the new tool.",
          };
        }
      }
      ```
3.  **Register the Tool**: In `src/tools/tool-registry.ts`:
    - Import the schema and executor.
    - Call `registry.registerTool()`:
      ```typescript
      registry.registerTool(
        {
          name: "myNewTool",
          description:
            "A clear, concise description of what this tool does and when to use it.", // Crucial for AI
          parameters: MyNewToolParamsSchema,
          category: "MyCategory", // Or an existing category
        },
        myNewToolExecutor
      );
      ```
4.  **Write Tests**: Add comprehensive unit tests for the new tool in `src/__tests__/` (e.g., `my-category-tools.test.ts`). Mock any external dependencies.

#### 6.5.2. Tool Design Best Practices

- **Single Responsibility**: Tools should ideally do one thing well.
- **Idempotency**: If possible, design tools to be idempotent.
- **Clear Descriptions**: The `name` and `description` fields during registration are CRITICAL for the `ToolOrchestrator` (and you, Copilot!) to understand when and how to use the tool.
- **Robust Error Handling**: Return `success: false` with informative `error` and `message` fields on failure.
- **Performance**: Be mindful of tool execution time, especially for tools calling external APIs. Implement timeouts if necessary.

### 6.6. Testing (`src/__tests__/`, `jest.config.js`)

**Comprehensive testing is mandatory.**

#### 6.6.1. Testing Philosophy

- **Unit Tests**: Test individual functions, modules, and React components in isolation. Mock dependencies.
- **Integration Tests**: Test interactions between modules or services (e.g., a service interacting with a mocked API client).
- **Component Tests (React)**: Use React Testing Library (`@testing-library/react`).
  - Test component behavior from a user's perspective. Interact with the component as a user would (find elements, simulate events).
  - Avoid testing implementation details.
- **API Route Tests**: Test API endpoints by mocking service layer dependencies.
- **Functional Tests**: Test specific user flows or features end-to-end (within the scope of backend/service logic, not full E2E browser tests yet).

#### 6.6.2. How to Write Tests

- **File Location**: Tests reside in `src/__tests__/`. Mirror the directory structure of `src/` where applicable (e.g., `src/__tests__/components/Chat.test.tsx` for `src/components/Chat.tsx`).
- **Naming**: Use `*.test.ts` or `*.test.tsx` extensions.
- **Jest & Testing Library**: Familiarize yourself with their APIs.
- **Mocking**:
  - Use `jest.mock('./path/to/module')` for mocking modules.
  - Use `jest.fn()` for mock functions.
  - Mock service dependencies for component and API tests.
  - Mock API clients (like Google Calendar or OpenAI) for service tests.
- **Assertions**: Use Jest's `expect` matchers.
- **Coverage**: Aim for high test coverage. Run `npm run test:coverage` to check. While 100% isn't always practical, critical paths and complex logic MUST be covered.

#### 6.6.3. Running Tests

- `npm test`: Run all tests.
- `npm run test:watch`: Run tests in watch mode.
- `npm run test:coverage`: Run tests and generate a coverage report.
- `npm test -- --testPathPattern=Chat.test.tsx`: Run specific test files.

#### 6.6.4. Your Role in Testing (Copilot)

- **When adding new features or fixing bugs, YOU MUST write or update corresponding tests.**
- If you generate a new function, component, or service, ask yourself: "How can this be tested?" and then generate the test.
- Ensure tests cover:
  - Happy paths.
  - Edge cases.
  - Error conditions.

### 6.7. Documentation

- **READMEs**: Keep `README.md` and other documentation (e.g., in `docs/` if created) up-to-date.
- **JSDoc**: As mentioned in Code Style, use for public APIs and complex types.
- **This Document**: If you identify gaps or outdated information here, please suggest updates!

### 6.8. Version Control (Git)

- Follow conventional commit messages (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).
- Create feature branches for new development.
- Rebase or merge branches regularly.

## 7. Copilot's Role & Agentic Mode Best Practices

This section is specifically for you, GitHub Copilot, especially when operating in "agent mode" or fulfilling complex requests.

### 7.1. Your Primary Objective

To assist in developing CalendarGPT by generating high-quality, consistent, and well-tested code, adhering to all guidelines in this document.

### 7.2. Understanding Requests

- **Clarify Ambiguity**: If a user's request is unclear, ask for clarification before proceeding.
- **Break Down Complex Tasks**: For large features, think about the smaller, manageable pieces. You can suggest a plan.

### 7.3. Leveraging the Agentic Architecture

- **Think Like an Agent**: When a task involves multiple steps or information gathering (e.g., "Find all meetings next week about project X and then summarize them"), consider how the `ToolOrchestrator` would handle this.
- **Prioritize Existing Tools**: Before suggesting or creating a new tool, ALWAYS check if existing tools (see `src/tools/` and their registrations in `tool-registry.ts`) can achieve the goal or part of it. The `ToolOrchestrator` is designed to combine tools.
- **Tool Design**: If a new tool is genuinely needed:
  - Follow the "Tool Development" guidelines (Section 6.5) strictly.
  - Ensure its `description` and parameter `describe()` calls are crystal clear for the AI orchestrator.
- **Iterative Problem Solving**: The agentic system works iteratively. Your contributions should support this. For example, if a tool provides partial information, the next step might be another tool call based on those results.

### 7.4. Code Generation

- **Adhere to Guidelines**: All generated code (UI, backend, tools, tests, types) MUST follow the project's code style, TypeScript usage, and testing strategy outlined in Section 6.
- **Context is Key**: Use the provided file context and this document to generate relevant and consistent code.
- **Security and Performance**: Keep these in mind, especially for backend and tool development.

### 7.5. Testing is Non-Negotiable

- **Generate Tests**: For any new logic, component, or tool you create, you are expected to also generate the corresponding tests.
- **Verify Tests**: If you modify existing code, ensure existing tests still pass, or update them as needed.

### 7.6. Learning and Adapting

- This document is your "source of truth" for project conventions.
- If you encounter patterns or practices in the codebase not covered here, try to follow the existing style.
- Your ability to learn from the existing codebase and this guide is crucial for success.

## 8. How to Approach Common Tasks

### 8.1. Adding a New Feature (e.g., a new UI component with backend logic)

1.  **Understand Requirements**: What should the feature do?
2.  **Plan**:
    - UI: What components are needed? What state?
    - Backend: New API endpoint? Service logic? New tools?
    - Types: Define necessary TypeScript types/interfaces in `src/types/`.
3.  **Implement**:
    - Create components in `src/components/`.
    - Add API routes in `src/app/api/`.
    - Implement services in `src/services/`.
    - If agentic, develop tools in `src/tools/` (following Section 6.5).
4.  **Test**: Write unit, integration, and component tests (following Section 6.6).
5.  **Document**: Update READMEs or JSDoc if necessary.

### 8.2. Fixing a Bug

1.  **Reproduce**: Understand how to trigger the bug.
2.  **Identify Cause**: Debug to find the root cause.
3.  **Implement Fix**: Correct the code.
4.  **Test**:
    - Write a new test that specifically covers the bug (to prevent regressions).
    - Ensure all existing tests still pass.

### 8.3. Refactoring Code

1.  **Understand Purpose**: Why is the refactor needed (e.g., improve readability, performance, maintainability)?
2.  **Ensure Test Coverage**: Before refactoring, make sure the code is well-tested.
3.  **Refactor Incrementally**: Make small, verifiable changes.
4.  **Re-run Tests**: Ensure all tests pass after each increment.

## 9. Future Enhancements & Project Roadmap

(This section remains for context)

- Multi-user support with database storage
- Advanced calendar features (recurring events, attachments)
- Integration with other calendar providers
- Mobile app development
- Advanced AI features (smart scheduling, conflict resolution)
- Additional tool categories (email, file, web, weather, etc.)
- Enhanced agentic reasoning capabilities
- Multi-modal AI integration

## 10. Troubleshooting & Getting Help

(This section remains for context)

### Common Issues

1. **Google Calendar API Errors**

   - Ensure the Calendar API is enabled in Google Cloud Console
   - Check your OAuth2 credentials and redirect URIs
   - Verify the user has granted calendar permissions

2. **OpenAI API Errors**

   - Check your API key is valid and has sufficient credits
   - Ensure you're using the correct model (gpt-4o, gpt-4.1-mini-2025-04-14, gpt-4.1, gpt-4.1-mini, o3, or o3-mini)

3. **Authentication Issues**
   - Verify NEXTAUTH_SECRET is set
   - Check NEXTAUTH_URL matches your domain
   - Ensure Google OAuth2 credentials are correct

### Getting Help

If you encounter issues:

1. Check the browser console for errors
2. Review the server logs
3. Verify environment variables are set correctly
4. Check API credentials and permissions

---

**Copilot, by following these guidelines, you will be an invaluable asset to the CalendarGPT project. Let's build something great!**

## X. How to Answer User's Questions in Copilot Chat

When interacting with users in GitHub Copilot Chat, follow these optimized LLM guidelines:

1. **Confirm Understanding & Summarize**: Always begin by restating the user's request in your own words and ask for confirmation.
2. **Present an Implementation Plan**: Once the user approves, provide a detailed plan outlining what you will develop and how you will integrate it.
3. **Leverage Existing Features**: Prioritize reusing and extending current components, tools, and services instead of duplicating functionality.
4. **Maintain Backward Compatibility**: When coding, ensure existing features remain intact and your changes work seamlessly with the current application.
5. **Iterate Code with Validation**: After completing implementation, check the VS Code Problems panel for any new errors or warnings before finalizing.

_Feel free to adapt language for clarity and brevity, but keep instructions explicit for the LLM._
