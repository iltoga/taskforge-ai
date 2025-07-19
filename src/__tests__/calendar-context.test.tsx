/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { CalendarProvider, useCalendar } from '../contexts/CalendarContext';

// Mock next-auth
const mockSession = {
  user: {
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: '2025-12-31',
};

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test component that uses the calendar context
function TestComponent() {
  const { selectedCalendarId, availableCalendars, isInitialized, isLoading } = useCalendar();

  return (
    <div>
      <div data-testid="calendar-id">{selectedCalendarId}</div>
      <div data-testid="calendars-count">{availableCalendars.length}</div>
      <div data-testid="initialized">{isInitialized.toString()}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
    </div>
  );
}

describe('CalendarContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it('should initialize with primary calendar when no saved calendar exists', async () => {
    // Mock localStorage to return null (no saved calendar)
    localStorageMock.getItem.mockReturnValue(null);

    // Mock fetch to return test calendars
    const mockCalendars = [
      { id: 'primary', summary: 'Primary Calendar', primary: true },
      { id: 'work', summary: 'Work Calendar', primary: false },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ calendars: mockCalendars }),
    });

    render(
      <SessionProvider session={mockSession}>
        <CalendarProvider>
          <TestComponent />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('calendar-id')).toHaveTextContent('primary');
  });

  it('should load saved calendar from localStorage', async () => {
    // Mock localStorage to return a saved calendar
    localStorageMock.getItem.mockImplementation((key) => {
      if (key.includes('selected-calendar')) return 'work-calendar-id';
      if (key.includes('available-calendars')) {
        return JSON.stringify([
          { id: 'primary', summary: 'Primary Calendar', primary: true },
          { id: 'work-calendar-id', summary: 'Work Calendar', primary: false },
        ]);
      }
      return null;
    });

    render(
      <SessionProvider session={mockSession}>
        <CalendarProvider>
          <TestComponent />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('calendar-id')).toHaveTextContent('work-calendar-id');
  });

  it('should fetch calendars only when none are available', async () => {
    // Mock localStorage to return existing calendars
    localStorageMock.getItem.mockImplementation((key) => {
      if (key.includes('selected-calendar')) return 'work-calendar-id';
      if (key.includes('available-calendars')) {
        return JSON.stringify([
          { id: 'work-calendar-id', summary: 'Work Calendar', primary: false },
        ]);
      }
      return null;
    });

    render(
      <SessionProvider session={mockSession}>
        <CalendarProvider>
          <TestComponent />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Should not have called fetch since we have saved calendars
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('calendars-count')).toHaveTextContent('1');
  });

  it('should preserve user selection when switching pages', async () => {
    // Mock localStorage to return a specific calendar selection
    localStorageMock.getItem.mockImplementation((key) => {
      if (key.includes('selected-calendar')) return 'work-calendar-id';
      if (key.includes('available-calendars')) {
        return JSON.stringify([
          { id: 'primary', summary: 'Primary Calendar', primary: true },
          { id: 'work-calendar-id', summary: 'Work Calendar', primary: false },
        ]);
      }
      return null;
    });

    const { rerender } = render(
      <SessionProvider session={mockSession}>
        <CalendarProvider>
          <TestComponent />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('calendar-id')).toHaveTextContent('work-calendar-id');

    // Rerender to simulate page navigation
    rerender(
      <SessionProvider session={mockSession}>
        <CalendarProvider>
          <TestComponent />
        </CalendarProvider>
      </SessionProvider>
    );

    // Should still have the same selection
    expect(screen.getByTestId('calendar-id')).toHaveTextContent('work-calendar-id');
  });

  it('should fallback to default when saved calendar is invalid', async () => {
    // Mock localStorage to return an invalid calendar ID
    localStorageMock.getItem.mockImplementation((key) => {
      if (key.includes('selected-calendar')) return 'invalid-calendar-id';
      if (key.includes('available-calendars')) return null;
      return null;
    });

    // Mock fetch to return available calendars
    const mockCalendars = [
      { id: 'primary', summary: 'Primary Calendar', primary: true },
      { id: 'work', summary: 'Work Calendar', primary: false },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ calendars: mockCalendars }),
    });

    render(
      <SessionProvider session={mockSession}>
        <CalendarProvider>
          <TestComponent />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Should fallback to primary since invalid calendar was saved
    expect(screen.getByTestId('calendar-id')).toHaveTextContent('primary');
  });
});
