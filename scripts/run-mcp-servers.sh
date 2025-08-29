#!/bin/bash

# Script to run all configured MCP servers locally for testing
# This helps verify that MCP servers can be started before using them in the orchestrator

set -e

CONFIG_FILE="settings/mcp.json"
WORKSPACE_CONFIG=".kiro/settings/mcp.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 MCP Server Test Runner${NC}"
echo "=================================="

# Check if config file exists - prioritize settings/mcp.json
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}📋 Using config from: $CONFIG_FILE${NC}"
elif [ -f "$WORKSPACE_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  Using workspace config: $WORKSPACE_CONFIG${NC}"
    CONFIG_FILE="$WORKSPACE_CONFIG"
else
    echo -e "${RED}❌ No MCP configuration found${NC}"
    echo "Expected: $CONFIG_FILE or $WORKSPACE_CONFIG"
    echo "Run: npm run mcp:init"
    exit 1
fi

# Check if jq is available for JSON parsing
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is required but not installed${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if uvx is available
if ! command -v uvx &> /dev/null; then
    echo -e "${RED}❌ uvx is required but not installed${NC}"
    echo "Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Parse and run each enabled server
servers=$(jq -r '.mcpServers | to_entries[] | select(.value.disabled != true) | @base64' "$CONFIG_FILE" 2>/dev/null)

if [ -z "$servers" ]; then
    echo -e "${YELLOW}⚠️  No enabled servers found in configuration${NC}"
    echo "Edit $CONFIG_FILE and set disabled: false for servers you want to test"
    exit 0
fi

echo -e "${GREEN}✅ Found enabled servers, testing each one...${NC}"
echo ""

success_count=0
total_count=0

while IFS= read -r server_data; do
    if [ -z "$server_data" ]; then
        continue
    fi
    
    # Decode base64 and parse server config
    server_json=$(echo "$server_data" | base64 --decode)
    server_name=$(echo "$server_json" | jq -r '.key')
    server_config=$(echo "$server_json" | jq -r '.value')
    
    command=$(echo "$server_config" | jq -r '.command')
    args=$(echo "$server_config" | jq -r '.args[]' | tr '\n' ' ')
    description=$(echo "$server_config" | jq -r '.description // "No description"')
    
    total_count=$((total_count + 1))
    
    echo -e "${BLUE}🧪 Testing server: $server_name${NC}"
    echo "   Description: $description"
    echo "   Command: $command $args"
    
    # Set environment variables if specified
    env_vars=$(echo "$server_config" | jq -r '.env // {} | to_entries[] | "\(.key)=\(.value)"' 2>/dev/null)
    
    # Build the command with environment variables
    full_command=""
    if [ -n "$env_vars" ]; then
        while IFS= read -r env_var; do
            if [ -n "$env_var" ]; then
                full_command="$env_var $full_command"
            fi
        done <<< "$env_vars"
    fi
    full_command="$full_command$command $args"
    
    # Test the server (run for 3 seconds then kill)
    echo "   Testing connection..."
    
    if timeout 3s bash -c "$full_command" >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Server started successfully${NC}"
        success_count=$((success_count + 1))
    else
        # Try to get more specific error info
        error_output=$(timeout 3s bash -c "$full_command" 2>&1 | head -3)
        if echo "$error_output" | grep -q "command not found\|No such file"; then
            echo -e "   ${RED}❌ Server package not found - install with: uvx $args${NC}"
        elif echo "$error_output" | grep -q "permission\|denied"; then
            echo -e "   ${RED}❌ Permission denied - check file/directory permissions${NC}"
        elif echo "$error_output" | grep -q "API.*key\|authentication"; then
            echo -e "   ${YELLOW}⚠️  Server needs API key configuration${NC}"
        else
            echo -e "   ${RED}❌ Server failed to start${NC}"
            if [ -n "$error_output" ]; then
                echo "   Error: $(echo "$error_output" | head -1)"
            fi
        fi
    fi
    echo ""
    
done <<< "$servers"

echo "=================================="
echo -e "${BLUE}📊 Test Results:${NC}"
echo -e "   Servers tested: $total_count"
echo -e "   Successful: ${GREEN}$success_count${NC}"
echo -e "   Failed: ${RED}$((total_count - success_count))${NC}"

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo -e "${GREEN}🎉 All servers are working correctly!${NC}"
    exit 0
elif [ $success_count -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some servers are working, others need attention${NC}"
    exit 1
else
    echo -e "${RED}❌ No servers are working - check configuration and dependencies${NC}"
    exit 1
fi