/**
 * Types for Model Context Protocol (MCP) server integration
 */

export interface MCPServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    disabled?: boolean;
    autoApprove?: string[];
    category?: string;
    description?: string;
}

export interface MCPConfiguration {
    mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
    serverName: string;
}

export interface MCPToolResult {
    content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

export interface MCPServerConnection {
    name: string;
    config: MCPServerConfig;
    isConnected: boolean;
    tools: MCPTool[];
    lastError?: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    callTool(name: string, args: Record<string, any>): Promise<MCPToolResult>;
    listTools(): Promise<MCPTool[]>;
}