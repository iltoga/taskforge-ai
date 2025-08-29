# 🧪 Orchestrator Functional Test Documentation

## Overview

This functional test demonstrates the complete orchestrator capabilities by testing the real chat UI with a complex, cross-domain task that requires both MCP servers and internal tools.

## Test Objectives

### 1. **Agentic Orchestration Validation**
- ✅ Multi-step reasoning (Analysis → Planning → Execution → Evaluation → Synthesis)
- ✅ Dynamic tool selection based on task requirements
- ✅ Context-aware decision making
- ✅ Error recovery and graceful degradation

### 2. **Cross-Domain Tool Integration**
- ✅ MCP server tools (filesystem, git, database)
- ✅ Internal tools (calendar, email, document processing)
- ✅ Seamless tool orchestration across domains
- ✅ Optimal tool selection for efficiency

### 3. **Real-World Task Execution**
- ✅ Complex, multi-step tasks requiring multiple tools
- ✅ Natural language task interpretation
- ✅ Intelligent workflow optimization
- ✅ Comprehensive result synthesis

## Test Scenarios

### **Scenario 1: Project Review Preparation**
**Task**: *"I need you to help me prepare for a project review meeting. Check if there are any files in my current project directory, read the README if it exists, look for calendar events related to 'project review' in the next 2 weeks, and create a summary report."*

**Expected Orchestration**:
1. **Analysis**: Parse the multi-part request and identify required tools
2. **Planning**: Generate optimal execution plan
3. **Execution**:
   - Use MCP filesystem server to list project files
   - Use MCP filesystem server to read README.md
   - Use internal calendar tools to search for review meetings
   - Use synthesis tools to create comprehensive report
4. **Evaluation**: Assess progress and determine if goals are met
5. **Synthesis**: Generate final response with project overview and meeting info

**Validates**:
- ✅ MCP + Internal tool coordination
- ✅ Multi-step workflow execution
- ✅ Intelligent tool selection
- ✅ Comprehensive result synthesis

### **Scenario 2: Error Handling**
**Task**: *"Please read a file that doesn't exist and then create a calendar event for it"*

**Expected Behavior**:
- Attempt to read non-existent file (graceful failure)
- Adapt plan based on failure
- Still attempt to create calendar event with available information
- Provide helpful error explanation

**Validates**:
- ✅ Error recovery mechanisms
- ✅ Graceful degradation
- ✅ Adaptive planning

### **Scenario 3: Efficiency Optimization**
**Task**: *"I want to know what files are in my project and also check my calendar for today. Please be efficient."*

**Expected Behavior**:
- Recognize parallel execution opportunity
- Use minimal number of tool calls
- Execute both requests efficiently
- Combine results intelligently

**Validates**:
- ✅ Optimal tool selection
- ✅ Execution efficiency
- ✅ Parallel processing capabilities

## Prerequisites

### **Environment Setup**

1. **Install MCP Prerequisites**:
   ```bash
   # Install uv/uvx for MCP servers
   curl -LsSf https://astral.sh/uv/install.sh | sh
   
   # Install MCP servers
   npm install -g @modelcontextprotocol/server-filesystem
   ```

2. **Configure Environment Variables**:
   ```bash
   # Required
   OPENAI_API_KEY="your-openai-api-key"
   NEXTAUTH_SECRET="your-secret-key"
   
   # Optional (for full functionality)
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   DATABASE_URL="postgresql://user:pass@localhost:5432/taskforge_ai"
   ```

3. **Setup Test Environment**:
   ```bash
   npm run test:setup
   ```

## Running the Tests

### **Quick Test**
```bash
npm run test:orchestrator-ui
```

### **All Functional Tests**
```bash
npm run test:functional
```

### **With Verbose Output**
```bash
npm run test:orchestrator-ui -- --verbose
```

## Expected Test Output

### **Successful Test Run**
```
🧪 Starting Orchestrator Chat UI Integration Test
============================================================
📝 Task Description:
I need you to help me prepare for a project review meeting...

============================================================
🚀 Sending request to chat API...
⏱️  Total execution time: 3247ms

============================================================
✅ Response received successfully
📊 Response length: 1456 characters
🔧 Orchestrator steps: 7

📋 Step 1: analysis
   🧠 Analysis: I need to help prepare for a project review meeting. Let me break this down...

📋 Step 2: tool_call
   🛠️  Tool: list_directory
   ⏱️  Duration: 234ms
   ✅ Success: true

📋 Step 3: tool_call
   🛠️  Tool: read_file
   ⏱️  Duration: 156ms
   ✅ Success: true

📋 Step 4: tool_call
   🛠️  Tool: searchEvents
   ⏱️  Duration: 445ms
   ✅ Success: true

📋 Step 5: synthesis
   📝 Synthesis: Final response generated

✅ Orchestrator performed analysis/planning
🔧 Tool executions: 3
✅ Orchestrator executed tools
🛠️  Unique tools used: list_directory, read_file, searchEvents
✅ Used file system tools (likely MCP)
✅ Used calendar tools (internal)
✅ Orchestrator used efficient number of tool calls
📊 Tool success rate: 100.0%
✅ Orchestrator performed final synthesis
✅ Generated meaningful response

============================================================
📄 Response Preview:
Based on my analysis of your project and calendar, here's your project review preparation summary:

## Project Overview
Your TaskForge AI project is an agentic task orchestrator that demonstrates sophisticated AI integration...

============================================================
🎉 Orchestrator Chat UI Integration Test PASSED!
============================================================
```

## Test Validation Criteria

### **✅ Orchestrator Functionality**
- [ ] Multi-step reasoning executed (5 phases)
- [ ] Dynamic tool selection based on task
- [ ] Context maintained across tool calls
- [ ] Error handling and recovery
- [ ] Final synthesis of results

### **✅ Tool Integration**
- [ ] MCP servers used (filesystem, git, etc.)
- [ ] Internal tools used (calendar, email, etc.)
- [ ] Cross-domain tool coordination
- [ ] Optimal tool selection for efficiency

### **✅ Performance Metrics**
- [ ] Total execution time < 10 seconds
- [ ] Tool calls ≤ 8 (efficiency)
- [ ] Tool success rate > 50%
- [ ] Response quality (meaningful, comprehensive)

### **✅ API Integration**
- [ ] Chat API responds successfully (200 status)
- [ ] Proper request/response format
- [ ] Authentication handling
- [ ] Error responses are graceful

## Troubleshooting

### **Common Issues**

1. **MCP Servers Not Found**
   ```bash
   # Install missing MCP servers
   npm install -g @modelcontextprotocol/server-filesystem
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Authentication Errors**
   ```bash
   # Check environment variables
   echo $OPENAI_API_KEY
   echo $NEXTAUTH_SECRET
   ```

3. **Database Connection Issues**
   ```bash
   # Check database is running
   pg_isready -h localhost -p 5432
   ```

4. **Test Timeout**
   - Increase timeout in test file (currently 60s)
   - Check network connectivity
   - Verify API keys are valid

### **Debug Mode**

Enable verbose logging by setting environment variable:
```bash
DEBUG=orchestrator npm run test:orchestrator-ui
```

## Test Architecture

### **No Mocking Philosophy**
This test uses **zero mocking** to validate real-world functionality:
- ✅ Real chat API endpoint
- ✅ Real orchestrator engine
- ✅ Real MCP server connections
- ✅ Real tool executions
- ✅ Real AI model calls

### **Comprehensive Validation**
- **Input**: Natural language task description
- **Process**: Full orchestrator pipeline
- **Output**: Synthesized response with tool results
- **Metrics**: Performance, efficiency, accuracy

## Success Criteria

The test **PASSES** when:
1. ✅ Complex task is successfully orchestrated
2. ✅ Both MCP and internal tools are used appropriately
3. ✅ Execution is efficient (≤8 tool calls)
4. ✅ Response is comprehensive and accurate
5. ✅ Error handling works gracefully
6. ✅ Performance is acceptable (<10s total time)

This functional test proves that TaskForge AI can handle real-world, complex tasks using sophisticated agentic orchestration with both internal and external tools! 🚀