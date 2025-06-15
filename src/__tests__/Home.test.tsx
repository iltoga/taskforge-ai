import Home from '@/app/page';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';

// Mock next-auth
jest.mock('next-auth/react');

// Mock the child components
jest.mock('@/components/Chat', () => ({
  Chat: jest.fn(() => <div data-testid="chat-component">Chat Component</div>),
}));

jest.mock('@/components/Events', () => ({
  Events: jest.fn(() => <div data-testid="events-component">Events Component</div>),
}));

jest.mock('@/components/Reports', () => ({
  Reports: jest.fn(() => <div data-testid="reports-component">Reports Component</div>),
}));

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signIn: () => mockSignIn(),
  signOut: () => mockSignOut(),
}));

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'loading',
      update: jest.fn(),
    });

    render(<Home />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders sign in page when not authenticated', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<Home />);

    expect(screen.getByText('CalendarGPT')).toBeInTheDocument();
    expect(screen.getByText('Your friendly AI assistant for Google Calendar management')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByText('Natural language event creation')).toBeInTheDocument();
  });

  it('renders main application when authenticated', () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://example.com/avatar.jpg',
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Home />);

    expect(screen.getByText('CalendarGPT')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('chat-component')).toBeInTheDocument();
  });

  it('allows switching between tabs', async () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://example.com/avatar.jpg',
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Home />);

    // Initially shows chat
    expect(screen.getByTestId('chat-component')).toBeInTheDocument();

    // Click Events tab
    fireEvent.click(screen.getByText('Events'));
    await waitFor(() => {
      expect(screen.getByTestId('events-component')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-component')).not.toBeInTheDocument();
    });

    // Click Reports tab
    fireEvent.click(screen.getByText('Reports'));
    await waitFor(() => {
      expect(screen.getByTestId('reports-component')).toBeInTheDocument();
      expect(screen.queryByTestId('events-component')).not.toBeInTheDocument();
    });

    // Back to Chat
    fireEvent.click(screen.getByText('Chat Assistant'));
    await waitFor(() => {
      expect(screen.getByTestId('chat-component')).toBeInTheDocument();
      expect(screen.queryByTestId('reports-component')).not.toBeInTheDocument();
    });
  });

  it('handles user dropdown menu', () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        image: null,
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Home />);

    // Click on user avatar (should show dropdown) - use more specific selector
    const avatarButton = screen.getByRole('button', { name: /user avatar/i });
    fireEvent.click(avatarButton);

    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('displays user avatar when image is provided', () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://example.com/avatar.jpg',
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Home />);

    const avatarImage = screen.getByAltText('User avatar');
    expect(avatarImage).toBeInTheDocument();
    expect(avatarImage).toHaveAttribute('src');
  });

  it('displays default avatar when no image is provided', () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        image: null,
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Home />);

    // Should show default user icon instead of image
    expect(screen.queryByAltText('User avatar')).not.toBeInTheDocument();
    // The default avatar container should be present (look for the user icon)
    expect(screen.getByTestId('default-avatar')).toBeInTheDocument();
  });
});
