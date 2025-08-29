import * as fs from "fs";
import * as path from "path";
import { MCPConfiguration, MCPServerConfig } from "./types";

/**
 * Manages MCP configuration files
 */
export class MCPConfigManager {
  private workspaceConfigPath: string;
  private userConfigPath: string;

  constructor() {
    this.workspaceConfigPath = path.resolve(process.cwd(), ".kiro/settings/mcp.json");
    this.userConfigPath = path.resolve(process.env.HOME || "~", ".kiro/settings/mcp.json");
  }

  /**
   * Load merged configuration from workspace and user settings
   */
  loadConfiguration(): MCPConfiguration {
    const userConfig = this.loadConfigFile(this.userConfigPath);
    const workspaceConfig = this.loadConfigFile(this.workspaceConfigPath);

    // Merge with workspace taking precedence
    return {
      mcpServers: {
        ...userConfig.mcpServers,
        ...workspaceConfig.mcpServers,
      },
    };
  }

  /**
   * Load configuration from a specific file
   */
  private loadConfigFile(filePath: string): MCPConfiguration {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load MCP config from ${filePath}:`, error);
    }
    
    return { mcpServers: {} };
  }

  /**
   * Save configuration to workspace settings
   */
  saveWorkspaceConfiguration(config: MCPConfiguration): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.workspaceConfigPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.workspaceConfigPath, JSON.stringify(config, null, 2));
      console.log("MCP workspace configuration saved");
    } catch (error) {
      console.error("Failed to save MCP workspace configuration:", error);
      throw error;
    }
  }

  /**
   * Add or update a server configuration
   */
  addOrUpdateServer(name: string, config: MCPServerConfig, workspace = true): void {
    const currentConfig = this.loadConfiguration();
    currentConfig.mcpServers[name] = config;

    if (workspace) {
      // Only save the new/updated server to workspace config
      const workspaceConfig = this.loadConfigFile(this.workspaceConfigPath);
      workspaceConfig.mcpServers[name] = config;
      this.saveWorkspaceConfiguration(workspaceConfig);
    } else {
      // Save to user config (implementation would be similar)
      throw new Error("User config modification not implemented yet");
    }
  }

  /**
   * Remove a server configuration
   */
  removeServer(name: string, workspace = true): void {
    if (workspace) {
      const workspaceConfig = this.loadConfigFile(this.workspaceConfigPath);
      delete workspaceConfig.mcpServers[name];
      this.saveWorkspaceConfiguration(workspaceConfig);
    } else {
      throw new Error("User config modification not implemented yet");
    }
  }

  /**
   * Get example configuration for common MCP servers
   */
  getExampleConfigurations(): Record<string, MCPServerConfig> {
    return {
      "filesystem": {
        name: "filesystem",
        command: "uvx",
        args: ["mcp-server-filesystem", "/path/to/allowed/directory"],
        description: "File system operations",
        category: "file-system",
        disabled: false,
        autoApprove: ["read_file", "list_directory"]
      },
      "git": {
        name: "git",
        command: "uvx",
        args: ["mcp-server-git", "--repository", "/path/to/repo"],
        description: "Git repository operations",
        category: "version-control",
        disabled: false,
        autoApprove: ["git_status", "git_log"]
      },
      "postgres": {
        name: "postgres",
        command: "uvx",
        args: ["mcp-server-postgres"],
        env: {
          "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost/db"
        },
        description: "PostgreSQL database operations",
        category: "database",
        disabled: false,
        autoApprove: []
      },
      "brave-search": {
        name: "brave-search",
        command: "uvx",
        args: ["mcp-server-brave-search"],
        env: {
          "BRAVE_API_KEY": "your-brave-api-key"
        },
        description: "Web search using Brave Search API",
        category: "web-search",
        disabled: false,
        autoApprove: ["brave_web_search"]
      }
    };
  }

  /**
   * Initialize with example configuration if no config exists
   */
  initializeWithExamples(): void {
    const currentConfig = this.loadConfiguration();
    
    if (Object.keys(currentConfig.mcpServers).length === 0) {
      const examples = this.getExampleConfigurations();
      
      // Add a few disabled examples
      const exampleConfig: MCPConfiguration = {
        mcpServers: {
          "filesystem": { ...examples.filesystem, disabled: true },
          "git": { ...examples.git, disabled: true },
        }
      };
      
      this.saveWorkspaceConfiguration(exampleConfig);
      console.log("Initialized MCP configuration with examples");
    }
  }
}