import { decodeCalendarId, getServiceAccountCalendars, isServiceAccountMode, loadAllowedCalendars } from '../lib/calendar-config';

describe('Calendar Configuration', () => {
  beforeEach(() => {
    // Reset environment variable
    delete process.env.CALENDAR_AUTH_MODE;
  });

  describe('isServiceAccountMode', () => {
    it('should return false when CALENDAR_AUTH_MODE is not set', () => {
      expect(isServiceAccountMode()).toBe(false);
    });

    it('should return false when CALENDAR_AUTH_MODE is oauth', () => {
      process.env.CALENDAR_AUTH_MODE = 'oauth';
      expect(isServiceAccountMode()).toBe(false);
    });

    it('should return true when CALENDAR_AUTH_MODE is service-account', () => {
      process.env.CALENDAR_AUTH_MODE = 'service-account';
      expect(isServiceAccountMode()).toBe(true);
    });
  });

  describe('decodeCalendarId', () => {
    it('should decode base64 encoded calendar ID correctly', () => {
      const encodedId = 'dGVzdEBleGFtcGxlLmNvbQ=='; // test@example.com in base64
      const decodedId = decodeCalendarId(encodedId);
      expect(decodedId).toBe('test@example.com');
    });

    it('should return original string if decoding fails', () => {
      const invalidBase64 = 'invalid-base64!@#';
      const result = decodeCalendarId(invalidBase64);
      expect(result).toBe(invalidBase64);
    });
  });

  describe('loadAllowedCalendars', () => {
    it('should load calendars from allowed-calendars.json', () => {
      const calendars = loadAllowedCalendars();
      expect(Array.isArray(calendars)).toBe(true);

      if (calendars.length > 0) {
        expect(calendars[0]).toHaveProperty('calendarName');
        expect(calendars[0]).toHaveProperty('cid');
      }
    });
  });

  describe('getServiceAccountCalendars', () => {
    it('should return calendars with decoded IDs and correct format', () => {
      const calendars = getServiceAccountCalendars();
      expect(Array.isArray(calendars)).toBe(true);

      calendars.forEach(calendar => {
        expect(calendar).toHaveProperty('id');
        expect(calendar).toHaveProperty('summary');
        expect(calendar).toHaveProperty('primary');
        expect(calendar.primary).toBe(false);
      });
    });
  });
});
