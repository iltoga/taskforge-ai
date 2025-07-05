import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { Events } from '../components/Events';
import { CalendarProvider } from '../contexts/CalendarContext';
import { DevelopmentProvider } from '../contexts/DevelopmentContext';

// Mock next-auth
jest.mock('next-auth/react');

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;

// Helper function to render component with required providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <DevelopmentProvider>
      <CalendarProvider>
        {component}
      </CalendarProvider>
    </DevelopmentProvider>
  );
};

describe('Events Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sign in message when not authenticated', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    renderWithProviders(<Events />);

    expect(screen.getByText('Please sign in to view your events')).toBeInTheDocument();
  });

  it('shows loading state initially when authenticated', async () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    // Mock the fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: []
      }),
    });

    renderWithProviders(<Events />);

    expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
    expect(screen.getByText('New Event')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('displays no events message when events array is empty', async () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    // Mock the fetch response with empty events
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: []
      }),
    });

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getByText('No upcoming events')).toBeInTheDocument();
      expect(screen.getByText('You don\'t have any events scheduled for the next 7 days.')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      expires: '2024-01-01',
    };

    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    // Mock the fetch to fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
