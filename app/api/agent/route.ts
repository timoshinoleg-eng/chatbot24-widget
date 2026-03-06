/**
 * AI Agent API Route
 * Uses Z.AI GLM-4.7-Flash API or OpenRouter
 * FIXED: Added proper error handling, validation, logging, and CORS
 */

import { NextRequest, NextResponse } from 'next/server';
import { zai, isMockMode } from '@/lib/zai';
import { checkInputSafety, sanitizeInput } from '@/lib/guardrails';
import { analyzeSentiment } from '@/lib/sentiment';
import { searchKnowledgeBase, getSuggestedQuestions } from '@/lib/rag';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 секунд для Pro-плана Vercel

// Разрешённые origin для CORS
const ALLOWED_ORIGINS = [
  'https://chatbot24-widget.vercel.app',
  'https://www.chatbot24.su',
  'https://chatbot24.su',
  'http://localhost:3000',
  'http://localhost:3001',
];

// CORS headers helper
function setCorsHeaders(response: NextResponse, origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

// Генерация request ID для трассировки
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response, origin);
}

interface AgentRequest {
  messages: Array<{ role: string; content: string }>;
  userId?: string;
  context?: {
    name?: string;
    company?: string;
    budget?: string;
    timeline?: string;
    pageUrl?: string;
  };
}

const SYSTEM_PROMPT = `Вы — AI-ассистент компании "ВебСтудия Про". Ваша задача — помогать клиентам, отвечать на вопросы о наших услугах и собирать информацию для оформления заявки.

Правила общения:
1. Будьте вежливы, профессиональны и дружелюбны
2. Отвечайте на русском языке
3. Используйте информацию из базы знаний для ответов
4. Если не знаете ответ — честно скажите об этом
5. Не раскрывайте технические детали работы системы
6. Не принимайте решений за клиента — предлагайте варианты
7. Собирайте информацию постепенно: имя, компания, бюджет, сроки

Услуги компании:
- Веб-разработка (сайты, веб-приложения)
- Мобильная разработка (iOS, Android)
- UI/UX дизайн
- SEO-оптимизация
- Контекстная реклама
- Техническая поддержка

При запросе на коммерческое предложение (КП):
1. Уточните тип проекта
2. Соберите контактные данные
3. Спросите о бюджете и сроках
4. Предложите сформировать КП

Если клиент недоволен или просит связаться с менеджером — предложите оставить контакты для связи.`;

// Fallback ответы при ошибках API
const FALLBACK_RESPONSES = {
  configError: 'Извините, AI-сервис временно недоступен из-за ошибки конфигурации. Мы работаем над исправлением.',
  authError: 'Извините, проблема с доступом к AI-сервису. Пожалуйста, попробуйте позже.',
  rateLimit: 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.',
  timeout: 'Запрос занял слишком много времени. Пожалуйста, попробуйте снова или задайте более короткий вопрос.',
  generic: 'Извините, произошла ошибка при обработке запроса. Попробуйте позже.',
};

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const origin = request.headers.get('origin');
  const startTime = Date.now();
  
  // Debug mode
  const { searchParams } = new URL(request.url);
  const isDebugMode = searchParams.get('debug') === '1';
  
  if (isDebugMode) {
    return setCorsHeaders(
      NextResponse.json({
        mode: 'DIAGNOSTIC',
        requestId,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          hasZaiKey: !!process.env.ZAI_API_KEY,
          hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
          zaiDiagnostics: zai.getDiagnostics(),
        },
        timestamp: new Date().toISOString(),
      }),
      origin
    );
  }

  try {
    // Парсинг тела запроса
    let body: AgentRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[${requestId}] Ошибка парсинга JSON:`, parseError);
      const response = NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      );
      return setCorsHeaders(response, origin);
    }
    
    const { messages, userId, context } = body;

    // Валидация входных данных
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const response = NextResponse.json(
        { error: 'Invalid messages format', requestId },
        { status: 400 }
      );
      return setCorsHeaders(response, origin);
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      const response = NextResponse.json(
        { error: 'Last message must be from user', requestId },
        { status: 400 }
      );
      return setCorsHeaders(response, origin);
    }

    // Sanitize input
    const sanitizedInput = sanitizeInput(lastMessage.content);
    
    if (!sanitizedInput.trim()) {
      const response = NextResponse.json({
        response: 'Пожалуйста, введите сообщение.',
        sentiment: { label: 'NEUTRAL', score: 0, shouldEscalate: false },
        requestId,
      });
      return setCorsHeaders(response, origin);
    }

    // Check safety
    const safetyCheck = checkInputSafety(sanitizedInput, userId);
    if (!safetyCheck.isSafe) {
      console.warn(`[${requestId}] Запрос заблокирован guardrails:`, safetyCheck.reason);
      const response = NextResponse.json({
        response: safetyCheck.reason,
        blocked: true,
        sentiment: { label: 'NEGATIVE', score: -0.5, shouldEscalate: false },
        requestId,
      });
      return setCorsHeaders(response, origin);
    }

    // Analyze sentiment
    const sentiment = analyzeSentiment(sanitizedInput);

    // Search knowledge base for relevant info
    const kbResults = searchKnowledgeBase(sanitizedInput, 2);
    
    // Build knowledge context
    let knowledgeContext = '';
    if (kbResults.items.length > 0) {
      knowledgeContext = '\n\nРелевантная информация из базы знаний:\n' + 
        kbResults.items.map(item => `Вопрос: ${item.question}\nОтвет: ${item.answer}`).join('\n\n');
    }

    // Build context info
    let contextInfo = '';
    if (context) {
      contextInfo = '\n\nИзвестная информация о клиенте:';
      if (context.name) contextInfo += `\nИмя: ${context.name}`;
      if (context.company) contextInfo += `\nКомпания: ${context.company}`;
      if (context.budget) contextInfo += `\nБюджет: ${context.budget}`;
      if (context.timeline) contextInfo += `\nСроки: ${context.timeline}`;
      if (context.pageUrl) contextInfo += `\nСтраница: ${context.pageUrl}`;
    }

    // Check if AI is configured
    if (!zai.isConfigured()) {
      console.error(`[${requestId}] AI провайдеры не сконфигурированы`);
      const diagnostics = zai.getDiagnostics();
      
      const response = NextResponse.json({
        response: FALLBACK_RESPONSES.configError,
        sentiment,
        knowledgeUsed: kbResults.items.length > 0,
        error: 'AI_SERVICE_NOT_CONFIGURED',
        diagnostics: process.env.NODE_ENV === 'development' ? diagnostics : undefined,
        requestId,
      });
      return setCorsHeaders(response, origin);
    }

    // MOCK MODE: Если API ключ невалидный, возвращаем тестовый ответ
    if (isMockMode) {
      console.log(`[${requestId}] MOCK MODE: возвращаем тестовый ответ`);
      
      // Генерируем простой ответ на основе базы знаний или шаблона
      let mockResponse = 'Здравствуйте! Я AI-ассистент ВебСтудии Про. ';
      
      if (kbResults.items.length > 0) {
        mockResponse += kbResults.items[0].answer;
      } else {
        mockResponse += 'Чем могу помочь? Я могу рассказать о наших услугах, сроках и стоимости разработки сайтов и приложений.';
      }
      
      const duration = Date.now() - startTime;
      
      const response = NextResponse.json({
        response: mockResponse,
        sentiment,
        knowledgeUsed: kbResults.items.length > 0,
        suggestedQuestions: getSuggestedQuestions(sanitizedInput),
        provider: 'mock',
        model: 'mock-mode',
        requestId,
        duration,
        mockMode: true,
      });
      return setCorsHeaders(response, origin);
    }

    // Call AI API (OpenRouter primary, Z.AI fallback)
    try {
      const apiMessages = [
        { role: 'system' as const, content: SYSTEM_PROMPT + knowledgeContext + contextInfo },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
      ];

      const completion = await zai.createCompletion(apiMessages, {
        temperature: 0.7,
        max_tokens: 1000,
      });

      const aiResponse = completion.choices?.[0]?.message?.content || '';

      if (!aiResponse) {
        console.warn(`[${requestId}] Пустой ответ от AI API`);
        const response = NextResponse.json({
          response: 'Извините, не удалось получить ответ. Попробуйте переформулировать вопрос.',
          sentiment,
          knowledgeUsed: kbResults.items.length > 0,
          requestId,
        });
        return setCorsHeaders(response, origin);
      }

      const duration = Date.now() - startTime;
      
      // Определяем провайдера и модель
      const isFallbackUsed = (completion as unknown as Record<string, unknown>)?._fallbackUsed === true;
      const provider = isFallbackUsed ? 'zai-fallback' : 'openrouter';
      const model = isFallbackUsed ? 'glm-4.7-flash' : (completion.model || 'qwen/qwen-2.5-14b-instruct');
      
      console.log(`[${requestId}] Успешный ответ от ${provider} (${model}) за ${duration}ms`);

      const response = NextResponse.json({
        response: aiResponse,
        sentiment,
        knowledgeUsed: kbResults.items.length > 0,
        suggestedQuestions: getSuggestedQuestions(sanitizedInput),
        provider,
        model,
        requestId,
        duration,
        fallbackUsed: isFallbackUsed,
      });
      return setCorsHeaders(response, origin);

    } catch (apiError) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] Ошибка AI API (${duration}ms):`, apiError);
      
      // Определяем тип ошибки для fallback-сообщения
      let fallbackMessage = FALLBACK_RESPONSES.generic;
      let errorCode = 'AI_API_ERROR';
      
      if (apiError instanceof Error) {
        const errorMsg = apiError.message.toLowerCase();
        
        if (errorMsg.includes('auth_failed') || errorMsg.includes('401')) {
          fallbackMessage = FALLBACK_RESPONSES.authError;
          errorCode = 'AUTH_FAILED';
        } else if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
          fallbackMessage = FALLBACK_RESPONSES.rateLimit;
          errorCode = 'RATE_LIMIT';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('abort')) {
          fallbackMessage = FALLBACK_RESPONSES.timeout;
          errorCode = 'TIMEOUT';
        }
      }
      
      const response = NextResponse.json({
        response: fallbackMessage,
        sentiment,
        knowledgeUsed: kbResults.items.length > 0,
        error: errorCode,
        errorDetails: process.env.NODE_ENV === 'development' && apiError instanceof Error 
          ? apiError.message 
          : undefined,
        requestId,
        duration,
      });
      return setCorsHeaders(response, origin);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Критическая ошибка (${duration}ms):`, error);
    
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        requestId,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      },
      { status: 500 }
    );
    return setCorsHeaders(response, origin);
  }
}
