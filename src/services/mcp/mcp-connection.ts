/**
 * Real MCP server connection implementation using @modelcontextprotocol/sdk
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPServerConnection, MCPServerConfig, MCPTool, MCPToolResult } from "./types";

export class RealMCPServerConnection implements MCPServerConnection {
  name: string;
  config: MCPServerConfig;
  isConnected = false;
  tools: MCPTool[] = [];
  lastError?: string;
  
  private client?: Client;
  private transport?: StdioClientTransport;

  constructor(name: string, config: MCPServerConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      // Create transport for the MCP server process
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: {
          ...process.env,
          ...this.config.env,
        },
      });

      // Create MCP client
      this.client = new Client(
        {
          name: `orchestrator-client-${this.name}`,
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Connect to the server
      await this.client.connect(this.transport);
      
      // List available tools
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools.map(tool => ({
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema as any,
        serverName: this.name,
      }));

      this.isConnected = true;
      this.lastError = undefined;
      
      console.log(`✅ Connected to MCP server '${this.name}' with ${this.tools.length} tools`);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.isConnected = false;
      console.error(`❌ Failed to connect to MCP server '${this.name}':`, this.lastError);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
      if (this.transport) {
        await this.transport.close();
      }
      
      this.isConnected = false;
      this.tools = [];
      this.client = undefined;
      this.transport = undefined;
      
      console.log(`🔌 Disconnected from MCP server '${this.name}'`);
    } catch (error) {
      console.error(`⚠️ Error disconnecting from MCP server '${this.name}':`, error);
    }
  }

  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    if (!this.client || !this.isConnected) {
      throw new Error(`MCP server '${this.name}' is not connected`);
    }

    try {
      const response = await this.client.callTool({
        name,
        arguments: args,
      });

      return {
        content: response.content || [],
        isError: response.isError || false,
      };
    } catch (error) {
      console.error(`❌ MCP tool '${name}' execution failed on server '${this.name}':`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool '${name}': ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }
}