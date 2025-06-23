import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚀 Weekly report API called (redirecting to unified reports API)');

  try {
    const body = await request.json();

    // Add reportType for weekly reports
    const requestBody = {
      ...body,
      reportType: 'weekly'
    };

    // Forward to the unified reports API
    const response = await fetch(new URL('/api/reports', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Weekly report API forwarding error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process weekly report request'
      },
      { status: 500 }
    );
  }
}
