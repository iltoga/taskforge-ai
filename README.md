# Calend-- 📅 **Google Calendar Integration**: Seamless integration with your Google Calendar⚡ **Advanced Tool System**: Extensible architecture supporting calendar, email, file, and web tools with sophisticated orchestrationrGPT - AI Calendar Assistant

A friendly, professional AI assistant for managing Google Calendar events, built with Next.js, TypeScript, and modern web technologies.

## Features

- 🤖 **Natural Language Processing**: Create, update, and manage calendar events using plain English
- 🧠 **Agentic AI Orchestration**: Multi-step reasoning with intelligent tool usage and iterative problem solving
- � **Advanced Tool System**: Extensible architecture supporting calendar tools with plans for email, file, and web tools
- �📅 **Google Calendar Integration**: Seamless integration with your Google Calendar
- 📊 **Weekly Reports**: Generate comprehensive weekly work reports with AI-powered summaries
- 💬 **Chat Interface**: Intuitive chat-based interaction with three operation modes (Legacy, Tools, Agentic)
- 🎛️ **Dual AI Models**: Separate model selection for chat conversation and tool orchestration
- 🔍 **Development Transparency**: Full visibility into AI reasoning steps and tool execution in development mode
- 🎨 **Modern UI**: Beautiful interface built with DaisyUI and Tailwind CSS
- 🔐 **Secure Authentication**: Google OAuth2 integration with NextAuth.js
- ✅ **Test Coverage**: Comprehensive test suite using Jest and Testing Library

## Tech Stack

- **Framework**: Next.js 15+ with TypeScript
- **AI Architecture**: Agentic tool orchestration with multi-step reasoning
- **Tool System**: Extensible ToolRegistry and ToolOrchestrator for scalable AI workflows
- **Authentication**: NextAuth.js with Google OAuth2
- **UI**: DaisyUI 5, Tailwind 4 CSS, Lucide React icons
- **APIs**: Google Calendar API, OpenAI API (with support for GPT-4o, o3, o3-mini, and OpenRouter models)
- **Testing**: Jest, Testing Library, React Testing Library
- **Type Safety**: Full TypeScript implementation with Zod schema validation

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Google Cloud Console project with Calendar API enabled
- An OpenAI API key

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd calendar-assistant
npm install
```

### 2. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Set Application type to "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
   - Note down the Client ID and Client Secret

### 3. OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Generate an API key in the API section
4. Note down your API key

### 4. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI API
OPENAI_API_KEY=your-openai-api-key
```

Generate a secure `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 5. Run the Application

```bash
# Development mode
npm run dev

# Build and start production
npm run build
npm start
```

Visit `http://localhost:3000` to access the application.

## Usage

### Agentic Chat Interface

Calendar Assistant features three operation modes:

#### 1. **Legacy Mode**

Traditional JSON-based calendar operations for backward compatibility.

#### 2. **Tools Mode**

Simple tool-based responses with single tool calls.

#### 3. **Agentic Mode** (NEW!)

Advanced multi-step reasoning where the AI:

- Analyzes your request and plans which tools to use
- Executes tools iteratively based on intermediate results
- Evaluates when sufficient information is gathered
- Synthesizes comprehensive, well-formatted responses
- Shows all reasoning steps in development mode

### Natural Language Commands

Calendar Assistant understands complex natural language commands:

- **Create Events**: "Schedule a meeting with John tomorrow at 2 PM"
- **Search Events**: "Show me all Nespola events from March to June 2025"
- **Complex Queries**: "What meetings do I have this week and are there any conflicts?"
- **Update Events**: "Move my 3 PM meeting to 4 PM"
- **Delete Events**: "Cancel my meeting with Sarah on Friday"

### Dual AI Model Selection

- **Chat AI Model**: Handles general conversation and legacy operations
- **Orchestrator AI Model**: Powers the agentic reasoning and tool orchestration
- **Supported Models**: GPT-4o, GPT-4o Mini, o3, o3-mini, and OpenRouter models (DeepSeek, Gemini, etc.)

### Development Mode

Enable development mode to see:

- Step-by-step AI reasoning process
- Tool call parameters and responses
- Execution timing and performance metrics
- Error details for debugging

### Weekly Reports

Generate comprehensive weekly work reports:

1. Navigate to the "Reports" tab
2. Select the week you want to analyze
3. Click "Generate Report"
4. Download the report as a text file

### Event Management

View and manage your calendar events:

1. Go to the "Events" tab
2. See your upcoming events for the next 7 days
3. Use the dropdown menu to edit or delete events

## API Endpoints

### Authentication

- `GET/POST /api/auth/[...nextauth]` - NextAuth.js authentication handlers

### Chat API

- `POST /api/chat` - Process natural language calendar commands

### Reports API

- `POST /api/reports/weekly` - Generate weekly work reports

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPatterns=Chat.test.tsx
```

### Test Structure

- `src/__tests__/` - Test files
- Component tests for UI components
- Service tests for business logic
- API route tests for backend functionality

## Project Structure

```text
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── Chat.tsx          # Chat interface with agentic modes
│   ├── Events.tsx        # Event list and management
│   ├── Reports.tsx       # Report generation
│   ├── ModelSelector.tsx # Chat AI model selection
│   ├── OrchestratorModelSelector.tsx # Orchestrator AI model selection
│   └── Providers.tsx     # Context providers
├── appconfig/                # Configuration files
│   └── models.ts         # AI model configurations and types
├── lib/                   # Utility libraries
│   └── auth.ts           # NextAuth configuration
├── services/              # Business logic services
│   ├── calendar-service.ts # Google Calendar API wrapper
│   ├── ai-service.ts     # OpenAI API wrapper with agentic support
│   └── tool-orchestrator.ts # Agentic tool orchestration engine
├── tools/                 # Tool system architecture
│   ├── tool-registry.ts  # Extensible tool registration system
│   ├── tool-definitions.ts # Tool parameter schemas
│   └── calendar-tools.ts # Calendar-specific tool implementations
├── types/                 # TypeScript type definitions
│   ├── calendar.ts       # Calendar-related types
│   └── auth.ts           # Authentication types
└── __tests__/            # Test files
```

## Enhanced Agentic Orchestration

Calendar Assistant implements a sophisticated agentic AI system that goes beyond simple tool calling to provide true multi-step reasoning and intelligent workflow orchestration.

### Orchestration Architecture

#### ToolOrchestrator Engine

The `ToolOrchestrator` class provides advanced AI reasoning capabilities:

- **Multi-Step Analysis**: Comprehensive request decomposition and strategic planning
- **Iterative Tool Execution**: Dynamic tool calling based on intermediate results
- **Intelligent Evaluation**: Continuous assessment of information completeness
- **Adaptive Reasoning**: Context-aware decision making throughout the process
- **Error Recovery**: Graceful handling of tool failures with alternative strategies

#### Enhanced Prompting System

The orchestrator uses structured prompting for each phase:

1. **Analysis Phase**
   - Request decomposition into objectives and sub-tasks
   - Tool strategy planning with category mapping
   - Information requirements assessment
   - Approach planning with contingency strategies
   - Complexity evaluation for optimal execution

2. **Tool Decision Phase**
   - Strategic tool selection based on current context
   - Parameter planning with previous results consideration
   - Reasoning transparency for each tool call
   - Dependency management between tools

3. **Evaluation Phase**
   - Completeness assessment of gathered information
   - Quality evaluation of tool results
   - Next steps determination with detailed reasoning
   - User intent alignment verification

4. **Synthesis Phase**
   - Comprehensive response formatting
   - Multi-modal content structuring (events, confirmations, errors)
   - Actionable information presentation
   - User-friendly final output generation

### Tool Categories & Extensibility

#### Currently Implemented

- **Calendar Tools**: Event management, searching, creation, updates, deletion
- **Email Tools**: Sending, searching, replying (mock implementations)
- **File Tools**: File operations, directory management (mock implementations)
- **Web Tools**: Web searching, content fetching (mock implementations)

#### Extensibility Pattern

Adding new tool categories follows a consistent pattern:

```typescript
// 1. Create tool implementation class
export class NewCategoryTools {
  async toolMethod(params: ToolParams): Promise<ToolResult> {
    // Implementation
  }
}

// 2. Define Zod schemas in tool-definitions.ts
const ToolSchema = z.object({
  param1: z.string().describe("Parameter description"),
  param2: z.number().optional()
});

// 3. Register in tool-registry.ts
registry.registerTool({
  name: 'toolName',
  description: 'Tool description',
  parameters: ToolSchema,
  category: 'newCategory'
}, async (params) => await tools.toolMethod(params));
```

### Development Mode Features

Enable comprehensive debugging and transparency:

```typescript
const result = await orchestrator.orchestrate(
  userMessage,
  registry,
  'gpt-4.1-mini',
  { developmentMode: true }
);

// Returns detailed step-by-step execution:
// - Analysis reasoning and planning
// - Tool selection decisions
// - Parameter validation and execution
// - Performance metrics and timing
// - Error details and recovery attempts
```

### Orchestration Workflow Example

For a request like "Find all Nespola meetings next week and create a summary":

1. **Analysis**: Identifies need for calendar search + summary generation
2. **Planning**: Plans sequence: getEvents → analyze → synthesize
3. **Execution**: Calls getEvents with date filters and search terms
4. **Evaluation**: Assesses if results are sufficient for summary
5. **Synthesis**: Creates formatted summary with meeting details

### Performance & Reliability

- **Execution Timing**: Sub-second tool calls with detailed metrics
- **Error Handling**: Graceful degradation with informative error messages
- **Retry Logic**: Intelligent retry strategies for failed operations
- **Context Management**: Efficient context passing between orchestration steps

### Testing Coverage

Comprehensive test suite covers:

- Enhanced prompting system validation
- Multi-step reasoning scenarios
- Tool failure recovery mechanisms
- Parse decision logic from various AI response formats
- Information completeness evaluation logic

## Development

### Adding New Features

1. Create types in `src/types/`
2. Implement services in `src/services/`
3. Create components in `src/components/`
4. Add API routes in `src/app/api/`
5. Write tests in `src/__tests__/`

### Code Style

- Use TypeScript for type safety
- Follow React best practices
- Write tests for new functionality
- Use ESLint and Prettier for code formatting

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The application can be deployed on any platform that supports Next.js:

- Netlify
- Railway
- Digital Ocean
- AWS
- Google Cloud Platform

## Troubleshooting

### Common Issues

1. **Google Calendar API Errors**
   - Ensure the Calendar API is enabled in Google Cloud Console
   - Check your OAuth2 credentials and redirect URIs
   - Verify the user has granted calendar permissions

2. **OpenAI API Errors**
   - Check your API key is valid and has sufficient credits
   - Ensure you're using the correct model (gpt-4.1-mini, gpt-4.1-mini, gpt-4.1, gpt-4.1-mini, o3, or o3-mini)

3. **Authentication Issues**
   - Verify NEXTAUTH_SECRET is set
   - Check NEXTAUTH_URL matches your domain
   - Ensure Google OAuth2 credentials are correct

### Getting Help

If you encounter issues:

1. Check the browser console for errors
2. Review the server logs
3. Verify environment variables are set correctly
4. Check API credentials and permissions

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Future Enhancements

- Multi-user support with database storage
- Advanced calendar features (recurring events, attachments)
- Integration with other calendar providers
- Mobile app development
- Advanced AI features (smart scheduling, conflict resolution)
