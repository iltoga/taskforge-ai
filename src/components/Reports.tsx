'use client';

import { Calendar, Clock, Download, FileText } from 'lucide-react';
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
  const [company, setCompany] = useState<string>('');

  const getDateRange = (period: string): { startDate: string; endDate: string; label: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;
    let endDate: Date;
    let label: string;

    switch (period) {
      case 'current-week':
        // Start of current week (Monday)
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
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const lastQuarterYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
        startDate = new Date(lastQuarterYear, lastQuarter * 3, 1);
        endDate = new Date(lastQuarterYear, lastQuarter * 3 + 3, 0);
        label = 'Last Quarter';
        break;

      default:
        // Default to current week
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

      const response = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      <div className="text-center py-8">
        <p className="text-base-content/70">Please sign in to generate reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Work Reports
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Company Name</span>
              </label>
              <input
                type="text"
                placeholder="Enter company name"
                className="input input-bordered w-full"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Select Period</span>
              </label>
              <select
                className="select select-bordered"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="current-week">Current Week</option>
                <option value="last-week">Last Week</option>
                <option value="last-month">Last Month</option>
                <option value="last-two-months">Last Two Months</option>
                <option value="last-quarter">Last Quarter</option>
              </select>
            </div>
          </div>

          <div className="card-actions">
            <button
              onClick={generateReport}
              className="btn btn-primary gap-2"
              disabled={isLoading || !company.trim()}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="alert alert-error mt-4">
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {report && (
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold">Report for {report.period}</h3>
                <p className="text-base-content/70 text-sm">
                  Generated on {new Date().toLocaleDateString('en-GB')}
                </p>
              </div>
              <button
                onClick={downloadReport}
                className="btn btn-outline btn-sm gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-figure text-primary">
                  <Calendar className="w-8 h-8" />
                </div>
                <div className="stat-title">Total Events</div>
                <div className="stat-value text-primary">{report.totalEvents}</div>
              </div>

              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-figure text-secondary">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="stat-title">Working Hours</div>
                <div className="stat-value text-secondary">{report.workingHours}h</div>
              </div>

              <div className="stat bg-base-200 rounded-lg">
                <div className="stat-figure text-accent">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="stat-title">Meeting Hours</div>
                <div className="stat-value text-accent">{report.meetingHours}h</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Summary</h4>
              <div className="bg-base-200 p-4 rounded-lg">
                <p className="whitespace-pre-wrap">{report.summary}</p>
              </div>
            </div>

            {report.events.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-3">Events Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Duration</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.events.map((event, index) => (
                        <tr key={index}>
                          <td>{event.title}</td>
                          <td>{event.duration}</td>
                          <td>
                            <span className="badge badge-outline">
                              {event.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
