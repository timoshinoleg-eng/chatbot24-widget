/**
 * Lead API Route
 * Creates leads in Bitrix24 with AI scoring and automated workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { scoreLeadWithAI, formatScoreForBitrix, isHotLead, ConversationMessage, LeadScore } from '@/lib/scoring';
import { analyzeSentiment } from '@/lib/sentiment';
import { getBitrix24ExtendedClient, ExtendedLeadData } from '@/lib/bitrix24-ext';
import { getBitrix24TasksClient } from '@/lib/bitrix24-tasks';
import { getBitrix24TriggersClient } from '@/lib/bitrix24-triggers';
import { logStep, createRequestContext } from '@/lib/logger';

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
  pageUrl?: string;
  conversationHistory?: ConversationMessage[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
  return phoneRegex.test(cleaned);
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const reqContext = createRequestContext(requestId);
  
  logStep(reqContext, 'lead_api_start', { method: 'POST' });
  
  try {
    const body: LeadRequest = await request.json();
    const { 
      name, company, phone, email, budget, timeline, 
      message, source, pageUrl, conversationHistory,
      utmSource, utmMedium, utmCampaign
    } = body;

    logStep(reqContext, 'lead_data_received', {
      name,
      company,
      hasPhone: !!phone,
      hasEmail: !!email,
      hasConversationHistory: !!conversationHistory?.length,
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

    if (Object.keys(errors).length > 0) {
      logStep(reqContext, 'lead_validation_failed', { errors });
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    // AI Scoring
    let aiScore: LeadScore | null = null;
    if (conversationHistory && conversationHistory.length > 0) {
      logStep(reqContext, 'ai_scoring_start');
      
      try {
        aiScore = await scoreLeadWithAI({
          messages: conversationHistory,
        });
        
        logStep(reqContext, 'ai_scoring_complete', {
          status: aiScore.status,
          confidence: aiScore.confidence,
          projectType: aiScore.extractedData.projectType,
        });
      } catch (scoringError) {
        logStep(reqContext, 'ai_scoring_error', {
          error: scoringError instanceof Error ? scoringError.message : String(scoringError),
        });
        // Continue without AI scoring
      }
    }

    // Fallback to heuristic scoring if AI failed
    if (!aiScore) {
      const { scoreLead } = await import('@/lib/scoring');
      const legacyScore = scoreLead(budget || 'не указан', timeline || 'не указаны');
      
      // Convert legacy score to new format
      aiScore = {
        status: legacyScore.status,
        confidence: 0.5,
        justification: 'Оценка на основе базовых правил',
        extractedData: {
          budget: budget ? { value: parseInt(budget.replace(/\D/g, '')) || 0, currency: 'RUB', confidence: 0.5 } : null,
          timeline: null,
          projectType: 'не ясно' as const,
          decisionMaker: null,
          previousExperience: 'none' as const,
          contacts: { name, phone, email, company },
        },
        recommendedAction: {
          priority: (legacyScore.status === 'HOT' ? 2 : legacyScore.status === 'WARM' ? 5 : 8) as 2 | 5 | 8,
          timeframe: (legacyScore.status === 'HOT' ? 'в течение часа' : legacyScore.status === 'WARM' ? 'сегодня' : 'неделя') as 'в течение часа' | 'сегодня' | 'неделя',
          channel: (legacyScore.status === 'HOT' ? 'звонок' : 'мессенджер') as 'звонок' | 'мессенджер',
          assignedTo: 'sales-manager' as const,
        },
        redFlags: [],
      };
    }

    // Analyze sentiment if message provided
    let sentiment = null;
    if (message) {
      sentiment = analyzeSentiment(message);
      logStep(reqContext, 'sentiment_analyzed', {
        label: sentiment.label,
        score: sentiment.score,
      });
    }

    // Build conversation summary
    const conversationSummary = conversationHistory
      ? conversationHistory.map(m => `${m.role === 'user' ? 'Клиент' : 'Бот'}: ${m.content}`).join('\n')
      : message || '';

    // Create extended lead data
    const leadData: ExtendedLeadData = {
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      email: email.trim(),
      aiScore,
      conversationSummary: conversationSummary.substring(0, 2000),
      source: source || 'chat_widget',
      utmSource,
      utmMedium,
      utmCampaign,
      pageUrl,
      estimatedValue: aiScore.extractedData.budget?.value,
      estimatedTimeline: aiScore.extractedData.timeline 
        ? `${aiScore.extractedData.timeline.minWeeks}-${aiScore.extractedData.timeline.maxWeeks} недель`
        : undefined,
      projectType: aiScore.extractedData.projectType,
    };

    // Create lead in Bitrix24
    logStep(reqContext, 'bitrix24_lead_create_start');
    
    const bitrixClient = getBitrix24ExtendedClient();
    let leadResult;
    
    try {
      leadResult = await bitrixClient.createExtendedLead(leadData);
      
      if (!leadResult.success) {
        throw new Error(leadResult.error || 'Unknown Bitrix24 error');
      }
      
      logStep(reqContext, 'bitrix24_lead_created', {
        leadId: leadResult.leadId,
      });
    } catch (bitrixError) {
      logStep(reqContext, 'bitrix24_lead_error', {
        error: bitrixError instanceof Error ? bitrixError.message : String(bitrixError),
      });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to create lead in CRM',
        details: bitrixError instanceof Error ? bitrixError.message : 'Unknown error',
        score: aiScore,
        sentiment,
      }, { status: 502 });
    }

    // Create tasks for HOT leads
    if (leadResult.leadId && isHotLead(aiScore)) {
      logStep(reqContext, 'hot_lead_task_create_start');
      
      const tasksClient = getBitrix24TasksClient();
      
      try {
        await tasksClient.createHotLeadTask(
          leadResult.leadId,
          name,
          aiScore,
          { phone, email }
        );
        
        logStep(reqContext, 'hot_lead_task_created');
      } catch (taskError) {
        logStep(reqContext, 'hot_lead_task_error', {
          error: taskError instanceof Error ? taskError.message : String(taskError),
        });
        // Non-critical error, continue
      }
    }

    // Send notifications and trigger workflows
    if (leadResult.leadId) {
      logStep(reqContext, 'triggers_start');
      
      const triggersClient = getBitrix24TriggersClient();
      
      try {
        const triggerResult = await triggersClient.checkTriggers(leadResult.leadId, {
          name,
          score: aiScore,
          email,
          phone,
        });
        
        logStep(reqContext, 'triggers_complete', {
          executed: triggerResult.executed,
          errors: triggerResult.errors,
        });
      } catch (triggerError) {
        logStep(reqContext, 'triggers_error', {
          error: triggerError instanceof Error ? triggerError.message : String(triggerError),
        });
        // Non-critical error, continue
      }
    }

    // Handle negative sentiment
    if (sentiment?.shouldEscalate && leadResult.leadId) {
      logStep(reqContext, 'negative_sentiment_escalation');
      
      const tasksClient = getBitrix24TasksClient();
      
      try {
        await tasksClient.createNegativeSentimentTask(
          leadResult.leadId,
          name,
          sentiment.score,
          conversationSummary.substring(0, 500)
        );
      } catch (escalationError) {
        logStep(reqContext, 'escalation_error', {
          error: escalationError instanceof Error ? escalationError.message : String(escalationError),
        });
      }
    }

    logStep(reqContext, 'lead_api_complete', {
      leadId: leadResult.leadId,
      status: aiScore.status,
    });

    return NextResponse.json({
      success: true,
      leadId: leadResult.leadId,
      score: aiScore,
      sentiment,
      message: 'Заявка успешно создана',
    });

  } catch (error) {
    logStep(reqContext, 'lead_api_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const bitrixClient = getBitrix24ExtendedClient();
    const result = await bitrixClient.findLead({});

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      leads: result.leads,
      total: result.leads?.length || 0,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
