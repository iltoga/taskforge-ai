import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSession } from 'next-auth/react';
import { Chat } from '../components/Chat';
import { DevelopmentProvider } from '../contexts/DevelopmentContext';

// Mock next-auth
jest.mock('next-auth/react');
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Test wrapper with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <DevelopmentProvider>
      {component}
    </DevelopmentProvider>
  );
};

describe('Chat Component', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: 'Test User', email: 'test@example.com' },
        expires: '2024-12-31',
      },
      status: 'authenticated',
      update: jest.fn(),
    });

    mockFetch.mockClear();

    // Mock TextDecoder for streaming tests
    global.TextDecoder = jest.fn().mockImplementation(() => ({
      decode: jest.fn().mockReturnValue(''),
    }));
  });

  it('should render chat interface', () => {
    renderWithProviders(<Chat />);

    expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('should send message when form is submitted', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: '✅ Created event: "Test Meeting"',
        approach: 'legacy',
        progressMessages: [],
        steps: [],
        toolCalls: []
      }),
    } as Response);

    renderWithProviders(<Chat />);

    const input = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Create a meeting tomorrow at 2 PM');
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Create a meeting tomorrow at 2 PM',
          messages: [], // Now includes messages array (empty for first message)
          model: 'gpt-4.1-mini-2025-04-14',
          useTools: true, // Updated default
          orchestratorModel: 'gpt-4.1-mini-2025-04-14',
          developmentMode: true, // Updated default
        }),
      });
    });
  });

  it('should display response message', async () => {
    const user = userEvent.setup();

    // Mock streaming endpoint to throw error (simulating failure)
    mockFetch
      .mockRejectedValueOnce(new Error('Streaming not available'))
      // Mock fallback regular endpoint
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: '✅ Created event: "Test Meeting"',
          approach: 'legacy',
          steps: [],
          toolCalls: []
        }),
      } as Response);

    renderWithProviders(<Chat />);

    const input = screen.getByPlaceholderText(/type your message/i);

    await user.type(input, 'Create a meeting');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('✅ Created event: "Test Meeting"')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock streaming endpoint to throw error (simulating failure)
    mockFetch
      .mockRejectedValueOnce(new Error('Streaming not available'))
      // Mock fallback regular endpoint returning error
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Failed to process request',
        }),
      } as Response);

    renderWithProviders(<Chat />);

    const input = screen.getByPlaceholderText(/type your message/i);

    await user.type(input, 'Invalid request');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/failed to process request/i)).toBeInTheDocument();
    });
  });

  it('should clear input after sending message', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Event created',
        action: 'create',
      }),
    } as Response);

    renderWithProviders(<Chat />);

    const input = screen.getByPlaceholderText(/type your message/i) as HTMLInputElement;

    await user.type(input, 'Create a meeting');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should require authentication', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    renderWithProviders(<Chat />);

    expect(screen.getByText(/please sign in/i)).toBeInTheDocument();
  });
});
