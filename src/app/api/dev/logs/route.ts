import { NextResponse } from 'next/server';
import { serverDevLogger } from '../../../../lib/dev-logger';

export async function GET() {
  // Only return logs in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const logs = serverDevLogger.getLogs();
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching dev logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function DELETE() {
  // Only allow clearing logs in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    serverDevLogger.clearLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing dev logs:', error);
    return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
  }
}
