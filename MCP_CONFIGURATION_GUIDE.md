# MCP Server Configuration Guide

## Overview

This guide explains how to configure and use Model Context Protocol (MCP) servers with your orchestrator. MCP servers provide external tools that can be seamlessly integrated into your AI workflows.

## Prerequisites

1. **Install uv and uvx** (Python package manager):
   ```bash
   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   
   # Or via Homebrew
   brew install uv
   ```

2. **Verify installation**:
   ```bash
   uvx --help
   ```

## Quick Start

### 1. Initialize with Examples

```bash
npm run mcp:init
```

This creates `.kiro/settings/mcp.json` with example server configurations.

### 2. Enable a Server

Edit `.kiro/settings/mcp.json` and set `disabled: false` for the server you want to use:

```json
{
  "mcpServers": {
    "filesystem": {
      "name": "filesystem",
      "command": "mcp-server-filesystem",
      "args": ["/Users/yourname/Documents"],
      "disabled": false,  // ← Change this to false
      "autoApprove": ["read_file", "list_directory"]
    }
  }
}
```

### 3. Start Your Application

```bash
npm run dev
```

**🚀 MCP servers start automatically!** No manual server management needed.

- ✅ **Auto-start** when your app starts
- ✅ **Auto-restart** if servers crash  
- ✅ **Auto-shutdown** when app stops
- ✅ **Tools appear immediately** in the UI and orchestrator

### 4. Optional - Test Servers Independently

```bash
npm run mcp:test
```

This tests MCP servers independently to verify they work before starting your app.

## Configuration File Structure

### Location
- **Workspace**: `.kiro/settings/mcp.json` (project-specific)
- **User**: `~/.kiro/settings/mcp.json` (global)

Workspace settings take precedence over user settings.

### Basic Structure

```json
{
  "mcpServers": {
    "server-name": {
      "name": "server-name",
      "command": "uvx",
      "args": ["package-name", "--option"],
      "env": {
        "API_KEY": "your-api-key"
      },
      "disabled": false,
      "autoApprove": ["tool1", "tool2"],
      "category": "custom-category",
      "description": "Server description"
    }
  }
}
```

### Configuration Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique server identifier |
| `command` | string | ✅ | Command to run (usually "uvx") |
| `args` | string[] | ✅ | Command arguments |
| `env` | object | ❌ | Environment variables |
| `disabled` | boolean | ❌ | Disable server (default: false) |
| `autoApprove` | string[] | ❌ | Auto-approve these tools |
| `category` | string | ❌ | Tool category |
| `description` | string | ❌ | Human-readable description |

## Popular MCP Servers

### 1. File System Operations

```json
{
  "filesystem": {
    "name": "filesystem",
    "command": "uvx",
    "args": ["mcp-server-filesystem", "/path/to/allowed/directory"],
    "description": "File system read/write operations",
    "category": "file-system",
    "disabled": false,
    "autoApprove": ["read_file", "list_directory"]
  }
}
```

**Available Tools:**
- `read_file` - Read file contents
- `write_file` - Write to files
- `list_directory` - List directory contents
- `create_directory` - Create directories

### 2. Git Repository Management

```json
{
  "git": {
    "name": "git",
    "command": "uvx",
    "args": ["mcp-server-git", "--repository", "/path/to/repo"],
    "description": "Git repository operations",
    "category": "version-control",
    "disabled": false,
    "autoApprove": ["git_status", "git_log"]
  }
}
```

**Available Tools:**
- `git_status` - Get repository status
- `git_log` - View commit history
- `git_diff` - Show changes
- `git_add` - Stage files
- `git_commit` - Create commits

### 3. Database Operations (PostgreSQL)

```json
{
  "postgres": {
    "name": "postgres",
    "command": "uvx",
    "args": ["mcp-server-postgres"],
    "env": {
      "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost/db"
    },
    "description": "PostgreSQL database operations",
    "category": "database",
    "disabled": false,
    "autoApprove": []
  }
}
```

**Available Tools:**
- `query` - Execute SQL queries
- `list_tables` - List database tables
- `describe_table` - Get table schema
- `list_schemas` - List database schemas

### 4. Web Search (Brave)

```json
{
  "brave-search": {
    "name": "brave-search",
    "command": "uvx",
    "args": ["mcp-server-brave-search"],
    "env": {
      "BRAVE_API_KEY": "your-brave-api-key"
    },
    "description": "Web search using Brave Search API",
    "category": "web-search",
    "disabled": false,
    "autoApprove": ["brave_web_search"]
  }
}
```

**Available Tools:**
- `brave_web_search` - Search the web
- `brave_local_search` - Local business search

### 5. AWS Documentation

```json
{
  "aws-docs": {
    "name": "aws-docs",
    "command": "uvx",
    "args": ["awslabs.aws-documentation-mcp-server@latest"],
    "env": {
      "FASTMCP_LOG_LEVEL": "ERROR"
    },
    "description": "AWS documentation search and retrieval",
    "category": "documentation",
    "disabled": false,
    "autoApprove": ["search_aws_docs"]
  }
}
```

**Available Tools:**
- `search_aws_docs` - Search AWS documentation
- `get_aws_service_info` - Get service information

## Server Lifecycle Management

### 🚀 Automatic Management (Recommended)

MCP servers are **automatically managed** by your Next.js application:

```bash
npm run dev  # Starts app + all enabled MCP servers
```

**What happens automatically:**
- ✅ Enabled MCP servers start as child processes
- ✅ Failed servers are retried with exponential backoff
- ✅ Crashed servers are automatically restarted
- ✅ All servers shutdown gracefully when app stops
- ✅ Tools become available immediately in UI and orchestrator

**Console output example:**
```
✅ Connected to MCP server 'filesystem' with 4 tools
✅ Connected to MCP server 'git' with 6 tools  
❌ Failed to connect to MCP server 'postgres': connection refused
```

### 🧪 Manual Testing (Optional)

Test MCP servers independently before running your app:

```bash
# Test all configured servers
npm run mcp:test

# Initialize configuration
npm run mcp:init
```

**Note:** You don't need to run servers manually - they're fully integrated into your application lifecycle!

### Programmatic API

```typescript
import { getMCPApi } from "@/services/mcp/mcp-api";

const mcpApi = getMCPApi();

// Initialize MCP system
await mcpApi.initialize();

// Get server health
const health = mcpApi.getServerHealth();

// Get available tools
const tools = await mcpApi.getAvailableTools();

// Execute a tool
const result = await mcpApi.executeTool("read_file", { path: "/some/file.txt" });

// Add a new server
await mcpApi.addServer("my-server", {
  name: "my-server",
  command: "uvx",
  args: ["my-mcp-package"],
  disabled: false
});
```

## Security Considerations

### Auto-Approve Lists

Use `autoApprove` to automatically approve safe, read-only operations:

```json
{
  "autoApprove": [
    "read_file",
    "list_directory", 
    "git_status",
    "git_log",
    "list_tables"
  ]
}
```

### Environment Variables

Store sensitive data like API keys in environment variables:

```json
{
  "env": {
    "API_KEY": "your-secret-key",
    "DATABASE_URL": "postgresql://..."
  }
}
```

### File System Restrictions

Limit file system access to specific directories:

```json
{
  "args": ["mcp-server-filesystem", "/allowed/path/only"]
}
```

## Troubleshooting

### Common Issues

1. **Server won't connect**
   ```bash
   # Test the server manually
   uvx mcp-server-filesystem /some/path
   
   # Check if uvx is installed
   uvx --help
   ```

2. **Tools not appearing**
   ```bash
   # Check server status
   npm run mcp:status
   
   # Verify configuration
   npm run mcp:list
   ```

3. **Permission errors**
   - Check file/directory permissions
   - Verify API keys in environment variables
   - Review auto-approve settings

### Debug Mode

Enable debug logging by setting environment variables:

```bash
export FASTMCP_LOG_LEVEL=DEBUG
export MCP_DEBUG=1
```

### Log Files

Check application logs for MCP-related messages:
- Connection attempts
- Tool execution results
- Error messages

## Best Practices

### 1. Start Small
Begin with read-only tools like file reading or git status before enabling write operations.

### 2. Use Categories
Organize tools by category for better orchestrator planning:

```json
{
  "category": "file-system",  // Groups related tools
  "autoApprove": ["read_file"] // Safe operations only
}
```

### 3. Test Configurations
Always test new server configurations:

```bash
npm run mcp test my-new-server
```

### 4. Monitor Health
Regularly check server health:

```bash
npm run mcp:status
```

### 5. Version Control
Keep your MCP configuration in version control, but exclude sensitive data:

```gitignore
# Include the structure
.kiro/settings/mcp.json

# But exclude sensitive environment files
.env.mcp
```

## Integration with Orchestrator

Once configured, MCP tools are automatically available to the orchestrator:

```typescript
// The orchestrator can now use MCP tools seamlessly
// No code changes needed - tools appear alongside internal tools

// Example: The orchestrator might plan to use these tools:
// 1. read_file (from filesystem MCP server)
// 2. git_status (from git MCP server)  
// 3. createEvent (from internal calendar tools)
```

## Advanced Configuration

### Custom MCP Servers

Create your own MCP server:

1. **Install MCP SDK**:
   ```bash
   pip install mcp
   ```

2. **Create server script**:
   ```python
   from mcp.server import Server
   
   server = Server("my-custom-server")
   
   @server.tool("my_tool")
   def my_tool(param: str) -> str:
       return f"Hello {param}"
   
   if __name__ == "__main__":
       server.run()
   ```

3. **Configure in MCP**:
   ```json
   {
     "my-server": {
       "command": "python",
       "args": ["/path/to/my-server.py"],
       "disabled": false
     }
   }
   ```

### Environment-Specific Configs

Use different configurations for different environments:

```bash
# Development
cp .kiro/settings/mcp.dev.json .kiro/settings/mcp.json

# Production  
cp .kiro/settings/mcp.prod.json .kiro/settings/mcp.json
```

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review server logs and status
3. Test individual server connections
4. Verify uvx and uv installation

The MCP integration is designed to be robust and will gracefully handle server failures, continuing to work with available servers and internal tools.