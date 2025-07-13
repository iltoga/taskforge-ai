import fs from "fs";
import path from "path";
import { z } from "zod";
import { CalendarTools } from "./calendar-tools";
import { EmailTools } from "./email-tools";
import { FileSearchTools } from "./file-search-tools";
import { PassportTools } from "./passport-tools";
import { registerCalendarTools } from "./register-calendar-tools";
import { registerEmailTools } from "./register-email-tools";
import { registerFileSearchTools } from "./register-file-search-tools";
import { registerPassportTools } from "./register-passport-tools";
import { registerSynthesisTools } from "./register-synthesis-tools";
import { registerWebTools } from "./register-web-tools";
import { WebTools } from "./web-tools";

// Base interfaces for tools
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<unknown>;
  category: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

export interface ToolExecution {
  tool: string;
  parameters: Record<string, unknown>;
  result: ToolResult;
  startTime: number;
  endTime: number;
  duration: number;
}

// Tool registry interface
export interface ToolRegistry {
  registerTool(definition: ToolDefinition, executor: ToolExecutor): void;
  getAvailableTools(): ToolDefinition[];
  getToolDefinition(name: string): ToolDefinition | undefined;
  executeTool(
    name: string,
    parameters: Record<string, unknown>
  ): Promise<ToolResult>;
  getToolsByCategory(category: string): ToolDefinition[];
  getAvailableCategories(): string[];
}

export type ToolExecutor = (
  parameters: Record<string, unknown>
) => Promise<ToolResult>;

// Implementation of the tool registry
export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<
    string,
    { definition: ToolDefinition; executor: ToolExecutor }
  >();

  registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
  }

  getAvailableTools(): ToolDefinition[] {
    // Only return tools that are actually registered (and thus enabled)
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  getToolDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((tool) => tool.definition.category === category)
      .map((tool) => tool.definition);
  }

  getAvailableCategories(): string[] {
    // Only return categories for registered/enabled tools
    const categories = new Set<string>();
    this.tools.forEach((tool) => categories.add(tool.definition.category));
    return Array.from(categories).sort();
  }

  async executeTool(
    name: string,
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        message: `Unknown tool: ${name}`,
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.definition.parameters.parse(parameters);

      // Execute the tool
      return await tool.executor(validatedParams as Record<string, unknown>);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to execute tool: ${name}`,
      };
    }
  }
}

// Load tool configuration from settings
export function loadToolConfiguration(): { [key: string]: boolean } {
  let enabled: { [key: string]: boolean } = {
    calendar: true,
    email: false,
    web: false,
    passport: false,
    "file-search": false,
  };
  try {
    const configPath = path.resolve(
      process.cwd(),
      "settings/enabled-tools-categories.json"
    );
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf-8");
      enabled = JSON.parse(configContent);
    }
  } catch (err) {
    // Fallback to all enabled if config missing or invalid
    console.warn(
      "Could not load enabled-tools-categories.json, defaulting to all enabled:",
      err
    );
  }
  return enabled;
}

// Factory function to create and configure a tool registry
export function createToolRegistry(
  calendarTools: CalendarTools,
  emailTools?: EmailTools,
  webTools?: WebTools,
  passportTools?: PassportTools,
  fileSearchTools?: FileSearchTools,
  configOverride?: { [key: string]: boolean }
): ToolRegistry {
  const registry = new DefaultToolRegistry();

  // Load enabled tool categories from settings/enabled-tools-categories.json or use override
  const enabled = configOverride || loadToolConfiguration();

  // Only register tools for enabled categories
  if (enabled.calendar) {
    registerCalendarTools(registry, calendarTools);
  }
  if (emailTools && enabled.email) {
    registerEmailTools(registry, emailTools);
  }
  if (webTools && enabled.web) {
    registerWebTools(registry, webTools);
  }
  if (passportTools && enabled.passport) {
    registerPassportTools(registry, passportTools);
  }
  if (fileSearchTools && enabled["file-search"]) {
    registerFileSearchTools(registry, fileSearchTools);
  }

  // Register synthesis tools (always enabled for orchestration)
  registerSynthesisTools(registry);

  return registry;
}

// Helper function to convert tool definitions to AI function call format
export function toolDefinitionsToAIFunctions(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "object",
      properties: zodSchemaToJsonSchema(tool.parameters),
      required: getRequiredProperties(tool.parameters),
    },
  }));
}

// Helper function to convert Zod schema to JSON schema (simplified)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodSchemaToJsonSchema(schema: z.ZodSchema<any>): any {
  // This is a simplified conversion - in a production app you might want to use
  // a library like zod-to-json-schema for more complete conversion
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = {};

    for (const [key, value] of Object.entries(shape)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties[key] = zodSchemaToJsonSchema(value as z.ZodSchema<any>);
    }

    return {
      type: "object",
      properties,
    };
  } else if (schema instanceof z.ZodString) {
    return { type: "string", description: schema.description };
  } else if (schema instanceof z.ZodNumber) {
    return { type: "number", description: schema.description };
  } else if (schema instanceof z.ZodBoolean) {
    return { type: "boolean", description: schema.description };
  } else if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: zodSchemaToJsonSchema(schema.element as z.ZodType<any, any, any>),
      description: schema.description,
    };
  } else if (schema instanceof z.ZodOptional) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return zodSchemaToJsonSchema(schema.unwrap() as z.ZodType<any, any, any>);
  } else if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema.options,
      description: schema.description,
    };
  }

  return { type: "string" }; // fallback
}

// Helper function to get required properties from Zod schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRequiredProperties(schema: z.ZodSchema<any>): string[] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return required;
  }

  return [];
}
