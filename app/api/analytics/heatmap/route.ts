/**
 * Heatmap Analytics API
 * Aggregates interaction data for heatmap visualization
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface HeatmapPoint {
  x: number; // normalized 0-1000
  y: number; // normalized 0-1000
  value: number; // intensity
  timestamp: string;
}

export interface HeatmapData {
  pageUrl: string;
  viewport: { width: number; height: number };
  points: HeatmapPoint[];
  metadata: {
    totalClicks: number;
    uniqueVisitors: number;
    avgTimeOnPage: number;
    bounceRate: number;
  };
}

export interface ScrollDepthData {
  pageUrl: string;
  depths: Array<{
    percentage: number;
    count: number;
  }>;
}

export interface TimeToOpenData {
  buckets: Array<{
    range: string; // "0-5s", "5-10s", etc.
    count: number;
  }>;
  average: number;
}

/**
 * Generate mock heatmap data
 * In production, query from analytics database
 */
function generateHeatmapData(pageUrl: string): HeatmapData {
  const points: HeatmapPoint[] = [];
  
  // Generate clustered points (simulating button clicks)
  const clusters = [
    { x: 850, y: 900, radius: 100, count: 50 }, // Chat button area
    { x: 500, y: 300, radius: 150, count: 30 }, // Main CTA
    { x: 200, y: 500, radius: 80, count: 20 }, // Navigation
  ];

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * cluster.radius;
      points.push({
        x: Math.max(0, Math.min(1000, cluster.x + Math.cos(angle) * distance)),
        y: Math.max(0, Math.min(1000, cluster.y + Math.sin(angle) * distance)),
        value: Math.floor(Math.random() * 10) + 1,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    pageUrl,
    viewport: { width: 1920, height: 1080 },
    points,
    metadata: {
      totalClicks: points.length,
      uniqueVisitors: Math.floor(points.length * 0.7),
      avgTimeOnPage: Math.floor(Math.random() * 120) + 30,
      bounceRate: parseFloat((Math.random() * 0.3 + 0.2).toFixed(2)),
    },
  };
}

/**
 * Generate scroll depth data
 */
function generateScrollDepthData(pageUrl: string): ScrollDepthData {
  const depths = [];
  const baseCount = 1000;

  for (let i = 0; i <= 100; i += 10) {
    // Simulate drop-off
    const retention = Math.exp(-i / 50); // Exponential decay
    depths.push({
      percentage: i,
      count: Math.floor(baseCount * retention),
    });
  }

  return { pageUrl, depths };
}

/**
 * Generate time-to-open widget data
 */
function generateTimeToOpenData(): TimeToOpenData {
  const buckets = [
    { range: '0-5s', count: 150 },
    { range: '5-10s', count: 280 },
    { range: '10-15s', count: 320 },
    { range: '15-20s', count: 180 },
    { range: '20-30s', count: 120 },
    { range: '30-60s', count: 80 },
    { range: '60s+', count: 50 },
  ];

  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
  const weightedSum = buckets.reduce((sum, b) => {
    const mid = parseInt(b.range.split('-')[0]) + 2.5;
    return sum + mid * b.count;
  }, 0);

  return {
    buckets,
    average: Math.floor(weightedSum / totalCount),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'clicks';
  const pageUrl = searchParams.get('pageUrl') || 'https://chatbot24.su/';

  try {
    switch (type) {
      case 'clicks':
        const heatmapData = generateHeatmapData(pageUrl);
        return NextResponse.json(heatmapData);

      case 'scroll':
        const scrollData = generateScrollDepthData(pageUrl);
        return NextResponse.json(scrollData);

      case 'timeToOpen':
        const timeData = generateTimeToOpenData();
        return NextResponse.json(timeData);

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use clicks, scroll, or timeToOpen' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Heatmap] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, points, pageUrl, viewport } = body;

    // In production, save to analytics database
    console.log('[Heatmap] Received data:', {
      type,
      pageUrl,
      pointCount: points?.length,
      viewport,
    });

    return NextResponse.json({
      success: true,
      received: {
        type,
        pageUrl,
        pointCount: points?.length || 0,
      },
    });

  } catch (error) {
    console.error('[Heatmap] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save heatmap data' },
      { status: 500 }
    );
  }
}
