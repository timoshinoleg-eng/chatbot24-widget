/**
 * Lead API Route
 * Creates leads in Bitrix24 with scoring and sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { scoreLead } from '@/lib/scoring';
import { analyzeSentiment } from '@/lib/sentiment';
import { Bitrix24Client } from '@/lib/bitrix24';

export const dynamic = 'force-dynamic';

interface LeadRequest {
  name: string;
  company: string;
  phone: string;
  email: string;
  budget?: string;
  timeline?: string;
  message?: string;
  source?: string;
}

function validatePhone(phone: string): boolean {
  // Basic Russian phone validation
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
  return phoneRegex.test(cleaned);
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  console.log('[Lead API] Received POST request');
  
  try {
    const body: LeadRequest = await request.json();
    const { name, company, phone, email, budget, timeline, message, source } = body;

    console.log('[Lead API] Request body:', { 
      name, 
      company, 
      phone: phone ? '***' : undefined, 
      email: email ? '***' : undefined,
      budget: budget || 'не указан',
      timeline: timeline || 'не указаны',
      hasMessage: !!message,
      source: source || 'chat_widget'
    });

    // Validation
    const errors: Record<string, string> = {};

    if (!name || name.trim().length < 2) {
      errors.name = 'Имя должно содержать минимум 2 символа';
    }

    if (!company || company.trim().length < 2) {
      errors.company = 'Название компании обязательно';
    }

    if (!phone || !validatePhone(phone)) {
      errors.phone = 'Введите корректный номер телефона';
    }

    if (!email || !validateEmail(email)) {
      errors.email = 'Введите корректный email';
    }

    // budget и timeline теперь необязательные поля
    // Если не указаны, используем значения по умолчанию

    if (Object.keys(errors).length > 0) {
      console.log('[Lead API] Validation failed:', errors);
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    // Calculate lead score
    const leadScore = scoreLead(budget || 'не указан', timeline || 'не указаны');
    console.log('[Lead API] Lead score calculated:', leadScore);

    // Analyze sentiment if message provided
    let sentiment = null;
    if (message) {
      sentiment = analyzeSentiment(message);
      console.log('[Lead API] Sentiment analyzed:', sentiment);
    }

    // Create lead in Bitrix24
    console.log('[Lead API] Creating lead in Bitrix24...');
    const bitrixClient = new Bitrix24Client();
    
    let leadResult;
    try {
      leadResult = await bitrixClient.createLead({
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        email: email.trim(),
        budget: budget || 'не указан',
        timeline: timeline || 'не указаны',
        score: leadScore.score,
        status: leadScore.status,
        source: source || 'chat_widget',
        comments: message || ''
      });
      console.log('[Lead API] Bitrix24 lead created:', leadResult);
    } catch (bitrixError) {
      console.error('[Lead API] Bitrix24 error:', bitrixError);
      // Return error but don't fail the request completely
      // The lead data is still valuable even if Bitrix24 fails
      return NextResponse.json({
        success: false,
        error: 'Failed to create lead in CRM',
        details: bitrixError instanceof Error ? bitrixError.message : 'Unknown error',
        score: leadScore,
        sentiment,
      }, { status: 502 });
    }

    // If sentiment is negative, create escalation
    if (sentiment?.shouldEscalate && leadResult.leadId) {
      console.log('[Lead API] Creating escalation activity for negative sentiment');
      try {
        await bitrixClient.createActivity({
          leadId: leadResult.leadId,
          subject: '🔥 СРОЧНО: Негативный клиент',
          priority: 'HIGH',
          description: `Клиент выразил негативное отношение (score: ${sentiment.score.toFixed(2)}). Сообщение: ${message}`
        });

        await bitrixClient.notifyManager(
          `⚠️ Эскалация: клиент ${name} недоволен (score: ${sentiment.score.toFixed(2)}). Лид #${leadResult.leadId}`
        );
      } catch (escalationError) {
        console.error('[Lead API] Escalation error:', escalationError);
        // Non-critical error, continue
      }
    }

    // Log the lead creation
    console.log('[Lead API] Lead created successfully:', {
      name,
      company,
      score: leadScore.score,
      status: leadScore.status,
      sentiment: sentiment?.label,
      bitrixId: leadResult.leadId
    });

    return NextResponse.json({
      success: true,
      leadId: leadResult.leadId,
      score: leadScore,
      sentiment,
      message: 'Заявка успешно создана'
    });

  } catch (error) {
    console.error('[Lead API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('[Lead API] Received GET request');
  
  try {
    const bitrixClient = new Bitrix24Client();
    const result = await bitrixClient.getLeadList();

    if (!result.success) {
      console.error('[Lead API] Failed to get leads:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log('[Lead API] Retrieved leads count:', result.leads?.length || 0);

    return NextResponse.json({
      leads: result.leads,
      total: result.leads?.length || 0
    });

  } catch (error) {
    console.error('[Lead API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
