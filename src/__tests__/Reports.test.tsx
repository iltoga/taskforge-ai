import { Reports } from '@/components/Reports';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';

// Mock next-auth
jest.mock('next-auth/react');

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('Reports Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sign in message when not authenticated', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<Reports />);

    expect(screen.getByText('Please sign in to access work reports')).toBeInTheDocument();
  });

  it('renders report generation form when authenticated', () => {
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

    render(<Reports />);

    expect(screen.getByText('Work Reports')).toBeInTheDocument();
    expect(screen.getByText('Company Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
  });

  it('allows week selection', () => {
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

    render(<Reports />);

    const selectElement = screen.getByDisplayValue('Current Week');
    expect(selectElement).toBeInTheDocument();

    fireEvent.change(selectElement, { target: { value: 'last-week' } });
    expect(selectElement).toHaveValue('last-week');
  });

  it('generates and displays report', async () => {
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

    const mockReport = {
      period: 'Jan 1-7, 2024',
      totalEvents: 10,
      workingHours: 40,
      meetingHours: 15,
      summary: 'This week was productive with multiple meetings and focused work sessions.',
      events: [
        { title: 'Team Meeting', duration: '1 hour', type: 'Meeting' },
        { title: 'Code Review', duration: '30 minutes', type: 'Review' }
      ]
    };

    // Mock the fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ report: mockReport }),
    });

    render(<Reports />);

    // Set company name (required for generate button to be enabled)
    const companyInput = screen.getByPlaceholderText('Enter your company name...');
    fireEvent.change(companyInput, { target: { value: 'Test Company' } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Check loading state
    expect(screen.getByText('Generating Report...')).toBeInTheDocument();

    // Wait for report to be displayed
    await waitFor(() => {
      expect(screen.getByText('Report Generated')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // Total Events
      expect(screen.getByText('40h')).toBeInTheDocument(); // Working Hours
      expect(screen.getByText('15h')).toBeInTheDocument(); // Meeting Hours
      expect(screen.getByText('This week was productive with multiple meetings and focused work sessions.')).toBeInTheDocument();
    });
  });

  it('handles report generation error', async () => {
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
    mockFetch.mockRejectedValueOnce(new Error('Failed to generate report'));

    render(<Reports />);

    // Set company name (required for generate button to be enabled)
    const companyInput = screen.getByPlaceholderText('Enter your company name...');
    fireEvent.change(companyInput, { target: { value: 'Test Company' } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to generate report')).toBeInTheDocument();
    });
  });
});
