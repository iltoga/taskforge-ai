'use client';

import { CalendarEvent } from '@/types/calendar';
import { Calendar, Clock, Edit, MapPin, Plus, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

export function Events() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'List my upcoming events for the next 7 days',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }

      if (data.data && Array.isArray(data.data)) {
        setEvents(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchEvents();
  }, [session, fetchEvents]);

  const formatDateTime = (dateTime: string | undefined) => {
    if (!dateTime) return 'All day';

    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '';

    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isAllDay = (event: CalendarEvent) => {
    return event.start?.date && !event.start?.dateTime;
  };

  const getEventTime = (event: CalendarEvent) => {
    if (isAllDay(event)) {
      return formatDate(event.start?.date);
    }

    const startTime = formatDateTime(event.start?.dateTime);
    const endTime = event.end?.dateTime
      ? new Date(event.end.dateTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    return endTime ? `${startTime} - ${endTime}` : startTime;
  };

  if (!session) {
    return (
      <div className="text-center py-8">
        <p className="text-base-content/70">Please sign in to view your events</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Upcoming Events
        </h2>
        <div className="flex gap-2">
          <button
            onClick={fetchEvents}
            className="btn btn-outline btn-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              'Refresh'
            )}
          </button>
          <button className="btn btn-primary btn-sm gap-2">
            <Plus className="w-4 h-4" />
            New Event
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
          <p className="text-base-content/70">
            You don&apos;t have any events scheduled for the next 7 days.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
            >
              <div className="card-body p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{event.summary}</h3>

                    <div className="flex items-center gap-2 text-sm text-base-content/70 mb-2">
                      <Clock className="w-4 h-4" />
                      <span>{getEventTime(event)}</span>
                      {isAllDay(event) && (
                        <span className="badge badge-outline badge-sm">All day</span>
                      )}
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-base-content/70 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {event.description && (
                      <p className="text-sm text-base-content/80 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="dropdown dropdown-end">
                    <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01"
                        />
                      </svg>
                    </div>
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                    >
                      <li>
                        <a>
                          <Edit className="w-4 h-4" />
                          Edit
                        </a>
                      </li>
                      <li>
                        <a className="text-error">
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
