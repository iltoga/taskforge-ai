import { createGoogleAuth } from "@/lib/auth-compat";
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { auth } from "@/lib/auth-compat";
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await auth() as ExtendedSession;

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check for token refresh errors
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.' },
        { status: 401 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get calendarId from query parameters
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId') || 'primary';

    console.log(`📅 Using calendar: ${calendarId}`);

    // Initialize calendar service
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);

    console.log(`🗑️ Deleting event: ${eventId}`);

    // Delete the event
    await calendarService.deleteEvent(eventId, calendarId);

    console.log(`✅ Event deleted successfully: ${eventId}`);

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    console.error('Delete event API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete event'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await auth() as ExtendedSession;

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check for token refresh errors
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.' },
        { status: 401 }
      );
    }

    const updates = await request.json();

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Extract calendarId from updates, default to 'primary'
    const calendarId = updates.calendarId || 'primary';
    console.log(`📅 Using calendar: ${calendarId}`);

    // Initialize calendar service
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);

    console.log(`✏️ Updating event: ${eventId}`, updates);

    // Update the event
    const updatedEvent = await calendarService.updateEvent(eventId, updates, calendarId);

    console.log(`✅ Event updated successfully: ${eventId}`);

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: 'Event updated successfully'
    });

  } catch (error) {
    console.error('Update event API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update event'
      },
      { status: 500 }
    );
  }
}
