'use client';

import { useCalendar } from '@/contexts/CalendarContext';
import { CalendarEvent } from '@/types/calendar';
import { Calendar, Camera, Clock, Edit, MapPin, Plus, Trash2, Upload, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { useDevelopment } from '../contexts/DevelopmentContext';

export function Events() {
  const { data: session } = useSession();
  const { addAPILog } = useDevelopment();
  const { selectedCalendarId, isInitialized } = useCalendar();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const [successNotification, setSuccessNotification] = useState<{
    show: boolean;
    message: string;
    events: CalendarEvent[];
  }>({
    show: false,
    message: '',
    events: []
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    summary: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    location: ''
  });

  const fetchEvents = useCallback(async () => {
    if (!session || !isInitialized) return;

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      // Log the API call
      addAPILog({
        service: 'calendar',
        method: 'GET',
        endpoint: '/api/events/upcoming',
        payload: { calendarId: selectedCalendarId },
      });

      const url = new URL('/api/events/upcoming', window.location.origin);
      url.searchParams.append('calendarId', selectedCalendarId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        // Log the error
        addAPILog({
          service: 'calendar',
          method: 'GET',
          endpoint: '/api/events/upcoming',
          error: data.error || 'Failed to fetch events',
          duration,
        });
        throw new Error(data.error || 'Failed to fetch events');
      }

      // Log successful response
      addAPILog({
        service: 'calendar',
        method: 'GET',
        endpoint: '/api/events/upcoming',
        response: data, // Log the full response
        duration,
      });

      if (data.events && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';

      // Log the error if not already logged
      if (!(err instanceof Error && err.message.includes('Failed to fetch events'))) {
        addAPILog({
          service: 'calendar',
          method: 'GET',
          endpoint: '/api/events/upcoming',
          error: errorMessage,
          duration,
        });
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [session, addAPILog, isInitialized, selectedCalendarId]);

  useEffect(() => {
    fetchEvents();
  }, [session, fetchEvents]);

  const formatDateTime = (dateTime: string | undefined) => {
    if (!dateTime) return 'All day';

    const date = new Date(dateTime);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '';

    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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
      ? new Date(event.end.dateTime).toLocaleTimeString('en-GB', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        })
      : '';

    return endTime ? `${startTime} - ${endTime}` : startTime;
  };

  const deleteEvent = async (eventId: string, eventSummary: string) => {
    if (!session || !eventId || !isInitialized) return;

    const confirmed = confirm(`Are you sure you want to delete "${eventSummary}"?`);
    if (!confirmed) return;

    setIsDeleting(eventId);

    try {
      const startTime = Date.now();

      // Log the API call
      addAPILog({
        service: 'calendar',
        method: 'DELETE',
        endpoint: `/api/events/${eventId}`,
        payload: { eventId, calendarId: selectedCalendarId },
      });

      const url = new URL(`/api/events/${eventId}`, window.location.origin);
      url.searchParams.append('calendarId', selectedCalendarId);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const data = await response.json();
        // Log the error
        addAPILog({
          service: 'calendar',
          method: 'DELETE',
          endpoint: `/api/events/${eventId}`,
          error: data.error || 'Failed to delete event',
          duration,
        });
        throw new Error(data.error || 'Failed to delete event');
      }

      // Log successful response
      addAPILog({
        service: 'calendar',
        method: 'DELETE',
        endpoint: `/api/events/${eventId}`,
        response: { success: true },
        duration,
      });

      // Remove the event from the local state
      setEvents(events.filter(event => event.id !== eventId));

      // Show success message (you could use a toast library instead)
      alert(`Event "${eventSummary}" deleted successfully!`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event';
      setError(errorMessage);

      // Show error message
      alert(`Failed to delete event: ${errorMessage}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const editEvent = (event: CalendarEvent) => {
    // Convert event data to form format
    const startDateTime = event.start?.dateTime || event.start?.date || '';
    const endDateTime = event.end?.dateTime || event.end?.date || '';

    // Convert to local datetime format for input fields
    const formatForInput = (dateTimeStr: string) => {
      if (!dateTimeStr) return '';
      const date = new Date(dateTimeStr);
      return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    };

    setEditForm({
      summary: event.summary || '',
      description: event.description || '',
      startDateTime: formatForInput(startDateTime),
      endDateTime: formatForInput(endDateTime),
      location: event.location || ''
    });

    setEditingEvent(event);
  };

  const closeEditModal = () => {
    setEditingEvent(null);
    setEditForm({
      summary: '',
      description: '',
      startDateTime: '',
      endDateTime: '',
      location: ''
    });
  };

  const saveEventChanges = async () => {
    if (!editingEvent || !session || !isInitialized) return;

    setIsSaving(true);

    try {
      const startTime = Date.now();
      const isNewEvent = editingEvent.id === 'new';

      // Convert form data to event format
      const eventData = {
        summary: editForm.summary,
        description: editForm.description,
        location: editForm.location,
        start: {
          dateTime: new Date(editForm.startDateTime).toISOString(),
        },
        end: {
          dateTime: new Date(editForm.endDateTime).toISOString(),
        },
        calendarId: selectedCalendarId
      };

      const method = isNewEvent ? 'POST' : 'PATCH';
      const endpoint = isNewEvent ? '/api/events' : `/api/events/${editingEvent.id}`;

      // Log the API call
      addAPILog({
        service: 'calendar',
        method,
        endpoint,
        payload: eventData,
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(eventData),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const data = await response.json();
        // Log the error
        addAPILog({
          service: 'calendar',
          method,
          endpoint,
          error: data.error || `Failed to ${isNewEvent ? 'create' : 'update'} event`,
          duration,
        });
        throw new Error(data.error || `Failed to ${isNewEvent ? 'create' : 'update'} event`);
      }

      const result = await response.json();

      // Log successful response
      addAPILog({
        service: 'calendar',
        method,
        endpoint,
        response: result,
        duration,
      });

      if (isNewEvent) {
        // Add the new event to the local state
        setEvents([result.event, ...events]);
      } else {
        // Update the event in the local state
        setEvents(events.map(event =>
          event.id === editingEvent.id
            ? { ...event, ...eventData }
            : event
        ));
      }

      closeEditModal();

      // Show success message
      alert(`Event "${editForm.summary}" ${isNewEvent ? 'created' : 'updated'} successfully!`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${editingEvent.id === 'new' ? 'create' : 'update'} event`;
      setError(errorMessage);

      // Show error message
      alert(`Failed to ${editingEvent.id === 'new' ? 'create' : 'update'} event: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const createNewEvent = () => {
    // Set up form for creating a new event
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    setEditForm({
      summary: '',
      description: '',
      startDateTime: now.toISOString().slice(0, 16),
      endDateTime: oneHourLater.toISOString().slice(0, 16),
      location: ''
    });

    setEditingEvent({ id: 'new' } as CalendarEvent); // Use special 'new' ID
  };

  const processImageForEvents = useCallback(async (file: File) => {
    if (!session || !isInitialized) return;

    setIsProcessingImage(true);

    try {
      const startTime = Date.now();

      // Convert image to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Log the API call
      addAPILog({
        service: 'ai',
        method: 'POST',
        endpoint: '/api/events/from-image',
        payload: { fileName: file.name, fileSize: file.size, calendarId: selectedCalendarId },
      });

      const response = await fetch('/api/events/from-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          image: base64,
          fileName: file.name,
          calendarId: selectedCalendarId
        }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const data = await response.json();
        // Log the error
        addAPILog({
          service: 'ai',
          method: 'POST',
          endpoint: '/api/events/from-image',
          error: data.error || 'Failed to process image',
          duration,
        });
        throw new Error(data.error || 'Failed to process image');
      }

      const result = await response.json();

      // Log successful response
      addAPILog({
        service: 'ai',
        method: 'POST',
        endpoint: '/api/events/from-image',
        response: { eventsCreated: result.events?.length || 0 },
        duration,
      });

      if (result.events && result.events.length > 0) {
        // Add the new events to the local state
        setEvents([...result.events, ...events]);

        // Show detailed success notification with event information
        const analysisNote = result.analysis?.eventsExtracted && result.analysis.eventsExtracted > result.events.length
          ? `\n\nNote: ${result.analysis.eventsExtracted - result.events.length} additional event(s) were detected but couldn't be created (possibly due to missing dates or conflicts).`
          : '';

        // Show enhanced notification
        setSuccessNotification({
          show: true,
          message: `Successfully created ${result.events.length} event(s) from your image!${analysisNote}`,
          events: result.events
        });

        // Auto-hide notification after 10 seconds
        setTimeout(() => {
          setSuccessNotification({ show: false, message: '', events: [] });
        }, 10000);

        // Refresh events to get the latest from server
        fetchEvents();
      } else {
        alert('No events could be extracted from the image. Please try with a clearer image containing dates and event information.');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      setError(errorMessage);

      // Show error message
      alert(`Failed to process image: ${errorMessage}`);
    } finally {
      setIsProcessingImage(false);
    }
  }, [session, addAPILog, events, fetchEvents, isInitialized, selectedCalendarId]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image file too large. Please select an image under 10MB.');
        return;
      }

      processImageForEvents(file);
    }
  };

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Convert base64 to blob
        fetch(imageSrc)
          .then((res) => res.blob())
          .then((blob) => {
            // Create a File object from the blob
            const file = new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' });
            processImageForEvents(file);
            setShowWebcam(false);
          })
          .catch((error) => {
            console.error('Error processing webcam capture:', error);
            alert('Failed to process photo. Please try again.');
          });
      }
    }
  }, [processImageForEvents]);

  const openWebcam = () => {
    setShowWebcam(true);
  };

  const closeWebcam = () => {
    setShowWebcam(false);
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
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={createNewEvent}
          >
            <Plus className="w-4 h-4" />
            New Event
          </button>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-secondary btn-sm gap-2">
              <Camera className="w-4 h-4" />
              Image to Calendar
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64">
              <li>
                <div className="text-xs text-base-content/70 p-2">
                  Upload an image with notes, schedules, or event information. AI will extract and create calendar events automatically.
                </div>
              </li>
              <li>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isProcessingImage}
                  />
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {isProcessingImage ? 'Processing...' : 'Choose Image'}
                  </div>
                </label>
              </li>
              <li>
                <button
                  className="cursor-pointer flex items-center gap-2"
                  onClick={openWebcam}
                  disabled={isProcessingImage}
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
              </li>
              {isProcessingImage && (
                <li>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="loading loading-spinner loading-xs"></span>
                    Analyzing image and creating events...
                  </div>
                </li>
              )}
            </ul>
          </div>
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
                        <a onClick={() => editEvent(event)} className="cursor-pointer">
                          <Edit className="w-4 h-4" />
                          Edit
                        </a>
                      </li>
                      <li>
                        <a
                          className={`text-error cursor-pointer ${isDeleting === event.id ? 'loading' : ''}`}
                          onClick={() => deleteEvent(event.id!, event.summary || 'Untitled Event')}
                          style={{ pointerEvents: isDeleting === event.id ? 'none' : 'auto' }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {isDeleting === event.id ? 'Deleting...' : 'Delete'}
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

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingEvent.id === 'new' ? 'Create New Event' : 'Edit Event'}
            </h3>

            <div className="space-y-4">
              {/* Event Title */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Event Title</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter event title"
                  className="input input-bordered w-full"
                  value={editForm.summary}
                  onChange={(e) => setEditForm({...editForm, summary: e.target.value})}
                />
              </div>

              {/* Event Description */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  placeholder="Enter event description"
                  className="textarea textarea-bordered h-24"
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                />
              </div>

              {/* Location */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Location</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter location"
                  className="input input-bordered w-full"
                  value={editForm.location}
                  onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                />
              </div>

              {/* Start Date & Time */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Start Date & Time</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={editForm.startDateTime}
                  onChange={(e) => setEditForm({...editForm, startDateTime: e.target.value})}
                />
              </div>

              {/* End Date & Time */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">End Date & Time</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={editForm.endDateTime}
                  onChange={(e) => setEditForm({...editForm, endDateTime: e.target.value})}
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={closeEditModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className={`btn btn-primary ${isSaving ? 'loading' : ''}`}
                onClick={saveEventChanges}
                disabled={isSaving || !editForm.summary || !editForm.startDateTime || !editForm.endDateTime}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webcam Modal */}
      {showWebcam && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Take Photo for Event Extraction
            </h3>

            <div className="space-y-4">
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="w-full rounded-lg"
                  videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: "user"
                  }}
                />
              </div>

              <div className="text-sm text-base-content/70">
                Position your camera to capture notes, schedules, or event information.
                AI will analyze the photo and create calendar events automatically.
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={closeWebcam}
                disabled={isProcessingImage}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={capturePhoto}
                disabled={isProcessingImage}
              >
                <Camera className="w-4 h-4 mr-2" />
                {isProcessingImage ? 'Processing...' : 'Capture & Analyze'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {successNotification.show && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success shadow-lg max-w-md">
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  🎉
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-2">
                    {successNotification.message.split('\n\n')[0]}
                  </h4>
                  <div className="space-y-1">
                    {successNotification.events.map((event, index) => {
                      const startTime = event.start?.dateTime
                        ? new Date(event.start.dateTime).toLocaleString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : event.start?.date
                          ? new Date(event.start.date).toLocaleDateString('en-GB', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })
                          : 'Time TBD';

                      return (
                        <div key={event.id || index} className="text-xs text-green-800 flex items-center gap-2">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span className="font-medium">{event.summary || 'Untitled Event'}</span>
                          <span className="text-green-600">- {startTime}</span>
                        </div>
                      );
                    })}
                  </div>
                  {successNotification.message.includes('Note:') && (
                    <div className="text-xs text-green-700 mt-2 italic">
                      {successNotification.message.split('Note:')[1]?.trim()}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setSuccessNotification({ show: false, message: '', events: [] })}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
