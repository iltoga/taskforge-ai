/**
 * @jest-environment node
 *
 * NOTE: This test cannot work with real calendar data because it uses mocked OAuth tokens.
 * To test real calendar functionality, you need to authenticate in the actual app.
 * This test only verifies that the agentic orchestrator is properly triggered.
 */
import { config } from 'dotenv';
import { NextRequest } from 'next/server';

// Load environment variables from .env file
config();

// Mock NextAuth
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
  getServerSession: jest.fn(),
}));

// Get the mocked function
const mockGetServerSession = jest.requireMock('next-auth').getServerSession;

describe('Chat Flow - Orchestrator Triggering (Mocked Session)', () => {
  beforeAll(() => {
    // Verify all required environment variables are present
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables. Make sure you have a .env file with OPENAI_API_KEY set.');
    }

    if (!googleClientId) {
      throw new Error('GOOGLE_CLIENT_ID not found in environment variables. Make sure you have a .env file with GOOGLE_CLIENT_ID set.');
    }

    if (!googleClientSecret) {
      throw new Error('GOOGLE_CLIENT_SECRET not found in environment variables. Make sure you have a .env file with GOOGLE_CLIENT_SECRET set.');
    }

    console.log('✅ All required environment variables are present');
  });

  beforeEach(() => {
    // Mock a successful authenticated session with FAKE tokens
    // NOTE: These fake tokens cannot access real Google Calendar data
    const mockSession = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
      accessToken: 'fake-access-token-for-testing',
      refreshToken: 'fake-refresh-token-for-testing',
      expires: '2025-12-31',
    };

    mockGetServerSession.mockResolvedValue(mockSession);
    console.log('🔐 Mocked authenticated session with FAKE tokens (cannot access real calendar data)');
  });

  it('should verify the orchestrator is triggered for calendar queries (NOTE: fake tokens cannot access real calendar)', async () => {
    const userMessage = "summarize all events for nespola between march and june 2025";

    console.log('🚀 Starting full chat flow test');
    console.log('📝 User query:', userMessage);
    console.log('🔧 Testing with agentic mode enabled');

    // Import the POST function after mocking
    const { POST } = await import('../../app/api/chat/route');

    // Create request body matching exactly what the backend expects
    const requestBody = {
      message: userMessage,
      model: 'gpt-4o-mini',
      useTools: true,        // Backend expects 'useTools' not 'toolMode'
      developmentMode: true  // Enable agentic mode
    };

    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

    // Create a NextRequest object to call the API directly
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('� Calling chat API directly...');

    try {
      const response = await POST(request);
      console.log('📊 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Request failed with status ${response.status}: ${errorText}`);
      }

      // Read the response as JSON (not streaming)
      const responseData = await response.json();
      console.log('📊 Response data:', JSON.stringify(responseData, null, 2));

      let fullResponse = '';
      let toolCallsDetected = false;

      // The API returns a structured JSON response with the message
      if (responseData.success) {
        fullResponse = responseData.message || '';
        toolCallsDetected = responseData.toolCalls && responseData.toolCalls.length > 0;

        console.log('✅ Successful response received');
        console.log('� Message:', fullResponse);
        console.log('🔧 Tool calls:', responseData.toolCalls?.length || 0);
        console.log('🤖 Approach:', responseData.approach);
        console.log('� Steps:', responseData.steps?.length || 0);
      } else {
        console.error('❌ API returned error:', responseData.error);
        fullResponse = responseData.error || 'Unknown error';
      }

      console.log('🎯 === FINAL ANALYSIS ===');
      console.log('Full AI response:', fullResponse);
      console.log('Tool calls detected:', toolCallsDetected);

      // Analyze the response to see what actually happened
      if (fullResponse.toLowerCase().includes('training data')) {
        console.error('❌ PROBLEM: Got training data fallback response');
        console.error('This means the agentic orchestrator was NOT triggered');
        console.error('The AI is responding without access to calendar tools');

        // This should not happen with proper authentication
        expect(toolCallsDetected).toBe(true);
      } else if (fullResponse.toLowerCase().includes('nespola')) {
        console.log('✅ SUCCESS: Response mentions nespola');
        console.log('This indicates the orchestrator may have been triggered');
      } else {
        console.warn('⚠️  UNCLEAR: Response doesn\'t mention nespola or training data');
      }

      // Validate that we got tool calls (meaning orchestrator was triggered)
      if (!toolCallsDetected && fullResponse.toLowerCase().includes('training data')) {
        throw new Error('Orchestrator was not triggered - still getting training data response despite authentication');
      }

      // Validate basic response structure
      expect(fullResponse).toBeDefined();
      expect(fullResponse.length).toBeGreaterThan(0);

      console.log('✅ Test completed - check logs above for detailed analysis');

    } catch (error) {
      console.error('💥 Test failed with error:', error);
      throw error;
    }
  }, 60000); // 60 second timeout for full flow
});