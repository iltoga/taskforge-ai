#!/usr/bin/env node

/**
 * Setup script for functional testing environment
 * Ensures MCP servers are configured and ready for testing
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    envLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          process.env[key] = value;
        }
      }
    });
    
    console.log('✅ Loaded environment variables from .env file');
  } else {
    console.log('⚠️  No .env file found');
  }
}

function setupMCPConfiguration() {
  console.log('🔧 Setting up MCP configuration for functional tests...');
  
  const mcpConfigPath = path.resolve(process.cwd(), '.kiro/settings/mcp.json');
  const mcpConfigDir = path.dirname(mcpConfigPath);
  
  // Ensure directory exists
  if (!fs.existsSync(mcpConfigDir)) {
    fs.mkdirSync(mcpConfigDir, { recursive: true });
    console.log(`📁 Created directory: ${mcpConfigDir}`);
  }
  
  // Test-friendly MCP configuration
  const testMCPConfig = {
    "mcpServers": {
      "filesystem": {
        "name": "filesystem",
        "command": "mcp-server-filesystem",
        "args": [process.cwd()], // Use current project directory
        "description": "File system operations for testing",
        "category": "file-system",
        "disabled": false,
        "autoApprove": ["read_file", "list_directory"]
      },
      "git": {
        "name": "git",
        "command": "uvx",
        "args": ["mcp-server-git", "--repository", "."],
        "description": "Git repository operations for testing",
        "category": "version-control",
        "disabled": false,
        "autoApprove": ["git_status", "git_log", "git_diff"]
      }
    }
  };
  
  // Write configuration
  fs.writeFileSync(mcpConfigPath, JSON.stringify(testMCPConfig, null, 2));
  console.log(`✅ MCP configuration written to: ${mcpConfigPath}`);
  
  // Verify MCP servers can be tested
  console.log('🧪 Testing MCP server availability...');
  
  // Check if mcp-server-filesystem is available
  try {
    const { execSync } = require('child_process');
    execSync('which mcp-server-filesystem', { stdio: 'ignore' });
    console.log('✅ mcp-server-filesystem is available');
  } catch (error) {
    console.log('⚠️  mcp-server-filesystem not found - install with: npm install -g @modelcontextprotocol/server-filesystem');
  }
  
  // Check if uvx is available for git server
  try {
    const { execSync } = require('child_process');
    execSync('which uvx', { stdio: 'ignore' });
    console.log('✅ uvx is available for git server');
  } catch (error) {
    console.log('⚠️  uvx not found - install with: curl -LsSf https://astral.sh/uv/install.sh | sh');
  }
}

function setupTestDatabase() {
  console.log('🗄️  Checking database configuration...');
  
  // Check if DATABASE_URL is set
  if (process.env.DATABASE_URL) {
    console.log('✅ DATABASE_URL is configured');
  } else {
    console.log('⚠️  DATABASE_URL not set - some tests may fail');
  }
}

function setupEnvironmentVariables() {
  console.log('🔑 Checking environment variables...');
  
  const requiredVars = [
    'OPENAI_API_KEY',
    'NEXTAUTH_SECRET',
  ];
  
  const optionalVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'OPENROUTER_API_KEY'
  ];
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName} is set`);
    } else {
      console.log(`❌ ${varName} is required but not set`);
    }
  });
  
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName} is set (optional)`);
    } else {
      console.log(`⚠️  ${varName} is not set (optional)`);
    }
  });
}

function main() {
  console.log('🚀 Setting up TaskForge AI functional test environment');
  console.log('=' .repeat(60));
  
  // Load environment variables first
  loadEnvFile();
  console.log();
  
  setupMCPConfiguration();
  console.log();
  
  setupTestDatabase();
  console.log();
  
  setupEnvironmentVariables();
  console.log();
  
  console.log('=' .repeat(60));
  console.log('✅ Test environment setup complete!');
  console.log();
  console.log('To run the orchestrator UI functional test:');
  console.log('  npm run test:orchestrator-ui');
  console.log();
  console.log('To run all functional tests:');
  console.log('  npm run test:functional');
}

if (require.main === module) {
  main();
}