# GitHub Copilot Interaction Protocol: AI Calendar Assistant

**Your primary objective is to generate high-quality, tested code that strictly adheres to the project's architecture and standards defined in the `.github/copilot/instructions.md` file.**

Follow this workflow for every user request:

1.  **Analyze & Clarify:**

    - First, analyze the user's request and the existing codebase using your `#codebase` tool.
    - If the request is complex or ambiguous, ask clarifying questions before proceeding.

2.  **Plan Ahead:**

    - Before writing any code, present a concise, step-by-step implementation plan.
    - Mention which files you will create or modify.
    - **Identify if any documentation in the `docs/` folder or prompts in `.github/prompts/` need updating as part of your plan.**
    - Use your web search tool to find up-to-date information on any libraries or APIs involved.
    - **Wait for user approval of the plan before executing.**

3.  **Execute Step-by-Step:**

    - Implement the plan one step at a time.
    - After each significant code generation, briefly state what you did and what the next step is.
    - Always reference the existing code and the project's instructions to ensure consistency.

4.  **Test Everything:**
    - Generating tests is **mandatory**. For any new function, component, or tool you create, you must also generate corresponding tests following the project's testing guidelines.

### How to Approach Common Tasks

- **Adding a New Feature:** Plan the UI components, API endpoints, service logic, and any new agentic tools. Define types first, then implement, and finally write tests.
- **Fixing a Bug:** First, write a failing test that reproduces the bug. Then, implement the fix. Finally, ensure all tests pass.
- **Refactoring Code:** Ensure the code to be refactored has adequate test coverage _before_ you begin. Make small, incremental changes and run tests after each change.
