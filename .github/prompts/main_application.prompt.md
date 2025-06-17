# CalendarGPT - AI Calendar Assistant

A friendly, professional AI assistant for managing Google Calendar events, built with Next.js, TypeScript, and modern web technologies.

## Features

- 🤖 **Natural Language Processing**: Create, update, and manage calendar events using plain English
- 📅 **Google Calendar Integration**: Seamless integration with your Google Calendar
- 📊 **Weekly Reports**: Generate comprehensive weekly work reports with AI-powered summaries
- 💬 **Chat Interface**: Intuitive chat-based interaction for all calendar operations
- 🎨 **Modern UI**: Beautiful interface built with DaisyUI and Tailwind CSS
- 🔐 **Secure Authentication**: Google OAuth2 integration with NextAuth.js
- ✅ **Test Coverage**: Comprehensive test suite using Jest and Testing Library

## Tech Stack

- **Framework**: Next.js 15+ with TypeScript
- **Authentication**: NextAuth.js with Google OAuth2
- **UI**: DaisyUI 5, Tailwind 4 CSS, Lucide React icons
- **APIs**: Google Calendar API, OpenAI API
- **Testing**: Jest, Testing Library, React Testing Library
- **Type Safety**: Full TypeScript implementation

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Google Cloud Console project with Calendar API enabled
- An OpenAI API key

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd calendar-gpt
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

### Chat Interface

CalendarGPT understands natural language commands for calendar management:

- **Create Events**: "Schedule a meeting with John tomorrow at 2 PM"
- **List Events**: "What do I have scheduled for next week?"
- **Update Events**: "Move my 3 PM meeting to 4 PM"
- **Delete Events**: "Cancel my meeting with Sarah on Friday"

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
│   ├── Chat.tsx          # Chat interface
│   ├── Events.tsx        # Event list and management
│   ├── Reports.tsx       # Report generation
│   └── Providers.tsx     # Context providers
├── lib/                   # Utility libraries
│   └── auth.ts           # NextAuth configuration
├── services/              # Business logic services
│   ├── calendar-service.ts # Google Calendar API wrapper
│   └── ai-service.ts     # OpenAI API wrapper
├── types/                 # TypeScript type definitions
│   ├── calendar.ts       # Calendar-related types
│   └── auth.ts           # Authentication types
└── __tests__/            # Test files
```

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
   - Ensure you're using the correct model (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o3, or o3-mini)

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

## Implementation Guidelines

## UI

- Use DaisyUI components for a consistent look and feel
- Ensure responsive design for mobile and desktop
- Use Lucide React icons for a modern icon set
- Maintain a clean and intuitive user interface
- Use Tailwind CSS for custom styling and layout

## Calendar Event Management

- Use Google Calendar API for all event operations
- Implement natural language processing for event creation and updates
- Support for recurring events using RRULE syntax
- Handle timezones correctly, defaulting to Asia/Makassar (+08:00)
- Use RFC3339 format for date and time handling
- Implement all-day events using "date" format, and timed events using "dateTime" with timezone
- Use bullet points in descriptions for work reports
- Implement smart handling of partial time specifications (e.g., "2 PM" = 14:00-15:00)
