# Extended Tool Categories Documentation

This document provides comprehensive information about the newly added tool categories in Calendar GPT, demonstrating the extensibility of the agentic system beyond calendar management.

## Overview

Calendar GPT has been extended with three new tool categories that showcase the system's ability to handle diverse tasks:

- **Email Tools**: Send, search, and manage emails
- **File Tools**: Manage files and directories
- **Web Tools**: Search the web and interact with websites

## Tool Categories

### 📧 Email Tools

The email tools provide comprehensive email management capabilities:

#### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `sendEmail` | Send an email message | `emailData`: to, subject, body, cc?, bcc?, priority?, isHtml? |
| `searchEmails` | Search emails with filters | `filters`: from?, to?, subject?, body?, hasAttachment?, isRead?, dateRange?, maxResults? |
| `getEmail` | Get email details by ID | `emailId`: string |
| `replyToEmail` | Reply to an existing email | `emailId`: string, `replyData`: body, replyAll? |
| `markEmail` | Mark email as read/unread | `emailId`: string, `action`: 'read' \\| 'unread' |

#### Usage Examples

```typescript
// Send an email
await emailTools.sendEmail({
  to: ['colleague@company.com'],
  subject: 'Project Update',
  body: 'Here is the latest update on the project...',
  priority: 'normal'
});

// Search for emails from a specific sender
await emailTools.searchEmails({
  from: 'boss@company.com',
  subject: 'urgent',
  maxResults: 10
});
```

### 📁 File Tools

The file tools provide file system management capabilities:

#### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `listFiles` | List files in directory | `directoryPath`: string, `recursive?`: boolean |
| `readFile` | Read file content | `filePath`: string |
| `writeFile` | Write content to file | `filePath`: string, `content`: string, `overwrite?`: boolean |
| `searchFiles` | Search files with criteria | `searchPath`: string, `filters`: name?, extension?, type?, sizeMin?, sizeMax?, maxResults? |
| `createDirectory` | Create new directory | `directoryPath`: string |
| `deleteFile` | Delete file or directory | `filePath`: string, `recursive?`: boolean |
| `copyFile` | Copy file to location | `sourcePath`: string, `destinationPath`: string |
| `moveFile` | Move or rename file | `sourcePath`: string, `destinationPath`: string |

#### Usage Examples

```typescript
// List files in a directory
await fileTools.listFiles('/project/documents', true);

// Read and write files
const content = await fileTools.readFile('/project/README.md');
await fileTools.writeFile('/backup/README_backup.md', content.data.content);

// Search for specific file types
await fileTools.searchFiles('/project', {
  extension: '.ts',
  type: 'file',
  maxResults: 50
});
```

### 🌐 Web Tools

The web tools provide web search and page interaction capabilities:

#### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `searchWeb` | Search the web | `query`: string, `filters?`: site?, maxResults?, dateRange?, language?, region? |
| `getWebPageContent` | Get page content | `url`: string |
| `summarizeWebPage` | Summarize page content | `url`: string, `maxLength?`: number |
| `checkWebsite` | Check site accessibility | `url`: string |
| `extractLinks` | Extract links from page | `url`: string, `filterPattern?`: string |
| `monitorWebsite` | Set up site monitoring | `url`: string, `checkInterval?`: number |

#### Usage Examples

```typescript
// Search the web
await webTools.searchWeb('TypeScript best practices', {
  site: 'github.com',
  maxResults: 5
});

// Get and summarize web content
const content = await webTools.getWebPageContent('https://example.com');
const summary = await webTools.summarizeWebPage('https://example.com', 200);

// Check website status
await webTools.checkWebsite('https://api.example.com');
```

## Architecture

### Tool Registry Pattern

The extended tool system follows a consistent registry pattern:

```typescript
import { createToolRegistry } from '@/tools/tool-registry';
import { CalendarTools } from '@/tools/calendar-tools';
import { EmailTools } from '@/tools/email-tools';
import { FileTools } from '@/tools/file-tools';
import { WebTools } from '@/tools/web-tools';

// Initialize tool instances
const calendarTools = new CalendarTools(calendarService);
const emailTools = new EmailTools();
const fileTools = new FileTools();
const webTools = new WebTools();

// Create registry with all tool categories
const toolRegistry = createToolRegistry(
  calendarTools,
  emailTools,
  fileTools,
  webTools
);
```

### Adding New Tool Categories

The system is designed for easy extensibility. To add a new tool category:

1. **Create the tool class** following the pattern:
   ```typescript
   export class NewCategoryTools {
     async someAction(parameters: SomeParams): Promise<ToolResult> {
       // Implementation
     }
   }
   ```

2. **Define tool schemas** in `tool-definitions.ts`:
   ```typescript
   export const newCategoryToolDefinitions = {
     someAction: {
       description: 'Description of the action',
       parameters: z.object({
         // Zod schema for parameters
       }),
     },
   };
   ```

3. **Register tools** in `tool-registry.ts`:
   ```typescript
   export function createToolRegistry(
     calendarTools: CalendarTools,
     emailTools?: EmailTools,
     fileTools?: FileTools,
     webTools?: WebTools,
     newCategoryTools?: NewCategoryTools  // Add new category
   ): ToolRegistry {
     // Registration logic
   }
   ```

4. **Add tests** following the pattern in `extended-tools.test.ts`

## Agentic Orchestration

### Multi-Tool Workflows

The orchestrator can now coordinate actions across multiple tool categories:

```typescript
// Example: Research and document workflow
const orchestrator = new ToolOrchestrator(apiKey);

const result = await orchestrator.orchestrate(
  "Research TypeScript best practices, save findings to a file, and email summary to team",
  toolRegistry,
  'gpt-4o-mini',
  { developmentMode: true }
);

// The orchestrator might:
// 1. Use webTools.searchWeb() to research
// 2. Use webTools.getWebPageContent() to read articles
// 3. Use fileTools.writeFile() to save findings
// 4. Use emailTools.sendEmail() to share summary
```

### Tool Selection Strategy

The orchestrator uses intelligent tool selection:

1. **Analysis Phase**: Determines what types of tools might be needed
2. **Planning Phase**: Selects specific tools and parameters
3. **Execution Phase**: Calls tools in logical sequence
4. **Evaluation Phase**: Assesses if more tools are needed
5. **Synthesis Phase**: Combines results into final response

## Implementation Details

### Tool Results Interface

All tools return consistent results:

```typescript
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}
```

### Error Handling

Tools implement consistent error handling:

- Input validation using Zod schemas
- Graceful failure with descriptive error messages
- Proper error propagation to the orchestrator

### Logging and Monitoring

All tools include detailed logging:

```typescript
console.log('📧 Sending email:', { to, subject, bodyLength });
console.log('📁 Listing files in:', directoryPath);
console.log('🔍 Searching web for:', query);
```

## Testing

### Comprehensive Test Coverage

The extended tool system includes:

- **Unit tests** for each tool category (28 new tests)
- **Integration tests** with the tool registry
- **Orchestration tests** for multi-tool workflows
- **Error handling tests** for validation and edge cases

### Test Categories

1. **Tool Registry Extension Tests**
   - Tool registration
   - Category management
   - Tool isolation

2. **Individual Tool Tests**
   - Email tool functionality
   - File tool operations
   - Web tool interactions

3. **Registry Execution Tests**
   - Tool execution through registry
   - Parameter validation
   - Error handling

4. **Extensibility Tests**
   - Easy tool addition
   - Category isolation
   - Backwards compatibility

## Production Considerations

### Service Integration

In production, tools would integrate with real services:

- **Email Tools**: Gmail API, Outlook API, SendGrid
- **File Tools**: Local filesystem, AWS S3, Google Drive
- **Web Tools**: Google Search API, web scraping libraries

### Security

- API key management for external services
- Input sanitization and validation
- Rate limiting and quota management
- Permission and authorization checks

### Performance

- Async/await patterns for all operations
- Connection pooling for external services
- Caching for frequently accessed data
- Timeout handling for long-running operations

## Future Extensions

The tool system can be extended with additional categories:

- **Database Tools**: Query and manage databases
- **API Tools**: Interact with REST and GraphQL APIs
- **Image Tools**: Generate, edit, and analyze images
- **Document Tools**: Create and manipulate PDFs, Word docs
- **Communication Tools**: Slack, Teams, Discord integration
- **Analytics Tools**: Data analysis and visualization

## Conclusion

The extended tool categories demonstrate the power and flexibility of the agentic system. By following consistent patterns for tool creation, registration, and orchestration, Calendar GPT can evolve from a calendar-focused application to a comprehensive productivity assistant capable of handling diverse tasks across multiple domains.

The modular architecture ensures that new capabilities can be added without disrupting existing functionality, making the system highly maintainable and extensible for future enhancements.
