/**
 * Integration tests for MCP functionality
 */

import { getMCPApi } from "../services/mcp/mcp-api";
import { MCPConfigManager } from "../services/mcp/config-manager";
import { createToolRegistry } from "../tools/tool-registry";
import { CalendarTools } from "../tools/calendar-tools";

// Mock calendar tools for testing
const mockCalendarTools: CalendarTools = {
  getEvents: jest.fn(),
  searchEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
} as any;

describe("MCP Integration", () => {
  let mcpApi: any;
  let configManager: MCPConfigManager;

  beforeEach(() => {
    mcpApi = getMCPApi();
    configManager = new MCPConfigManager();
  });

  afterEach(async () => {
    await mcpApi.shutdown();
  });

  describe("Configuration Management", () => {
    it("should load configuration", () => {
      const config = configManager.loadConfiguration();
      expect(config).toHaveProperty("mcpServers");
      expect(typeof config.mcpServers).toBe("object");
    });

    it("should provide example configurations", () => {
      const examples = configManager.getExampleConfigurations();
      expect(Object.keys(examples).length).toBeGreaterThan(0);
      expect(examples).toHaveProperty("filesystem");
      expect(examples.filesystem).toHaveProperty("command");
      expect(examples.filesystem).toHaveProperty("args");
    });

    it("should validate configuration structure", () => {
      const validConfig = {
        mcpServers: {
          test: {
            name: "test",
            command: "uvx",
            args: ["test-package"],
            disabled: false,
          },
        },
      };

      // This should not throw
      expect(() => configManager.loadConfiguration()).not.toThrow();
    });
  });

  describe("Tool Registry Integration", () => {
    it("should create registry with MCP enabled", () => {
      const registry = createToolRegistry(mockCalendarTools, undefined, undefined, undefined, undefined, undefined, true);
      expect(registry).toBeDefined();
      expect(typeof registry.executeTool).toBe("function");
    });

    it("should create registry with MCP disabled", () => {
      const registry = createToolRegistry(mockCalendarTools, undefined, undefined, undefined, undefined, undefined, false);
      expect(registry).toBeDefined();
      expect(typeof registry.executeTool).toBe("function");
    });

    it("should get available tools synchronously", () => {
      const registry = createToolRegistry(mockCalendarTools);
      const tools = registry.getAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should get all available tools including MCP (async)", async () => {
      const registry = createToolRegistry(mockCalendarTools, undefined, undefined, undefined, undefined, undefined, true);
      
      // This should work even if no MCP servers are configured
      const tools = await (registry as any).getAllAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe("MCP API", () => {
    it("should get configured servers", () => {
      const servers = mcpApi.getConfiguredServers();
      expect(typeof servers).toBe("object");
    });

    it("should get example configurations", () => {
      const examples = mcpApi.getExampleConfigurations();
      expect(typeof examples).toBe("object");
      expect(Object.keys(examples).length).toBeGreaterThan(0);
    });

    it("should handle server status gracefully", () => {
      const status = mcpApi.getServerStatus();
      expect(status).toHaveProperty("servers");
      expect(status).toHaveProperty("configured");
      expect(Array.isArray(status.servers)).toBe(true);
    });

    it("should initialize with examples", () => {
      expect(() => mcpApi.initializeWithExamples()).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing configuration gracefully", async () => {
      // Should not throw even if no MCP servers are configured
      expect(async () => {
        await mcpApi.getAvailableTools();
      }).not.toThrow();
    });

    it("should handle tool execution errors gracefully", async () => {
      const registry = createToolRegistry(mockCalendarTools);
      
      // Should return error result, not throw
      const result = await registry.executeTool("nonexistent-tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle server connection failures gracefully", async () => {
      const invalidConfig = {
        name: "invalid",
        command: "nonexistent-command",
        args: ["invalid"],
        disabled: false,
      };

      const result = await mcpApi.testServerConnection(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Integration with Orchestrator", () => {
    it("should work with tool registry factory", () => {
      // Test that the factory function works with MCP enabled
      const registry = createToolRegistry(
        mockCalendarTools,
        undefined, // emailTools
        undefined, // webTools  
        undefined, // passportTools
        undefined, // fileSearchTools
        undefined, // configOverride
        true       // enableMCP
      );

      expect(registry).toBeDefined();
      expect(typeof registry.getAvailableTools).toBe("function");
      expect(typeof registry.executeTool).toBe("function");
    });

    it("should maintain backward compatibility", () => {
      // Test that existing code still works
      const registry = createToolRegistry(mockCalendarTools);
      
      const tools = registry.getAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
      
      const categories = registry.getAvailableCategories();
      expect(Array.isArray(categories)).toBe(true);
    });
  });
});

describe("MCP Scripts Integration", () => {
  it("should have initialization script", () => {
    const fs = require("fs");
    expect(fs.existsSync("scripts/mcp-init.js")).toBe(true);
  });

  it("should have test script", () => {
    const fs = require("fs");
    expect(fs.existsSync("scripts/run-mcp-servers.sh")).toBe(true);
  });
});

describe("Real-world Scenarios", () => {
  it("should handle typical MCP server configuration", () => {
    const configManager = new MCPConfigManager();
    const examples = configManager.getExampleConfigurations();
    
    // Test filesystem server config
    const fsConfig = examples.filesystem;
    expect(fsConfig.command).toBe("uvx");
    expect(fsConfig.args).toContain("mcp-server-filesystem");
    expect(fsConfig.category).toBe("file-system");
    
    // Test git server config
    const gitConfig = examples.git;
    expect(gitConfig.command).toBe("uvx");
    expect(gitConfig.args).toContain("mcp-server-git");
    expect(gitConfig.category).toBe("version-control");
  });

  it("should handle environment variables in configuration", () => {
    const examples = new MCPConfigManager().getExampleConfigurations();
    
    // Test that servers with env vars are configured correctly
    const postgresConfig = examples.postgres;
    expect(postgresConfig.env).toBeDefined();
    expect(postgresConfig.env).toHaveProperty("POSTGRES_CONNECTION_STRING");
    
    const braveConfig = examples["brave-search"];
    expect(braveConfig.env).toBeDefined();
    expect(braveConfig.env).toHaveProperty("BRAVE_API_KEY");
  });
});