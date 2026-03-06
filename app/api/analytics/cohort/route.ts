/**
 * Cohort Analysis API
 * Weekly cohort metrics for conversion analysis
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface CohortData {
  cohort: string; // Format: 2024-W01
  visitors: number;
  conversations: number;
  leads: number;
  conversionRate: number; // leads / conversations
  averageCheck: number; // for closed deals
  revenue: number;
}

/**
 * Generate weekly cohort label
 */
function getCohortLabel(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil(days / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Generate mock cohort data
 * In production, query from analytics database
 */
function generateCohortData(weeks: number = 12): CohortData[] {
  const data: CohortData[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    
    const cohort = getCohortLabel(date);
    const visitors = Math.floor(Math.random() * 500) + 200;
    const conversations = Math.floor(visitors * (0.3 + Math.random() * 0.2));
    const leads = Math.floor(conversations * (0.15 + Math.random() * 0.15));
    const conversionRate = leads / conversations;
    const averageCheck = Math.floor(Math.random() * 50000) + 50000;
    const revenue = leads * averageCheck * 0.3; // 30% close rate

    data.push({
      cohort,
      visitors,
      conversations,
      leads,
      conversionRate: parseFloat(conversionRate.toFixed(3)),
      averageCheck,
      revenue: Math.floor(revenue),
    });
  }

  return data;
}

/**
 * Calculate cohort retention
 */
function calculateRetention(cohorts: CohortData[]): Array<{
  cohort: string;
  week0: number;
  week1: number;
  week2: number;
  week4: number;
  week8: number;
}> {
  return cohorts.map(cohort => ({
    cohort: cohort.cohort,
    week0: 100, // Base
    week1: Math.floor(100 * (0.6 + Math.random() * 0.2)),
    week2: Math.floor(100 * (0.4 + Math.random() * 0.2)),
    week4: Math.floor(100 * (0.3 + Math.random() * 0.15)),
    week8: Math.floor(100 * (0.2 + Math.random() * 0.1)),
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weeks = parseInt(searchParams.get('weeks') || '12', 10);
  const includeRetention = searchParams.get('retention') === 'true';

  try {
    const cohorts = generateCohortData(weeks);
    
    const response: Record<string, unknown> = {
      cohorts,
      summary: {
        totalVisitors: cohorts.reduce((sum, c) => sum + c.visitors, 0),
        totalConversations: cohorts.reduce((sum, c) => sum + c.conversations, 0),
        totalLeads: cohorts.reduce((sum, c) => sum + c.leads, 0),
        avgConversionRate: cohorts.reduce((sum, c) => sum + c.conversionRate, 0) / cohorts.length,
        totalRevenue: cohorts.reduce((sum, c) => sum + c.revenue, 0),
      },
    };

    if (includeRetention) {
      response.retention = calculateRetention(cohorts);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Cohort Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate cohorts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dateFrom, dateTo, segmentBy } = body;

    // In production, query database with filters
    const cohorts = generateCohortData(12);

    return NextResponse.json({
      cohorts,
      filters: {
        dateFrom,
        dateTo,
        segmentBy,
      },
    });

  } catch (error) {
    console.error('[Cohort Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}
