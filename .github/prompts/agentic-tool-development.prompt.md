# Agentic Tool Development Guide

## Overview

This application uses an agentic AI system where tools are the primary interface between the AI and external systems. Follow this guide to properly add, register, and maintain tools in the system.

## Tool Architecture

### Core Components

1. **`ToolOrchestrator`** (`src/services/tool-orchestrator.ts`) - The AI brain that analyzes requests and executes tools
2. **`ToolRegistry`** (`src/tools/tool-registry.ts`) - Central registry where tools are registered
3. **Tool Implementation Classes** (`src/tools/*-tools.ts`) - Business logic for each tool category
4. **Tool Registration Functions** (`src/tools/register-*-tools.ts`) - Modular tool registration
5. **Tool Definitions** (`src/tools/*-tool-definitions.ts`) - Zod schemas for tool parameters

## Step-by-Step Guide: Adding a New Tool Category

### Step 1: Create Tool Implementation Class

Create `src/tools/my-category-tools.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

export interface MyToolInput {
  required_field: string;
  optional_field?: string;
}

export interface MyToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export class MyCategoryTools {
  static category = "my-category";
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async myOperation(data: MyToolInput): Promise<MyToolResult> {
    try {
      // Implementation logic here
      return { success: true, data: result };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

### Step 2: Create Tool Definitions with Zod Schemas

Create `src/tools/my-category-tool-definitions.ts`:

```typescript
import { z } from "zod";

export const MyToolInputSchema = z.object({
  required_field: z.string().describe("Description of required field"),
  optional_field: z
    .string()
    .optional()
    .describe("Description of optional field"),
});

export const MyToolIdSchema = z.object({
  id: z.number().describe("Record ID"),
});

export const MyToolFilterSchema = MyToolInputSchema.partial();
```

### Step 3: Create Tool Registration Function

Create `src/tools/register-my-category-tools.ts`:

```typescript
import { z } from "zod";
import {
  MyToolInputSchema,
  MyToolFilterSchema,
  MyToolIdSchema,
} from "./my-category-tool-definitions";
import { MyCategoryTools } from "./my-category-tools";
import { ToolRegistry } from "./tool-registry";

export function registerMyCategoryTools(
  registry: ToolRegistry,
  tools: MyCategoryTools
) {
  registry.registerTool(
    {
      name: "myOperation",
      description:
        "Detailed description of what this tool does. Use this when...",
      parameters: MyToolInputSchema,
      category: "my-category",
    },
    async (params: Record<string, unknown>) => {
      const validatedParams = params as {
        required_field: string;
        optional_field?: string;
      };

      return tools.myOperation(validatedParams);
    }
  );

  // Add more tools as needed...
}
```

### Step 4: Register in Main Tool Registry

Update `src/tools/tool-registry.ts`:

```typescript
// Add import
import { registerMyCategoryTools } from "./register-my-category-tools";
import { MyCategoryTools } from "./my-category-tools";

// Update createToolRegistry function parameters
export function createToolRegistry(
  calendarTools: CalendarTools,
  emailTools?: EmailTools,
  fileTools?: FileTools,
  webTools?: WebTools,
  passportTools?: PassportTools,
  myCategoryTools?: MyCategoryTools, // Add your tools here
  configOverride?: { [key: string]: boolean }
): ToolRegistry {
  // ... existing code ...

  // Add registration block
  if (myCategoryTools && enabled.myCategory !== false) {
    registerMyCategoryTools(registry, myCategoryTools);
  }

  return registry;
}

// Update loadToolConfiguration default
function loadToolConfiguration(): { [key: string]: boolean } {
  let enabled: { [key: string]: boolean } = {
    calendar: true,
    email: false,
    file: false,
    web: false,
    passport: false,
    myCategory: false, // Add your category here
  };
  // ... rest of function
}
```

### Step 5: Update Tool Orchestrator

Add parameter information in `src/services/tool-orchestrator.ts`:

```typescript
// In getToolParameterInfo method
case 'myOperation':
  return '{ required_field: string (required), optional_field?: string }';
```

Add examples in the tool examples sections:

```typescript
// In generateToolExamples method
if (availableCategories.includes("my-category")) {
  examples += "**MY CATEGORY TOOLS**:\n";
  examples += '- "do something" → Use myOperation with required_field\n\n';
}
```

### Step 6: Add to Settings Configuration

Update `settings/enabled-tools.json`:

```json
{
  "calendar": true,
  "email": false,
  "file": false,
  "web": false,
  "passport": false,
  "myCategory": false
}
```

### Step 7: Write Tests

Create `src/__tests__/my-category-tools.test.ts`:

```typescript
import { MyCategoryTools } from "../tools/my-category-tools";

describe("MyCategoryTools", () => {
  let tools: MyCategoryTools;

  beforeEach(() => {
    tools = new MyCategoryTools();
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  it("should perform myOperation successfully", async () => {
    const result = await tools.myOperation({ required_field: "test" });
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

### 1. Parameter Validation

- Always use Zod schemas for parameter validation
- Include descriptive `.describe()` calls for AI guidance
- Handle both required and optional parameters properly

### 2. Error Handling

- Always return consistent `ToolResult` objects
- Catch all errors and return meaningful error messages
- Don't throw exceptions from tool methods

### 3. Date Handling

- Use ISO date strings in schemas (`YYYY-MM-DD` or full ISO datetime)
- Convert string dates to Date objects when needed for database operations
- Be consistent with timezone handling

### 4. Type Safety

- Define proper TypeScript interfaces for inputs and outputs
- Use type assertions carefully and validate parameters
- Avoid `any` types where possible

### 5. Documentation

- Provide clear, descriptive tool descriptions
- Include usage examples in the orchestrator
- Document what each tool does and when to use it

### 6. Testing

- Write comprehensive unit tests for all tool methods
- Test both success and error scenarios
- Include integration tests for complex workflows

## Example: Passport Tools Implementation

The passport tools serve as a good example of this pattern:

1. **Implementation**: `src/tools/passport-tools.ts`
2. **Definitions**: `src/tools/passport-tool-definitions.ts`
3. **Registration**: `src/tools/register-passport-tools.ts`
4. **Integration**: Used in `src/tools/tool-registry.ts`
5. **Tests**: `src/__tests__/functional/passport-orchestrator.test.ts`

## Common Pitfalls to Avoid

1. **Don't inline tool registration** - Use the modular registration pattern
2. **Don't forget date conversion** - Convert string dates to Date objects for database operations
3. **Don't skip parameter descriptions** - The AI needs these for proper tool usage
4. **Don't ignore error handling** - Always return consistent error responses
5. **Don't forget to enable tools** - Update the settings configuration
6. **Don't skip tests** - Tool functionality must be thoroughly tested

## Debugging Tools

- Check tool registration: Look in browser dev tools for tool definitions sent to AI
- Verify parameters: Use console logs in the orchestrator to see what parameters are sent
- Test isolation: Create unit tests that call tool methods directly
- Integration testing: Use functional tests that test the full orchestration flow
