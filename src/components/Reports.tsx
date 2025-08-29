'use client';

import { ModelType } from '@/appconfig/models';
import { useCalendar } from '@/contexts/CalendarContext';
import { BarChart3, Building2, Calendar, Clock, Download, FileText, TrendingUp, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ModelSelector } from './ModelSelector';

interface Report {
  period: string;
  reportType?: 'weekly' | 'monthly' | 'quarterly';
  totalEvents: number;
  workingHours: number;
  meetingHours: number;
  summary: string;
  events: Array<{
    title: string;
    description?: string | null;
    location?: string | null;
    duration: string;
    startDate?: string | null;
    endDate?: string | null;
    startTimeZone?: string | null;
    endTimeZone?: string | null;
    type: string;
    status?: string | null;
    attendees?: number;
    isAllDay?: boolean;
  }>;
}

export function Reports() {
  const { data: session } = useSession();
  const { selectedCalendarId, isInitialized } = useCalendar();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current-week');
  const [company, setCompany] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<ModelType>((process.env.OPENAI_DEFAULT_MODEL as ModelType) || "gpt-5-mini");

  const periodOptions = [
    { value: 'current-week', label: 'Current Week', icon: Calendar },
    { value: 'last-week', label: 'Last Week', icon: Calendar },
    { value: 'current-month', label: 'Current Month', icon: Calendar },
    { value: 'last-month', label: 'Last Month', icon: Calendar },
    { value: 'last-two-months', label: 'Last Two Months', icon: TrendingUp },
    { value: 'last-quarter', label: 'Last Quarter', icon: BarChart3 },
  ];

  const getDateRange = (period: string): { startDate: string; endDate: string; label: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;
    let endDate: Date;
    let label: string;

    switch (period) {
      case 'current-week':
        const currentDay = today.getDay();
        const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        label = 'Current Week';
        break;

      case 'last-week':
        const lastWeekStart = new Date(today);
        const lastWeekDay = today.getDay();
        const daysToLastMonday = lastWeekDay === 0 ? 13 : lastWeekDay + 6;
        lastWeekStart.setDate(today.getDate() - daysToLastMonday);
        startDate = lastWeekStart;
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        label = 'Last Week';
        break;

      case 'last-month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        label = 'Last Month';
        break;

      case 'current-month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        label = 'Current Month';
        break;

      case 'last-two-months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        label = 'Last Two Months';
        break;

      case 'last-quarter':
        // Current date: June 22, 2025 (Q2)
        // Last quarter would be Q1 2025 (Jan-Mar)
        const currentMonth = today.getMonth(); // 0-11 (June = 5)
        const currentYear = today.getFullYear();

        // Determine current quarter (0=Q1, 1=Q2, 2=Q3, 3=Q4)
        const currentQ = Math.floor(currentMonth / 3);

        // Calculate last quarter
        let lastQ: number;
        let lastQYear: number;

        if (currentQ === 0) {
          // If current is Q1, last quarter is Q4 of previous year
          lastQ = 3;
          lastQYear = currentYear - 1;
        } else {
          // Otherwise, it's the previous quarter of same year
          lastQ = currentQ - 1;
          lastQYear = currentYear;
        }

        // Calculate start and end dates
        const qStartMonth = lastQ * 3;
        const qEndMonth = qStartMonth + 2;

        startDate = new Date(lastQYear, qStartMonth, 1);
        endDate = new Date(lastQYear, qEndMonth + 1, 0); // Last day of quarter

        console.log(`🗓️ Last quarter calculation: Q${lastQ + 1} ${lastQYear} (months ${qStartMonth}-${qEndMonth})`);
        console.log(`📅 Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

        label = 'Last Quarter';
        break;

      default:
        const defaultDay = today.getDay();
        const daysToDefaultMonday = defaultDay === 0 ? 6 : defaultDay - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToDefaultMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        label = 'Current Week';
    }

    return {
      startDate: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
      endDate: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
      label
    };
  };

  const generateReport = async () => {
    if (!session || !isInitialized) {
      setError('Please sign in and ensure the calendar is initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange(selectedPeriod);

      // Determine report type based on selected period
      const getReportType = (period: string): 'weekly' | 'monthly' | 'quarterly' => {
        if (period.includes('week')) {
          return 'weekly';
        } else if (period.includes('quarter')) {
          return 'quarterly';
        } else {
          return 'monthly'; // months and two-months periods
        }
      };

      const reportType = getReportType(selectedPeriod);

      // Debug: Log the calculated date range
      console.log(`🗓️ Generating ${reportType} report for period: ${selectedPeriod}`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);
      console.log(`🏢 Company: ${company.trim()}`);
      console.log(`📅 Calendar: ${selectedCalendarId}`);

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          company: company.trim() || undefined,
          startDate,
          endDate,
          calendarId: selectedCalendarId,
          model: selectedModel,
          reportType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const { label } = getDateRange(selectedPeriod);
    const reportTypeLabel = report.reportType ?
      report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1) :
      'Work';

    const reportText = `${reportTypeLabel} Report - ${label}
${report.period}

Summary:
${report.summary}

Statistics:
- Total Events: ${report.totalEvents}
- Working Hours: ${report.workingHours}
- Meeting Hours: ${report.meetingHours}

Events:
${report.events.map(event => `- ${event.title} (${event.duration}) - ${event.type}`).join('\n')}

Generated on: ${new Date().toLocaleDateString('en-GB')}
`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportType || 'work'}-report-${company && company.trim() ? company.toLowerCase().replace(/\s+/g, '-') : 'all'}-${selectedPeriod}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!session) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
          <p className="text-base-content/60">Please sign in to access calendar reports</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary mb-4">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          Calendar Reports
        </h1>
        <p className="text-base-content/60 max-w-md mx-auto">
          Generate comprehensive reports for your work activities and meeting schedules
        </p>
      </div>

      {/* Report Generation Form */}
      <div className="card bg-gradient-to-br from-base-100 to-base-200 shadow-xl border border-base-300">
        <div className="card-body p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Generate Report</h2>
              <p className="text-sm text-base-content/60">Configure your report parameters</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Company Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="w-4 h-4 text-primary" />
                Fiter by Words
              </label>
              <input
                type="text"
                placeholder="Enter your query to filter..."
                className="input input-bordered w-full h-12 focus:input-primary transition-all duration-200"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <p className="text-xs text-base-content/50">This will be used to filter your daily reports</p>
            </div>

            {/* Period Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="w-4 h-4 text-primary" />
                Report Period
              </label>
              <select
                className="select select-bordered w-full h-12 focus:select-primary transition-all duration-200"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-base-content/50">Select the time period for your report</p>
            </div>

            {/* AI Model Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="w-4 h-4 text-primary" />
                AI Model
              </label>
              <div className="h-12 flex items-center">
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
              </div>
              <p className="text-xs text-base-content/50">Choose the AI model for report generation</p>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-center">
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="btn btn-primary btn-lg gap-3 px-8 disabled:opacity-50 hover:scale-105 transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Generating Report...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  Generate Report
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {/* Error Display */}
          {error && (
            <div className="alert alert-error mt-6 animate-in slide-in-from-top duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Report Results */}
      {report && (
        <div className="animate-in slide-in-from-bottom duration-500">
          {/* Report Header */}
          <div className="card bg-gradient-to-br from-primary/5 to-secondary/5 shadow-xl border border-primary/20 mb-6">
            <div className="card-body p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary">Report Generated</h3>
                    <p className="text-base-content/70">{report.period}</p>
                    <p className="text-sm text-base-content/50">
                      Generated on {new Date().toLocaleDateString('en-GB', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadReport}
                  className="btn btn-outline btn-primary gap-2 hover:scale-105 transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:shadow-xl transition-all duration-300">
              <div className="card-body p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-sm font-medium text-primary/80 mb-1">Total Events</h4>
                <p className="text-3xl font-bold text-primary">{report.totalEvents}</p>
                <p className="text-xs text-base-content/50 mt-1">Scheduled activities</p>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 hover:shadow-xl transition-all duration-300">
              <div className="card-body p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-sm font-medium text-secondary/80 mb-1">Working Hours</h4>
                <p className="text-3xl font-bold text-secondary">{report.workingHours}h</p>
                <p className="text-xs text-base-content/50 mt-1">Total work time</p>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 hover:shadow-xl transition-all duration-300">
              <div className="card-body p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-sm font-medium text-accent/80 mb-1">Meeting Hours</h4>
                <p className="text-3xl font-bold text-accent">{report.meetingHours}h</p>
                <p className="text-xs text-base-content/50 mt-1">Collaboration time</p>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="card bg-gradient-to-br from-base-100 to-base-200 shadow-xl border border-base-300 mb-6">
            <div className="card-body p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-info/20 to-info/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-info" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold">Executive Summary</h4>
                  <p className="text-sm text-base-content/60">AI-generated insights from your work period</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-base-200 to-base-300 p-6 rounded-xl border border-base-300">
                <p className="whitespace-pre-wrap text-base leading-relaxed">{report.summary}</p>
              </div>
            </div>
          </div>

          {/* Events Breakdown */}
          {report.events && report.events.length > 0 && (
            <div className="card bg-gradient-to-br from-base-100 to-base-200 shadow-xl border border-base-300">
              <div className="card-body p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold">Events Breakdown</h4>
                    <p className="text-sm text-base-content/60">Detailed list of all activities</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {report.events.map((event, index) => (
                    <div key={index} className="collapse collapse-arrow bg-gradient-to-r from-base-100 to-base-200 border border-base-300 hover:border-primary/30 transition-all duration-200">
                      <input type="checkbox" className="peer" />
                      <div className="collapse-title text-lg font-medium flex items-center justify-between pr-8">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-base-content font-semibold truncate">{event.title}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-base-content/60">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{event.duration}</span>
                          </div>
                          <span className="badge badge-outline badge-sm">
                            {event.type}
                          </span>
                        </div>
                      </div>
                      <div className="collapse-content">
                        <div className="pt-4 space-y-4">
                          {/* Event Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Basic Info */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Calendar className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm text-base-content/80">Event Title</h4>
                                  <p className="text-base-content font-semibold">{event.title}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                                  <Clock className="w-4 h-4 text-secondary" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm text-base-content/80">Duration</h4>
                                  <p className="text-base-content font-semibold">{event.duration}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-accent" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm text-base-content/80">Event Type</h4>
                                  <span className="badge badge-accent badge-sm">{event.type}</span>
                                </div>
                              </div>

                              {/* Event Description */}
                              {event.description && (
                                <div className="flex items-start gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-info" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm text-base-content/80">Description</h4>
                                    <p className="text-base-content text-sm leading-relaxed mt-1">{event.description}</p>
                                  </div>
                                </div>
                              )}

                              {/* Event Location */}
                              {event.location && (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                                    <span className="text-success">📍</span>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm text-base-content/80">Location</h4>
                                    <p className="text-base-content font-semibold">{event.location}</p>
                                  </div>
                                </div>
                              )}

                              {/* Date & Time Details */}
                              {event.startDate && (
                                <div className="flex items-start gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-warning" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm text-base-content/80">Date & Time</h4>
                                    <div className="text-sm space-y-1">
                                      <p className="text-base-content">
                                        📅 {new Date(event.startDate).toLocaleDateString('en-GB', {
                                          weekday: 'long',
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                          ...(event.startTimeZone && { timeZone: event.startTimeZone })
                                        })}
                                      </p>
                                      {!event.isAllDay && (
                                        <div className="space-y-1">
                                          <p className="text-base-content">
                                            🕐 {new Date(event.startDate).toLocaleTimeString('en-GB', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              ...(event.startTimeZone && { timeZone: event.startTimeZone })
                                            })}
                                            {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString('en-GB', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              ...(event.endTimeZone && { timeZone: event.endTimeZone })
                                            })}`}
                                          </p>
                                          {event.startTimeZone && (
                                            <p className="text-xs text-base-content/60 flex items-center gap-1">
                                              🌍 Timezone: {event.startTimeZone}
                                              {event.endTimeZone && event.endTimeZone !== event.startTimeZone && (
                                                <span> → {event.endTimeZone}</span>
                                              )}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Additional Details */}
                            <div className="space-y-3">
                              <div className="card bg-gradient-to-br from-info/5 to-info/10 border border-info/20">
                                <div className="card-body p-4">
                                  <h4 className="font-semibold text-sm flex items-center gap-2 text-info mb-2">
                                    <BarChart3 className="w-4 h-4" />
                                    Event Statistics
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-base-content/70">Event #</span>
                                      <span className="font-medium">{index + 1} of {report.events.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-base-content/70">Position</span>
                                      <span className="font-medium">{((index / report.events.length) * 100).toFixed(0)}% through period</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-base-content/70">Type Classification</span>
                                      <span className="font-medium capitalize">{event.type.replace('-', ' ')}</span>
                                    </div>
                                    {event.status && (
                                      <div className="flex justify-between">
                                        <span className="text-base-content/70">Status</span>
                                        <span className="font-medium capitalize">{event.status}</span>
                                      </div>
                                    )}
                                    {event.attendees !== undefined && (
                                      <div className="flex justify-between">
                                        <span className="text-base-content/70">Attendees</span>
                                        <span className="font-medium">{event.attendees} people</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-base-content/70">Event Format</span>
                                      <span className="font-medium">{event.isAllDay ? 'All Day' : 'Timed'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Time Analysis */}
                              {event.duration !== 'All day' && (
                                <div className="card bg-gradient-to-br from-warning/5 to-warning/10 border border-warning/20">
                                  <div className="card-body p-4">
                                    <h4 className="font-semibold text-sm flex items-center gap-2 text-warning mb-2">
                                      <Clock className="w-4 h-4" />
                                      Time Analysis
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-base-content/70">Format</span>
                                        <span className="font-medium">Timed Event</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-base-content/70">Duration</span>
                                        <span className="font-medium">{event.duration}</span>
                                      </div>
                                      {event.duration.includes('AM') || event.duration.includes('PM') ? (
                                        <div className="flex justify-between">
                                          <span className="text-base-content/70">Time Format</span>
                                          <span className="font-medium">12-hour</span>
                                        </div>
                                      ) : (
                                        <div className="flex justify-between">
                                          <span className="text-base-content/70">Time Format</span>
                                          <span className="font-medium">24-hour</span>
                                        </div>
                                      )}
                                      {event.startTimeZone && (
                                        <div className="flex justify-between">
                                          <span className="text-base-content/70">Timezone</span>
                                          <span className="font-medium text-xs">{event.startTimeZone}</span>
                                        </div>
                                      )}
                                      {event.startDate && event.endDate && (
                                        <div className="flex justify-between">
                                          <span className="text-base-content/70">Duration Calc</span>
                                          <span className="font-medium text-xs">
                                            {Math.round((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / (1000 * 60))} min
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Event Actions */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-base-300">
                            <div className="badge badge-ghost badge-sm">
                              📊 Event #{index + 1}
                            </div>
                            <div className="badge badge-ghost badge-sm">
                              🕐 {event.duration}
                            </div>
                            <div className="badge badge-ghost badge-sm">
                              📋 {event.type}
                            </div>
                            {event.location && (
                              <div className="badge badge-ghost badge-sm">
                                📍 {event.location}
                              </div>
                            )}
                            {event.attendees && event.attendees > 0 && (
                              <div className="badge badge-ghost badge-sm">
                                👥 {event.attendees} attendees
                              </div>
                            )}
                            {event.status && (
                              <div className="badge badge-ghost badge-sm">
                                ✅ {event.status}
                              </div>
                            )}
                            {event.startTimeZone && !event.isAllDay && (
                              <div className="badge badge-ghost badge-sm">
                                🌍 {event.startTimeZone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
