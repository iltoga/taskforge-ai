import { getServiceAccountAuth, isServiceAccountAvailable } from "@/lib/auth";
import { OAuth2Client } from "google-auth-library";
import { calendar_v3, google } from "googleapis";
import { serverDevLogger } from "../lib/dev-logger";
import { CalendarEvent, EventList } from "../types/calendar";
import { CalendarService } from "./calendar-service";

/**
 * Enhanced Calendar Service with alternative authentication support
 * Supports both user OAuth and service account authentication
 * Uses composition to maintain compatibility while adding new functionality
 */
export class EnhancedCalendarService {
  private userCalendarService?: CalendarService;
  private serviceAccountClient: OAuth2Client | null = null;
  private useServiceAccount: boolean;
  private calendar: calendar_v3.Calendar | null = null;

  constructor(userAuth?: OAuth2Client, useServiceAccount: boolean = false) {
    this.useServiceAccount = useServiceAccount;

    if (userAuth) {
      this.userCalendarService = new CalendarService(userAuth);
    }
  }

  /**
   * Factory method to create service with automatic authentication fallback
   */
  static async createWithFallback(
    userAuth?: OAuth2Client,
    preferServiceAccount: boolean = false
  ): Promise<EnhancedCalendarService> {
    // If service account is preferred and available, use it
    if (preferServiceAccount && isServiceAccountAvailable()) {
      const serviceAuth = await getServiceAccountAuth();
      if (serviceAuth) {
        console.log("🔧 Using service account authentication");
        const service = new EnhancedCalendarService(undefined, true);
        service.serviceAccountClient = serviceAuth;
        return service;
      }
    }

    // Use user OAuth if available
    if (userAuth) {
      console.log("🔐 Using user OAuth authentication");
      return new EnhancedCalendarService(userAuth, false);
    }

    // Fallback to service account if user auth not available
    if (isServiceAccountAvailable()) {
      const serviceAuth = await getServiceAccountAuth();
      if (serviceAuth) {
        console.log("🔄 Falling back to service account authentication");
        const service = new EnhancedCalendarService(undefined, true);
        service.serviceAccountClient = serviceAuth;
        return service;
      }
    }

    throw new Error(
      "No authentication method available. Ensure either user OAuth or service account credentials are configured."
    );
  }

  /**
   * Get the appropriate calendar client (user or service account)
   */
  private async getCalendarClient(): Promise<calendar_v3.Calendar> {
    if (this.useServiceAccount) {
      if (!this.serviceAccountClient) {
        this.serviceAccountClient = await getServiceAccountAuth();
        if (!this.serviceAccountClient) {
          throw new Error("Service account authentication not available");
        }
      }

      if (!this.calendar) {
        this.calendar = google.calendar({
          version: "v3",
          auth: this.serviceAccountClient,
        });
      }

      return this.calendar;
    }

    // For user OAuth, delegate to the user calendar service
    if (!this.userCalendarService) {
      throw new Error("User calendar service not initialized");
    }

    // Access the auth client from the user service
    const userAuth = (
      this.userCalendarService as unknown as { auth: OAuth2Client }
    ).auth;
    return google.calendar({ version: "v3", auth: userAuth });
  }

  /**
   * Enhanced executeWithRetry that handles both auth types
   */
  private async executeWithRetryEnhanced<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Handle authentication errors
      if (
        error instanceof Error &&
        (error.message.includes("invalid authentication") ||
          error.message.includes("OAuth 2 access token") ||
          error.message.includes("authentication credential"))
      ) {
        serverDevLogger.log({
          service: "calendar",
          method: "ERROR_HANDLING",
          endpoint: `${operationName}_AUTH_ERROR`,
          error: `Authentication error in ${operationName}, attempting fallback: ${error.message}`,
        });

        // If using user OAuth, try falling back to service account
        if (!this.useServiceAccount && isServiceAccountAvailable()) {
          console.log(
            "🔄 User OAuth failed, attempting service account fallback..."
          );

          try {
            await this.switchToServiceAccount();

            serverDevLogger.log({
              service: "calendar",
              method: "ERROR_HANDLING",
              endpoint: `${operationName}_FALLBACK_SUCCESS`,
              response: {
                message: `Service account fallback successful for ${operationName}`,
              },
            });

            // Retry with service account
            return await operation();
          } catch (fallbackError) {
            serverDevLogger.log({
              service: "calendar",
              method: "ERROR_HANDLING",
              endpoint: `${operationName}_FALLBACK_FAILED`,
              error: `Service account fallback failed for ${operationName}: ${
                fallbackError instanceof Error
                  ? fallbackError.message
                  : "Unknown error"
              }`,
            });
          }
        }

        // If service account or no fallback available, re-throw the error
        if (this.userCalendarService) {
          // Try to use the user service's existing getEvents method
          throw error;
        }
      }

      // If it's not an auth error, just throw it
      throw error;
    }
  }

  /**
   * Override getEvents to use enhanced authentication
   */
  async getEvents(
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string,
    showDeleted?: boolean,
    orderBy?: "startTime" | "updated",
    timeZone?: string,
    calendarId?: string
  ): Promise<EventList> {
    // If using service account, we need to specify which calendar to access
    // Service accounts typically need explicit calendar sharing
    if (this.useServiceAccount && !calendarId) {
      console.log(
        "⚠️ Service account usage: Using primary calendar. Ensure calendar is shared with service account."
      );
    }

    return this.executeWithRetryEnhanced(async () => {
      const calendar = await this.getCalendarClient();

      // Convert date strings to RFC3339 format if they're in YYYY-MM-DD format
      const formatDateForCalendarAPI = (
        dateStr?: string
      ): string | undefined => {
        if (!dateStr) return undefined;
        if (dateStr.includes("T") || dateStr.includes("Z")) {
          return dateStr;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return `${dateStr}T00:00:00Z`;
        }
        return dateStr;
      };

      const params = {
        calendarId: calendarId || "primary",
        timeMin: formatDateForCalendarAPI(timeMin),
        timeMax: formatDateForCalendarAPI(timeMax),
        maxResults: maxResults || 250,
        q,
        showDeleted: showDeleted || false,
        orderBy: orderBy || "startTime",
        singleEvents: true,
        timeZone: timeZone || "UTC",
      };

      const startTime = Date.now();

      serverDevLogger.log({
        service: "calendar",
        method: "GET",
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events`,
        payload: {
          ...params,
          authType: this.useServiceAccount ? "service-account" : "user-oauth",
        },
      });

      const response = await calendar.events.list(params);
      const duration = Date.now() - startTime;

      serverDevLogger.log({
        service: "calendar",
        method: "GET",
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events`,
        response: {
          eventsCount: response.data.items?.length || 0,
          nextPageToken: response.data.nextPageToken,
          summary: response.data.summary,
          updated: response.data.updated,
          authType: this.useServiceAccount ? "service-account" : "user-oauth",
        },
        duration,
      });

      return response.data as EventList;
    }, "getEvents");
  }

  /**
   * Override createEvent to use enhanced authentication
   */
  async createEvent(
    event: CalendarEvent,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithRetryEnhanced(async () => {
      const calendar = await this.getCalendarClient();

      const startTime = Date.now();

      serverDevLogger.log({
        service: "calendar",
        method: "POST",
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${
          calendarId || "primary"
        }/events`,
        payload: {
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
          attendees: event.attendees,
          authType: this.useServiceAccount ? "service-account" : "user-oauth",
        },
      });

      const response = await calendar.events.insert({
        calendarId: calendarId || "primary",
        requestBody: event,
      });

      const duration = Date.now() - startTime;

      serverDevLogger.log({
        service: "calendar",
        method: "POST",
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${
          calendarId || "primary"
        }/events`,
        response: {
          eventId: response.data.id,
          summary: response.data.summary,
          created: response.data.created,
          htmlLink: response.data.htmlLink,
          authType: this.useServiceAccount ? "service-account" : "user-oauth",
        },
        duration,
      });

      return response.data as CalendarEvent;
    }, "createEvent");
  }

  /**
   * Get current authentication type
   */
  getAuthType(): "user-oauth" | "service-account" {
    return this.useServiceAccount ? "service-account" : "user-oauth";
  }

  /**
   * Check if service account fallback is available
   */
  canFallbackToServiceAccount(): boolean {
    return !this.useServiceAccount && isServiceAccountAvailable();
  }

  /**
   * Force switch to service account authentication
   */
  async switchToServiceAccount(): Promise<void> {
    if (!isServiceAccountAvailable()) {
      throw new Error("Service account authentication not available");
    }

    this.serviceAccountClient = await getServiceAccountAuth();
    if (!this.serviceAccountClient) {
      throw new Error("Failed to get service account authentication");
    }

    this.useServiceAccount = true;
    console.log("🔄 Switched to service account authentication");
  }
}
