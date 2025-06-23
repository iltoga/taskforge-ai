'use client';

import { BarChart3, Building2, Calendar, Clock, Download, FileText, TrendingUp, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface WeeklyReport {
  period: string;
  totalEvents: number;
  workingHours: number;
  meetingHours: number;
  summary: string;
  events: Array<{
    title: string;
    duration: string;
    type: string;
  }>;
}

export function Reports() {
  const { data: session } = useSession();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current-week');
  const [company, setCompany] = useState<string>('nespola');

  const periodOptions = [
    { value: 'current-week', label: 'Current Week', icon: Calendar },
    { value: 'last-week', label: 'Last Week', icon: Calendar },
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
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label
    };
  };

  const generateReport = async () => {
    if (!session || !company.trim()) {
      setError('Please enter a company name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange(selectedPeriod);

      // Debug: Log the calculated date range
      console.log(`🗓️ Generating report for period: ${selectedPeriod}`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);
      console.log(`🏢 Company: ${company.trim()}`);

      const response = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          company: company.trim(),
          startDate,
          endDate,
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

    const reportText = `Work Report - ${label}
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
    a.download = `work-report-${company.toLowerCase().replace(/\s+/g, '-')}-${selectedPeriod}.txt`;
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
          <p className="text-base-content/60">Please sign in to access work reports</p>
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
          Work Reports
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

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Company Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="w-4 h-4 text-primary" />
                Company Name
              </label>
              <input
                type="text"
                placeholder="Enter your company name..."
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
          </div>

          {/* Generate Button */}
          <div className="flex justify-center">
            <button
              onClick={generateReport}
              disabled={isLoading || !company.trim()}
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

                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr className="border-base-300">
                        <th className="bg-base-200 text-base-content/80 font-semibold">Event</th>
                        <th className="bg-base-200 text-base-content/80 font-semibold">Duration</th>
                        <th className="bg-base-200 text-base-content/80 font-semibold">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.events.map((event, index) => (
                        <tr key={index} className="hover:bg-base-100 transition-colors duration-200">
                          <td className="font-medium">{event.title}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-base-content/50" />
                              {event.duration}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-outline badge-sm hover:badge-primary transition-all duration-200">
                              {event.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
