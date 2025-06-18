// Google Calendar Event types based on the API schema
export interface CalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  reminders?: {
    useDefault?: boolean;
    overrides?: Reminder[];
  };
  location?: string;
  attendees?: Attendee[];
  htmlLink?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

export interface Reminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface EventList {
  items: CalendarEvent[];
  nextPageToken?: string;
  timeMin?: string;
  timeMax?: string;
}

// Simplified event interface for AI processing - contains only essential data
export interface SimplifiedEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  isAllDay: boolean;
  location?: string;
  attendeeCount?: number;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

// Chat/AI types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface CalendarAction {
  type: 'create' | 'update' | 'delete' | 'list';
  event?: Partial<CalendarEvent>;
  eventId?: string;
  timeRange?: {
    start: string;
    end: string;
  };
}

// Work report types
export interface DailyReport {
  date: string;
  company?: string;
  activities: string[];
}

export interface WeeklyReport {
  startDate: string;
  endDate: string;
  company: string;
  summary: string;
  activities: DailyReport[];
}
