/**
 * API for managing MCP servers
 */

import { MCPConfigManager } from "./config-manager";
import { MCPServerManager } from "./server-manager";
import { MCPServerConfig } from "./types";

export class MCPApi {
  private configManager: MCPConfigManager;
  private serverManager: MCPServerManager;

  constructor() {
    this.configManager = new MCPConfigManager();
    this.serverManager = new MCPServerManager();
  }

  /**
   * Initialize MCP system
   */
  async initialize(): Promise<void> {
    await this.serverManager.initializeServers();
  }

  /**
   * Shutdown MCP system
   */
  async shutdown(): Promise<void> {
    await this.serverManager.shutdown();
  }

  /**
   * Get all configured servers
   */
  getConfiguredServers(): Record<string, MCPServerConfig> {
    return this.configManager.loadConfiguration().mcpServers;
  }

  /**
   * Add or update a server configuration
   */
  async addServer(name: string, config: MCPServerConfig): Promise<void> {
    this.configManager.addOrUpdateServer(name, config);
    
    // Reload servers to pick up the new configuration
    await this.serverManager.reload();
  }

  /**
   * Remove a server configuration
   */
  async removeServer(name: string): Promise<void> {
    this.configManager.removeServer(name);
    
    // Reload servers to remove the server
    await this.serverManager.reload();
  }

  /**
   * Enable/disable a server
   */
  async toggleServer(name: string, enabled: boolean): Promise<void> {
    const config = this.configManager.loadConfiguration();
    const serverConfig = config.mcpServers[name];
    
    if (!serverConfig) {
      throw new Error(`Server '${name}' not found`);
    }
    
    serverConfig.disabled = !enabled;
    this.configManager.addOrUpdateServer(name, serverConfig);
    
    // Reload servers to apply the change
    await this.serverManager.reload();
  }

  /**
   * Get server status
   */
  getServerStatus() {
    const enabledServers = this.serverManager.getEnabledServers();
    return {
      configured: Object.keys(this.configManager.loadConfiguration().mcpServers).length,
      enabled: Object.keys(enabledServers).length,
      servers: Object.entries(enabledServers).map(([name, config]) => ({
        name,
        enabled: !config.disabled,
        description: config.description || "No description",
      })),
    };
  }

  /**
   * Get all available tools from MCP servers
   */
  async getAvailableTools() {
    return await this.serverManager.getAllMCPTools();
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(toolName: string, args: Record<string, any>) {
    return await this.serverManager.executeMCPTool(toolName, args);
  }

  /**
   * Test connection to a server configuration
   */
  async testServerConnection(config: MCPServerConfig): Promise<{
    success: boolean;
    error?: string;
    tools?: string[];
  }> {
    try {
      const { RealMCPServerConnection } = await import("./mcp-connection");
      const connection = new RealMCPServerConnection("test", config);
      
      await connection.connect();
      const tools = await connection.listTools();
      await connection.disconnect();
      
      return {
        success: true,
        tools: tools.map(t => t.name),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get example configurations for popular MCP servers
   */
  getExampleConfigurations(): Record<string, MCPServerConfig> {
    return this.configManager.getExampleConfigurations();
  }

  /**
   * Initialize with example configuration if no config exists
   */
  initializeWithExamples(): void {
    this.configManager.initializeWithExamples();
  }
}

// Global MCP API instance
let globalMCPApi: MCPApi | null = null;

/**
 * Get or create the global MCP API instance
 */
export function getMCPApi(): MCPApi {
  if (!globalMCPApi) {
    globalMCPApi = new MCPApi();
  }
  return globalMCPApi;
}

/**
 * Initialize the global MCP API
 */
export async function initializeMCP(): Promise<void> {
  const api = getMCPApi();
  await api.initialize();
}

/**
 * Shutdown the global MCP API
 */
export async function shutdownMCP(): Promise<void> {
  if (globalMCPApi) {
    await globalMCPApi.shutdown();
    globalMCPApi = null;
  }
}