import Home from '@/app/page';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { DevelopmentProvider } from '../contexts/DevelopmentContext';

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

// Test wrapper with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <DevelopmentProvider>
      {component}
    </DevelopmentProvider>
  );
};

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

    renderWithProviders(<Home />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders sign in page when not authenticated', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    renderWithProviders(<Home />);

    expect(screen.getByText('CalendarGPT')).toBeInTheDocument();
    expect(screen.getByText('Your intelligent assistant for seamless Google Calendar management.')).toBeInTheDocument();
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

    renderWithProviders(<Home />);

    expect(screen.getAllByText('CalendarGPT')[0]).toBeInTheDocument();
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

    renderWithProviders(<Home />);

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
    fireEvent.click(screen.getByText('AI Chat'));
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

    renderWithProviders(<Home />);

    // Click on user avatar (should show dropdown) - look for dropdown button
    const avatarButton = screen.getByRole('button', { name: '' });
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

    renderWithProviders(<Home />);

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

    renderWithProviders(<Home />);

    // Should show default user icon instead of image
    expect(screen.queryByAltText('User avatar')).not.toBeInTheDocument();
    // The default avatar container should be present (look for the user icon)
    const userIcon = screen.getByRole('button', { name: '' });
    expect(userIcon).toBeInTheDocument();
  });
});
