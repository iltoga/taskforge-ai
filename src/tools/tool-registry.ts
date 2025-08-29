import * as fs from "fs";
import * as path from "path";
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
import { getMCPApi } from "../services/mcp/mcp-api";
import { MCPTool } from "../services/mcp/types";

// Base interfaces for tools
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<unknown>;
  category: string;
  source?: "internal" | "mcp";
  serverName?: string; // For MCP tools
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
  private enableMCP: boolean;
  private mcpCategoriesCache: string[] = [];
  private mcpToolsCache: ToolDefinition[] = [];
  private lastMCPUpdate = 0;
  private readonly MCP_CACHE_TTL = 30000; // 30 seconds

  constructor(enableMCP = true) {
    this.enableMCP = enableMCP;
    // Initialize MCP cache in background
    if (this.enableMCP) {
      this.refreshMCPCache().catch(error => {
        console.warn("Failed to initialize MCP cache:", error);
      });
    }
  }

  registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
  }

  getAvailableTools(): ToolDefinition[] {
    // Get internal tools
    const internalTools = Array.from(this.tools.values()).map((tool) => tool.definition);
    
    // Add cached MCP tools if available and not stale
    if (this.enableMCP && this.isMCPCacheValid()) {
      return [...internalTools, ...this.mcpToolsCache];
    }
    
    return internalTools;
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
    // Get internal tool categories
    const categories = new Set<string>();
    this.tools.forEach((tool) => categories.add(tool.definition.category));
    
    // Add cached MCP categories if available and not stale
    if (this.enableMCP && this.isMCPCacheValid()) {
      this.mcpCategoriesCache.forEach(category => categories.add(category));
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Get all available tools including MCP tools (async)
   */
  async getAllAvailableTools(): Promise<ToolDefinition[]> {
    // Get internal tools
    const internalTools = Array.from(this.tools.values()).map((tool) => tool.definition);
    
    // Refresh MCP cache if needed
    if (this.enableMCP && !this.isMCPCacheValid()) {
      await this.refreshMCPCache();
    }
    
    return [...internalTools, ...this.mcpToolsCache];
  }

  /**
   * Get all available categories including MCP categories (async)
   */
  async getAllAvailableCategories(): Promise<string[]> {
    // Get categories from internal tools
    const categories = new Set<string>();
    this.tools.forEach((tool) => categories.add(tool.definition.category));
    
    // Add MCP categories
    if (this.enableMCP) {
      try {
        const mcpApi = getMCPApi();
        const mcpTools = await mcpApi.getAvailableTools();
        mcpTools.forEach((tool) => {
          const category = this.getMCPToolCategory(tool);
          categories.add(category);
        });
      } catch (error) {
        console.warn("Failed to get MCP tool categories:", error);
      }
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Convert MCP tool to internal ToolDefinition format
   */
  private convertMCPToolToDefinition(mcpTool: MCPTool): ToolDefinition {
    return {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: this.jsonSchemaToZod(mcpTool.inputSchema),
      category: this.getMCPToolCategory(mcpTool),
      source: "mcp",
      serverName: mcpTool.serverName,
    };
  }

  /**
   * Convert MCP result to internal ToolResult format
   */
  private convertMCPResultToToolResult(mcpResult: any): ToolResult {
    if (mcpResult.isError) {
      return {
        success: false,
        error: mcpResult.content?.[0]?.text || "MCP tool execution failed",
      };
    }

    // Extract text content from MCP result
    const textContent = mcpResult.content
      ?.filter((item: any) => item.type === "text")
      ?.map((item: any) => item.text)
      ?.join("\n");

    return {
      success: true,
      data: textContent || mcpResult,
      message: "MCP tool executed successfully",
    };
  }

  /**
   * Get category for MCP tool (could be enhanced with server-specific mapping)
   */
  private getMCPToolCategory(mcpTool: MCPTool): string {
    // You could implement more sophisticated category mapping here
    // For now, use server name as category
    return `mcp-${mcpTool.serverName}`;
  }

  /**
   * Convert JSON Schema to Zod schema (simplified implementation)
   */
  private jsonSchemaToZod(schema: any): z.ZodSchema<unknown> {
    if (schema.type === "object") {
      const shape: Record<string, z.ZodSchema<unknown>> = {};
      
      for (const [key, prop] of Object.entries(schema.properties || {})) {
        const propSchema = prop as any;
        let zodSchema: z.ZodSchema<unknown>;
        
        switch (propSchema.type) {
          case "string":
            zodSchema = z.string();
            break;
          case "number":
            zodSchema = z.number();
            break;
          case "boolean":
            zodSchema = z.boolean();
            break;
          case "array":
            zodSchema = z.array(z.unknown());
            break;
          default:
            zodSchema = z.unknown();
        }
        
        if (propSchema.description) {
          zodSchema = zodSchema.describe(propSchema.description);
        }
        
        if (!schema.required?.includes(key)) {
          zodSchema = zodSchema.optional();
        }
        
        shape[key] = zodSchema;
      }
      
      return z.object(shape);
    }
    
    return z.unknown();
  }

  /**
   * Check if MCP cache is still valid
   */
  private isMCPCacheValid(): boolean {
    return Date.now() - this.lastMCPUpdate < this.MCP_CACHE_TTL;
  }

  /**
   * Refresh MCP cache in background
   */
  private async refreshMCPCache(): Promise<void> {
    if (!this.enableMCP) return;
    
    try {
      const mcpApi = getMCPApi();
      const mcpToolList = await mcpApi.getAvailableTools();
      
      // Update tools cache
      this.mcpToolsCache = mcpToolList.map(this.convertMCPToolToDefinition.bind(this));
      
      // Update categories cache
      const categories = new Set<string>();
      mcpToolList.forEach((tool) => {
        const category = this.getMCPToolCategory(tool);
        categories.add(category);
      });
      this.mcpCategoriesCache = Array.from(categories);
      
      this.lastMCPUpdate = Date.now();
      console.log(`Updated MCP cache: ${this.mcpToolsCache.length} tools, ${this.mcpCategoriesCache.length} categories`);
    } catch (error) {
      console.warn("Failed to refresh MCP cache:", error);
    }
  }

  /**
   * Force refresh MCP cache
   */
  async refreshMCP(): Promise<void> {
    await this.refreshMCPCache();
  }

  async executeTool(
    name: string,
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    // Try internal tools first
    const tool = this.tools.get(name);
    if (tool) {
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

    // Try MCP tools if not found in internal tools
    if (this.enableMCP) {
      try {
        const mcpApi = getMCPApi();
        const mcpResult = await mcpApi.executeTool(name, parameters);
        return this.convertMCPResultToToolResult(mcpResult);
      } catch (error) {
        // If MCP tool execution fails, fall through to not found error
        console.warn(`MCP tool execution failed for ${name}:`, error);
      }
    }

    return {
      success: false,
      error: `Tool '${name}' not found`,
      message: `Unknown tool: ${name}`,
    };
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
  configOverride?: { [key: string]: boolean },
  enableMCP = true
): ToolRegistry {
  const registry = new DefaultToolRegistry(enableMCP);

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

  // MCP tools are integrated dynamically when enabled
  if (enableMCP) {
    console.log("MCP integration enabled in tool registry");
    // Trigger initial MCP cache refresh in background
    (registry as DefaultToolRegistry).refreshMCP().catch(error => {
      console.warn("Initial MCP refresh failed:", error);
    });
  }

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
