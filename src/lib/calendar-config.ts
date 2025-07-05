import { readFileSync } from 'fs';
import { join } from 'path';

export interface AllowedCalendar {
  calendarName: string;
  cid: string; // Base64 encoded calendar ID
}

export interface AllowedCalendarsConfig {
  allowedGoogleCalendars: AllowedCalendar[];
}

/**
 * Decode base64 encoded calendar ID
 */
export function decodeCalendarId(encodedId: string): string {
  try {
    // Validate that the string looks like base64
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encodedId)) {
      console.warn('Invalid base64 format, returning as-is:', encodedId);
      return encodedId;
    }

    const decoded = Buffer.from(encodedId, 'base64').toString('utf-8');

    // Validate that the decoded string looks like a calendar ID (contains @)
    if (!decoded.includes('@')) {
      console.warn('Decoded string does not look like a calendar ID, returning original:', encodedId);
      return encodedId;
    }

    return decoded;
  } catch (error) {
    console.error('Failed to decode calendar ID:', error);
    return encodedId; // Return as-is if decoding fails
  }
}

/**
 * Load allowed calendars from configuration file
 */
export function loadAllowedCalendars(): AllowedCalendar[] {
  try {
    const configPath = join(process.cwd(), 'settings', 'allowed-calendars.json');
    const configData = readFileSync(configPath, 'utf8');
    const config: AllowedCalendarsConfig = JSON.parse(configData);
    return config.allowedGoogleCalendars || [];
  } catch (error) {
    console.warn('⚠️ Could not load allowed calendars config:', error);
    return [];
  }
}

/**
 * Check if we're using service account mode for calendar operations
 */
export function isServiceAccountMode(): boolean {
  return process.env.CALENDAR_AUTH_MODE === 'service-account';
}

/**
 * Get calendar info for service account mode
 */
export function getServiceAccountCalendars(): Array<{ id: string; summary: string; primary?: boolean }> {
  const allowedCalendars = loadAllowedCalendars();

  return allowedCalendars.map(cal => ({
    id: decodeCalendarId(cal.cid),
    summary: cal.calendarName,
    primary: false // Service account calendars are not primary
  }));
}
