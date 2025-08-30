import * as fs from "fs";
import * as path from "path";
import {
  MCPConfiguration,
  MCPServerConfig,
  MCPServerConnection,
  MCPTool,
  MCPToolResult,
} from "./types";

/**
 * Manages MCP server connections and configurations
 */
export class MCPServerManager {
  private servers = new Map<string, MCPServerConnection>();
  private config: MCPConfiguration | null = null;

  constructor() {
    this.loadConfiguration();
  }

  /**
   * Load MCP configuration from workspace and user settings
   */
  private loadConfiguration(): void {
    try {
      // Try workspace config first
      const workspaceConfigPath = path.resolve(
        process.cwd(),
        ".kiro/settings/mcp.json"
      );
      let workspaceConfig: MCPConfiguration = { mcpServers: {} };

      if (fs.existsSync(workspaceConfigPath)) {
        const content = fs.readFileSync(workspaceConfigPath, "utf-8");
        workspaceConfig = JSON.parse(content);
      }

      // Try user config
      const userConfigPath = path.resolve(
        process.env.HOME || "~",
        ".kiro/settings/mcp.json"
      );
      let userConfig: MCPConfiguration = { mcpServers: {} };

      if (fs.existsSync(userConfigPath)) {
        const content = fs.readFileSync(userConfigPath, "utf-8");
        userConfig = JSON.parse(content);
      }

      // Merge configs with workspace taking precedence
      this.config = {
        mcpServers: {
          ...userConfig.mcpServers,
          ...workspaceConfig.mcpServers,
        },
      };

      console.log(
        `Loaded MCP configuration with ${
          Object.keys(this.config.mcpServers).length
        } servers`
      );
    } catch (error) {
      console.warn("Failed to load MCP configuration:", error);
      this.config = { mcpServers: {} };
    }
  }

  /**
   * Get all configured MCP servers
   */
  getConfiguredServers(): Record<string, MCPServerConfig> {
    return this.config?.mcpServers || {};
  }

  /**
   * Get enabled MCP servers (not disabled)
   */
  getEnabledServers(): Record<string, MCPServerConfig> {
    const servers = this.getConfiguredServers();
    return Object.fromEntries(
      Object.entries(servers).filter((entry) => !entry[1].disabled)
    );
  }

  /**
   * Initialize connections to all enabled MCP servers
   */
  async initializeServers(): Promise<void> {
    const enabledServers = this.getEnabledServers();

    const connectionPromises = Object.entries(enabledServers).map(
      async ([name, config]) => {
        try {
          const connection = await this.createServerConnection(name, config);
          await connection.connect();
          this.servers.set(name, connection);
          console.log(`✅ Connected to MCP server: ${name}`);
        } catch (error) {
          console.error(`❌ Failed to connect to MCP server ${name}:`, error);
        }
      }
    );

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Create a server connection instance
   */
  private async createServerConnection(
    name: string,
    config: MCPServerConfig
  ): Promise<MCPServerConnection> {
    // Use real MCP connection implementation
    const { RealMCPServerConnection } = await import("./mcp-connection");
    return new RealMCPServerConnection(name, config);
  }

  /**
   * Get all available tools from connected MCP servers
   */
  async getAllMCPTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    for (const [serverName, connection] of Array.from(this.servers.entries())) {
      if (connection.isConnected) {
        try {
          const serverTools = await connection.listTools();
          tools.push(...serverTools);
        } catch (error) {
          console.error(
            `Failed to get tools from MCP server ${serverName}:`,
            error
          );
        }
      }
    }

    return tools;
  }

  /**
   * Execute a tool on the appropriate MCP server
   */
  async executeMCPTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    for (const [serverName, connection] of Array.from(this.servers.entries())) {
      if (
        connection.isConnected &&
        connection.tools.some((t) => t.name === toolName)
      ) {
        try {
          return await connection.callTool(toolName, args);
        } catch (error) {
          console.error(
            `Failed to execute MCP tool ${toolName} on server ${serverName}:`,
            error
          );
          throw error;
        }
      }
    }

    throw new Error(`MCP tool '${toolName}' not found on any connected server`);
  }

  /**
   * Disconnect all servers
   */
  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.servers.values()).map(
      (connection) => connection.disconnect()
    );

    await Promise.allSettled(disconnectPromises);
    this.servers.clear();
  }

  /**
   * Reload configuration and reconnect servers
   */
  async reload(): Promise<void> {
    await this.shutdown();
    this.loadConfiguration();
    await this.initializeServers();
  }
}

/**
 * Mock MCP server connection for development/testing
 * Replace this with actual MCP client implementation
 */
export class MockMCPServerConnection implements MCPServerConnection {
  name: string;
  config: MCPServerConfig;
  isConnected = false;
  tools: MCPTool[] = [];
  lastError?: string;

  constructor(name: string, config: MCPServerConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    // Mock connection logic
    this.isConnected = true;
    this.tools = [
      {
        name: `${this.name}_example_tool`,
        description: `Example tool from ${this.name} MCP server`,
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Query parameter" },
          },
          required: ["query"],
        },
        serverName: this.name,
      },
    ];
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.tools = [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    // Mock tool execution
    return {
      content: [
        {
          type: "text",
          text: `Mock response from ${name} with args: ${JSON.stringify(args)}`,
        },
      ],
    };
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }
}
