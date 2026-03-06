/**
 * Analytics API Route
 * Returns statistics for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { Bitrix24Client } from '@/lib/bitrix24';

export const dynamic = 'force-dynamic';

// In-memory analytics store (use database in production)
interface ChatSession {
  id: string;
  startTime: number;
  endTime?: number;
  messages: number;
  convertedToLead: boolean;
  sentiment: string;
  score?: number;
}

const chatSessions: ChatSession[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, data } = body;

    // Track chat events
    if (event === 'chat_start') {
      chatSessions.push({
        id: data.sessionId || Date.now().toString(),
        startTime: Date.now(),
        messages: 0,
        convertedToLead: false,
        sentiment: 'NEUTRAL'
      });
    } else if (event === 'chat_message') {
      const session = chatSessions.find(s => s.id === data.sessionId);
      if (session) {
        session.messages++;
        if (data.sentiment) {
          session.sentiment = data.sentiment;
        }
      }
    } else if (event === 'lead_created') {
      const session = chatSessions.find(s => s.id === data.sessionId);
      if (session) {
        session.convertedToLead = true;
        session.score = data.score;
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Analytics POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    // Calculate date range
    const now = Date.now();
    let startTime = now;
    
    switch (period) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = now - 7 * 24 * 60 * 60 * 1000;
    }

    // Filter sessions by time
    const filteredSessions = chatSessions.filter(s => s.startTime >= startTime);

    // Calculate metrics
    const totalChats = filteredSessions.length;
    const totalLeads = filteredSessions.filter(s => s.convertedToLead).length;
    const conversionRate = totalChats > 0 ? Math.round((totalLeads / totalChats) * 100) : 0;

    // Sentiment distribution
    const sentimentDistribution = {
      POSITIVE: filteredSessions.filter(s => s.sentiment === 'POSITIVE').length,
      NEGATIVE: filteredSessions.filter(s => s.sentiment === 'NEGATIVE').length,
      NEUTRAL: filteredSessions.filter(s => s.sentiment === 'NEUTRAL').length,
    };

    // Score distribution
    const scoreDistribution = {
      HOT: filteredSessions.filter(s => s.score && s.score >= 70).length,
      WARM: filteredSessions.filter(s => s.score && s.score >= 40 && s.score < 70).length,
      COLD: filteredSessions.filter(s => !s.score || s.score < 40).length,
    };

    // Escalations (negative sentiment)
    const escalations = sentimentDistribution.NEGATIVE;

    // Daily stats for chart
    const dailyStats: Record<string, { chats: number; leads: number; sentiment: number }> = {};
    
    for (let i = 0; i < (period === '24h' ? 24 : period === '7d' ? 7 : 30); i++) {
      const date = new Date(now - i * (period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
      const key = period === '24h' 
        ? date.getHours().toString().padStart(2, '0') + ':00'
        : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      dailyStats[key] = { chats: 0, leads: 0, sentiment: 0 };
    }

    filteredSessions.forEach(session => {
      const date = new Date(session.startTime);
      const key = period === '24h'
        ? date.getHours().toString().padStart(2, '0') + ':00'
        : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      
      if (dailyStats[key]) {
        dailyStats[key].chats++;
        if (session.convertedToLead) {
          dailyStats[key].leads++;
        }
        if (session.sentiment === 'POSITIVE') {
          dailyStats[key].sentiment++;
        }
      }
    });

    // Get recent leads from Bitrix24
    const bitrixClient = new Bitrix24Client();
    const bitrixLeads = await bitrixClient.getLeadList({
      '>DATE_CREATE': new Date(startTime).toISOString().split('T')[0]
    });

    return NextResponse.json({
      period,
      summary: {
        totalChats,
        totalLeads,
        conversionRate,
        escalations,
        avgMessages: totalChats > 0 
          ? Math.round(filteredSessions.reduce((sum, s) => sum + s.messages, 0) / totalChats)
          : 0
      },
      sentimentDistribution,
      scoreDistribution,
      dailyStats: Object.entries(dailyStats)
        .map(([date, data]) => ({ date, ...data }))
        .reverse(),
      recentLeads: bitrixLeads.success ? bitrixLeads.leads?.slice(0, 10) : [],
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
