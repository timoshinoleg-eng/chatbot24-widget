/**
 * Sentiment Analysis API Route
 * Analyzes text sentiment and returns score
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/sentiment';

export const dynamic = 'force-dynamic';

interface SentimentRequest {
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SentimentRequest = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const result = analyzeSentiment(text);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Sentiment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    status: 'ok',
    service: 'sentiment-analysis'
  });
}
