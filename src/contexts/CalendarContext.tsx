'use client';

import { useSession } from 'next-auth/react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface CalendarContextType {
  selectedCalendarId: string;
  setSelectedCalendarId: (calendarId: string) => void;
  availableCalendars: CalendarInfo[];
  setAvailableCalendars: (calendars: CalendarInfo[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isInitialized: boolean;
}

interface CalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

const CALENDAR_STORAGE_KEY_PREFIX = 'calendar-assistant-selected-calendar';
const AVAILABLE_CALENDARS_STORAGE_KEY_PREFIX = 'calendar-assistant-available-calendars';

export const CalendarProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = useSession();
  const [selectedCalendarId, setSelectedCalendarIdState] = useState<string>('');
  const [availableCalendars, setAvailableCalendars] = useState<CalendarInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get user-specific storage key
  const getStorageKey = useCallback(() => {
    if (session?.user?.email) {
      return `${CALENDAR_STORAGE_KEY_PREFIX}-${session.user.email}`;
    }
    return CALENDAR_STORAGE_KEY_PREFIX;
  }, [session?.user?.email]);

  // Get user-specific storage key for available calendars
  const getAvailableCalendarsStorageKey = useCallback(() => {
    if (session?.user?.email) {
      return `${AVAILABLE_CALENDARS_STORAGE_KEY_PREFIX}-${session.user.email}`;
    }
    return AVAILABLE_CALENDARS_STORAGE_KEY_PREFIX;
  }, [session?.user?.email]);

  const setSelectedCalendarId = useCallback((calendarId: string) => {
    console.log(`Selecting calendar: ${calendarId}`);
    setSelectedCalendarIdState(calendarId);
    if (session?.user) {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, calendarId);
      console.log(`Saved calendar selection for user ${session.user.email}:`, calendarId);
    }
  }, [session?.user, getStorageKey]);

  const setAvailableCalendarsWithPersistence = useCallback((calendars: CalendarInfo[]) => {
    setAvailableCalendars(calendars);
    if (session?.user && calendars.length > 0) {
      const storageKey = getAvailableCalendarsStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(calendars));
      console.log(`Saved available calendars for user ${session.user.email}:`, calendars.length);
    }
  }, [session?.user, getAvailableCalendarsStorageKey]);

  // Initialize calendar selection when session is ready
  useEffect(() => {
    if (session?.user) {
      const storageKey = getStorageKey();
      const calendarsKey = getAvailableCalendarsStorageKey();
      const savedCalendarId = localStorage.getItem(storageKey);
      const savedCalendars = localStorage.getItem(calendarsKey);

      console.log(`Initializing calendar for user ${session.user.email}`);
      console.log(`Storage key: ${storageKey}`);
      console.log(`Saved calendar ID: ${savedCalendarId}`);
      console.log(`Saved calendars: ${savedCalendars ? 'found' : 'not found'}`);

      // Load available calendars if we have them
      if (savedCalendars && savedCalendars !== 'null' && savedCalendars !== 'undefined') {
        try {
          const calendars = JSON.parse(savedCalendars) as CalendarInfo[];
          setAvailableCalendars(calendars);
          console.log(`Loaded ${calendars.length} saved calendars`);
        } catch (error) {
          console.warn('Failed to parse saved calendars:', error);
        }
      }

      // Load selected calendar ID
      if (savedCalendarId && savedCalendarId !== 'null' && savedCalendarId !== 'undefined') {
        console.log(`Loading saved calendar: ${savedCalendarId}`);
        setSelectedCalendarIdState(savedCalendarId);
      } else {
        console.log(`No valid saved calendar found, using primary`);
        setSelectedCalendarIdState('primary');
      }
      setIsInitialized(true);
    } else if (!session && isInitialized) {
      // User logged out, reset state
      setSelectedCalendarIdState('');
      setAvailableCalendars([]);
      setIsInitialized(false);
    }
  }, [session, getStorageKey, getAvailableCalendarsStorageKey, isInitialized]);

  // Auto-select primary calendar when calendars are loaded if no valid selection exists
  useEffect(() => {
    if (availableCalendars.length > 0 && isInitialized && selectedCalendarId) {
      const currentSelection = availableCalendars.find(cal => cal.id === selectedCalendarId);
      if (!currentSelection) {
        // Current selection is invalid, find the primary calendar or fallback to first available
        const primaryCalendar = availableCalendars.find(cal => cal.primary);
        const fallbackCalendar = primaryCalendar || availableCalendars[0];
        console.log(`Invalid calendar selection "${selectedCalendarId}", switching to:`, fallbackCalendar.summary);
        setSelectedCalendarId(fallbackCalendar.id);
      } else {
        console.log(`Current calendar selection is valid: ${currentSelection.summary}`);
      }
    }
  }, [availableCalendars, selectedCalendarId, isInitialized, setSelectedCalendarId]);

  const value = {
    selectedCalendarId: selectedCalendarId || 'primary',
    setSelectedCalendarId,
    availableCalendars,
    setAvailableCalendars: setAvailableCalendarsWithPersistence,
    isLoading,
    setIsLoading,
    isInitialized,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
};

export type { CalendarInfo };
