/**
 * MCP (Model Context Protocol) integration exports
 */

export { MCPServerManager } from "./server-manager";
export { MCPConfigManager } from "./config-manager";
export * from "./types";

import { MCPServerManager } from "./server-manager";

// Global MCP manager instance
let globalMCPManager: MCPServerManager | null = null;

/**
 * Get or create the global MCP manager instance
 */
export async function getMCPManager(): Promise<MCPServerManager> {
  if (!globalMCPManager) {
    globalMCPManager = new MCPServerManager();
    await globalMCPManager.initializeServers();
  }
  return globalMCPManager;
}

/**
 * Shutdown the global MCP manager
 */
export async function shutdownMCP(): Promise<void> {
  if (globalMCPManager) {
    await globalMCPManager.shutdown();
    globalMCPManager = null;
  }
}

/**
 * Reload MCP configuration and reconnect servers
 */
export async function reloadMCP(): Promise<void> {
  if (globalMCPManager) {
    await globalMCPManager.reload();
  } else {
    globalMCPManager = new MCPServerManager();
    await globalMCPManager.initializeServers();
  }
}