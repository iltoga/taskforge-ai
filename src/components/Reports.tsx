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
  const [selectedWeek, setSelectedWeek] = useState<string>('');

  const generateReport = async () => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weekOffset: selectedWeek ? parseInt(selectedWeek) : 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const reportText = `Weekly Work Report
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
    a.download = `weekly-report-${report.period.replace(/ /g, '-')}.txt`;
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
            Weekly Work Reports
          </h2>

          <div className="form-control w-full max-w-xs mb-4">
            <label className="label">
              <span className="label-text">Select Week</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              <option value="0">Current Week</option>
              <option value="-1">Last Week</option>
              <option value="-2">2 Weeks Ago</option>
              <option value="-3">3 Weeks Ago</option>
              <option value="-4">4 Weeks Ago</option>
            </select>
          </div>

          <div className="card-actions">
            <button
              onClick={generateReport}
              className="btn btn-primary gap-2"
              disabled={isLoading}
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
