#!/usr/bin/env node

/**
 * Simple script to initialize MCP configuration
 */

const fs = require('fs');
const path = require('path');

const exampleConfig = {
  "mcpServers": {
    "filesystem": {
      "name": "filesystem",
      "command": "uvx",
      "args": ["mcp-server-filesystem", "/path/to/allowed/directory"],
      "description": "File system read/write operations",
      "category": "file-system",
      "disabled": true,
      "autoApprove": ["read_file", "list_directory"]
    },
    "git": {
      "name": "git",
      "command": "uvx",
      "args": ["mcp-server-git", "--repository", "/path/to/repo"],
      "description": "Git repository operations",
      "category": "version-control",
      "disabled": true,
      "autoApprove": ["git_status", "git_log"]
    },
    "postgres": {
      "name": "postgres",
      "command": "uvx",
      "args": ["mcp-server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost/db"
      },
      "description": "PostgreSQL database operations",
      "category": "database",
      "disabled": true,
      "autoApprove": []
    },
    "brave-search": {
      "name": "brave-search",
      "command": "uvx",
      "args": ["mcp-server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      },
      "description": "Web search using Brave Search API",
      "category": "web-search",
      "disabled": true,
      "autoApprove": ["brave_web_search"]
    },
    "aws-docs": {
      "name": "aws-docs",
      "command": "uvx",
      "args": ["awslabs.aws-documentation-mcp-server@latest"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "description": "AWS documentation search and retrieval",
      "category": "documentation",
      "disabled": true,
      "autoApprove": ["search_aws_docs"]
    }
  }
};

function main() {
  const configDir = path.resolve(process.cwd(), '.kiro/settings');
  const configPath = path.join(configDir, 'mcp.json');
  const examplePath = path.resolve(process.cwd(), 'settings/mcp.json');

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`📁 Created directory: ${configDir}`);
    }

    // Check if config already exists
    if (fs.existsSync(configPath)) {
      console.log('⚠️  MCP configuration already exists at:', configPath);
      console.log('Edit the file to customize server settings.');
      return;
    }

    // Copy from example if it exists, otherwise create new
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, configPath);
      console.log('🚀 MCP configuration initialized from example!');
      console.log('📍 Configuration file created at:', configPath);
      console.log('📋 Based on example at:', examplePath);
    } else {
      // Write default configuration
      fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
      console.log('🚀 MCP configuration initialized!');
      console.log('📍 Configuration file created at:', configPath);
    }
    
    console.log('');
    console.log('Next steps:');
    console.log('1. Edit the configuration file to customize server settings');
    console.log('2. Set disabled: false for servers you want to enable');
    console.log('3. Update paths, API keys, and other settings as needed');
    console.log('4. Install uv/uvx if not already installed: curl -LsSf https://astral.sh/uv/install.sh | sh');
    console.log('5. Test servers with: npm run mcp:test');
    console.log('');
    console.log('Example servers available:');
    Object.entries(exampleConfig.mcpServers).forEach(([name, config]) => {
      console.log(`  - ${name}: ${config.description} (disabled)`);
    });

  } catch (error) {
    console.error('❌ Failed to initialize MCP configuration:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}