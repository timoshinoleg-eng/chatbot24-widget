/**
 * Analytics Export API
 * Multi-format data export (CSV, XLSX, JSON)
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatSessions } from '../route';

export const dynamic = 'force-dynamic';

export type ExportFormat = 'csv' | 'xlsx' | 'json';

interface ExportRequest {
  format: ExportFormat;
  dateFrom?: string;
  dateTo?: string;
  fields?: string[];
}

interface ConversationRecord {
  id: string;
  timestamp: string;
  userId: string;
  sessionId: string;
  messageCount: number;
  leadCaptured: boolean;
  leadScore?: string;
  sentiment: string;
  duration: number;
  pageUrl?: string;
  source?: string;
}

/**
 * Convert ChatSession to ConversationRecord format
 */
function convertSessionToRecord(session: typeof chatSessions[0]): ConversationRecord {
  // Determine lead score category from numeric score
  let leadScore: string | undefined;
  if (session.score !== undefined) {
    if (session.score >= 70) leadScore = 'HOT';
    else if (session.score >= 40) leadScore = 'WARM';
    else leadScore = 'COLD';
  }

  // Calculate duration (if endTime exists, use it; otherwise estimate 30 sec per message)
  const duration = session.endTime 
    ? Math.round((session.endTime - session.startTime) / 1000)
    : session.messages * 30;

  return {
    id: session.id,
    timestamp: new Date(session.startTime).toISOString(),
    userId: session.userId || 'anonymous',
    sessionId: session.id,
    messageCount: session.messages,
    leadCaptured: session.convertedToLead,
    leadScore,
    sentiment: session.sentiment,
    duration,
    pageUrl: session.pageUrl,
    source: session.source || 'direct',
  };
}

/**
 * Fetch analytics data from shared in-memory store
 */
async function fetchAnalyticsData(
  dateFrom?: string,
  dateTo?: string
): Promise<ConversationRecord[]> {
  // Convert all sessions to records
  let records = chatSessions.map(convertSessionToRecord);

  // Filter by date if provided
  if (dateFrom || dateTo) {
    records = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      if (dateFrom && recordDate < new Date(dateFrom)) return false;
      if (dateTo && recordDate > new Date(dateTo)) return false;
      return true;
    });
  }

  return records;
}

/**
 * Generate CSV content
 */
function generateCSV(data: ConversationRecord[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'User ID',
    'Session ID',
    'Message Count',
    'Lead Captured',
    'Lead Score',
    'Sentiment',
    'Duration (sec)',
    'Page URL',
    'Source',
  ];

  const rows = data.map(record => [
    record.id,
    record.timestamp,
    record.userId,
    record.sessionId,
    record.messageCount,
    record.leadCaptured ? 'Yes' : 'No',
    record.leadScore || '',
    record.sentiment,
    record.duration,
    record.pageUrl || '',
    record.source || '',
  ]);

  // Escape CSV values
  const escape = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [
    headers.join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ].join('\n');
}

/**
 * Generate JSON content
 */
function generateJSON(data: ConversationRecord[]): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Generate XLSX-like HTML (for simple download)
 * In production, use xlsx library
 */
function generateXLSXHTML(data: ConversationRecord[]): string {
  const headers = [
    'ID', 'Timestamp', 'User ID', 'Session ID', 'Message Count',
    'Lead Captured', 'Lead Score', 'Sentiment', 'Duration (sec)',
    'Page URL', 'Source',
  ];

  const rows = data.map(record => `
    <tr>
      <td>${record.id}</td>
      <td>${record.timestamp}</td>
      <td>${record.userId}</td>
      <td>${record.sessionId}</td>
      <td>${record.messageCount}</td>
      <td>${record.leadCaptured ? 'Yes' : 'No'}</td>
      <td>${record.leadScore || ''}</td>
      <td>${record.sentiment}</td>
      <td>${record.duration}</td>
      <td>${record.pageUrl || ''}</td>
      <td>${record.source || ''}</td>
    </tr>
  `).join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { format, dateFrom, dateTo } = body;

    if (!format || !['csv', 'xlsx', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use csv, xlsx, or json' },
        { status: 400 }
      );
    }

    // Fetch data from shared in-memory store
    const data = await fetchAnalyticsData(dateFrom, dateTo);

    // Generate content based on format
    let content: string;
    let contentType: string;
    let filename: string;

    const timestamp = new Date().toISOString().split('T')[0];

    switch (format) {
      case 'csv':
        content = generateCSV(data);
        contentType = 'text/csv; charset=utf-8';
        filename = `chatbot24-analytics-${timestamp}.csv`;
        break;
      case 'xlsx':
        content = generateXLSXHTML(data);
        contentType = 'application/vnd.ms-excel';
        filename = `chatbot24-analytics-${timestamp}.xls`;
        break;
      case 'json':
        content = generateJSON(data);
        contentType = 'application/json; charset=utf-8';
        filename = `chatbot24-analytics-${timestamp}.json`;
        break;
    }

    // Return with appropriate headers for download
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[Analytics Export] Error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') as ExportFormat || 'json';
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;

  try {
    const data = await fetchAnalyticsData(dateFrom, dateTo);
    
    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        format,
        dateFrom,
        dateTo,
        source: 'in-memory-store',
      },
    });

  } catch (error) {
    console.error('[Analytics Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
