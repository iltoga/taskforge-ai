'use client';

import { useCalendar } from '@/contexts/CalendarContext';
import { Calendar, RefreshCw, Save, Settings, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Auth mode display component
function AuthModeDisplay({ mode }: { mode?: string }) {
  if (!mode) return null;

  const isServiceAccount = mode === 'service-account';

  return (
    <div className={`alert ${isServiceAccount ? 'alert-info' : 'alert-success'} mb-4`}>
      <div className="flex items-start gap-3">
        <Settings className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium">
            {isServiceAccount ? 'Service Account Mode' : 'OAuth Mode'}
          </h3>
          <p className="text-sm opacity-80">
            {isServiceAccount
              ? 'Using predefined calendars with service account authentication'
              : 'Using your personal Google calendars with OAuth authentication'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const {
    selectedCalendarId,
    setSelectedCalendarId,
    availableCalendars,
    setAvailableCalendars,
    isLoading,
    setIsLoading,
    isInitialized
  } = useCalendar();

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authMode, setAuthMode] = useState<string>('');

  const fetchCalendars = useCallback(async () => {
    if (!isInitialized) {
      console.log('Context not initialized yet, skipping calendar fetch');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/calendar/calendars');
      if (!response.ok) {
        throw new Error('Failed to fetch calendars');
      }
      const data = await response.json();
      setAvailableCalendars(data.calendars || []);
      setAuthMode(data.mode || ''); // Store the authentication mode
    } catch (error) {
      console.error('Error fetching calendars:', error);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [setAvailableCalendars, setIsLoading, isInitialized]);

  useEffect(() => {
    // Only fetch calendars if we don't have any AND we're initialized
    // The CalendarContext will automatically fetch them on initialization if needed
    if (isInitialized && availableCalendars.length === 0 && !isLoading) {
      console.log('SettingsPage: No calendars available, fetching...');
      fetchCalendars();
    }

    // Fetch auth mode separately if we don't have it but we have calendars
    // (this happens when CalendarContext fetches calendars but doesn't get auth mode)
    if (isInitialized && !authMode && availableCalendars.length > 0) {
      const fetchAuthMode = async () => {
        try {
          const response = await fetch('/api/calendar/calendars');
          if (response.ok) {
            const data = await response.json();
            setAuthMode(data.mode || '');
          }
        } catch (error) {
          console.error('Error fetching auth mode:', error);
        }
      };
      fetchAuthMode();
    }
  }, [fetchCalendars, isInitialized, availableCalendars.length, isLoading, authMode]);

  const handleCalendarChange = (calendarId: string) => {
    setSaveStatus('saving');
    setSelectedCalendarId(calendarId);

    // Show saved status
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="avatar">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-base-content">Settings</h1>
          <p className="text-base-content/70 text-sm">Customize your calendar assistant experience</p>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-6">

        {/* Authentication Mode Display */}
        <AuthModeDisplay mode={authMode} />

        {/* Calendar Selection Card */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="card-title text-lg">Calendar Selection</h2>
                  <p className="text-sm text-base-content/70">Choose which calendar to use for events and operations</p>
                </div>
              </div>

              <button
                className="btn btn-ghost btn-sm gap-2"
                onClick={fetchCalendars}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {/* Calendar Selector */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-medium">Active Calendar</span>
                  {saveStatus === 'saving' && (
                    <span className="label-text-alt text-warning flex items-center gap-1">
                      <span className="loading loading-spinner loading-xs"></span>
                      Saving...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="label-text-alt text-success flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      Saved
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="label-text-alt text-error">Error saving</span>
                  )}
                </label>

                <select
                  className="select select-bordered w-full"
                  value={selectedCalendarId}
                  onChange={(e) => handleCalendarChange(e.target.value)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <option>Loading calendars...</option>
                  ) : availableCalendars.length === 0 ? (
                    <option>No calendars available</option>
                  ) : (
                    availableCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary} {calendar.primary ? '(Primary)' : ''}
                      </option>
                    ))
                  )}
                </select>

                <label className="label">
                  <span className="label-text-alt">
                    Selected calendar will be used for all calendar operations
                  </span>
                </label>
              </div>

              {/* Calendar Details */}
              {selectedCalendarId && !isLoading && (
                <div className="alert alert-info">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium">Current Selection</h3>
                      <p className="text-sm opacity-80">
                        {availableCalendars.find(cal => cal.id === selectedCalendarId)?.summary || 'Unknown Calendar'}
                        {availableCalendars.find(cal => cal.id === selectedCalendarId)?.primary && ' (Primary Calendar)'}
                      </p>
                      <p className="text-xs opacity-60 mt-1">
                        Access: {availableCalendars.find(cal => cal.id === selectedCalendarId)?.accessRole || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Settings Placeholder */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Settings className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h2 className="card-title text-lg">More Settings</h2>
                <p className="text-sm text-base-content/70">Additional preferences and configurations</p>
              </div>
            </div>

            <div className="alert alert-warning">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <div>
                  <h3 className="font-medium">Coming Soon</h3>
                  <p className="text-sm">More customization options will be available in future updates.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
