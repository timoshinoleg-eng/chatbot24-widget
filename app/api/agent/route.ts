/**
 * AI Agent API Route
 * Enhanced with hybrid RAG, persona selection, and debug mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { zai, isMockMode } from '@/lib/zai';
import { checkInputSafety, sanitizeInput } from '@/lib/guardrails';
import { analyzeSentiment } from '@/lib/sentiment';
import { hybridSearch, formatRAGContext, getFallbackMessage, getSuggestedQuestions } from '@/lib/rag';
import { selectPrompt, injectRAGContext, PromptSelectionContext } from '@/lib/prompts';
import { extractPageContext, detectTone, buildConversationContext } from '@/lib/personalization';
import { logStep, createRequestContext } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Allowed origins for CORS
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

// Generate request ID for tracing (8 chars)
function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
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
    pageTitle?: string;
    widgetMode?: 'faq' | 'sales' | 'support';
    preferredTone?: 'formal' | 'casual' | 'technical';
  };
}

// Fallback responses for API errors
const FALLBACK_RESPONSES = {
  configError: 'Извините, AI-сервис временно недоступен из-за ошибки конфигурации. Мы работаем над исправлением.',
  authError: 'Извините, проблема с доступом к AI-сервису. Пожалуйста, попробуйте позже.',
  rateLimit: 'Слишком много запросов к AI-сервису. Пожалуйста, подождите немного и попробуйте снова.',
  timeout: 'Запрос занял слишком много времени. Пожалуйста, попробуйте снова или задайте более короткий вопрос.',
  noProvider: 'Извините, все AI-провайдеры временно недоступны. Пожалуйста, попробуйте позже или свяжитесь с нами напрямую.',
  generic: 'Извините, произошла ошибка при обработке запроса. Попробуйте позже.',
};

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const origin = request.headers.get('origin');
  const startTime = Date.now();
  
  // Initialize request context for logging
  const reqContext = createRequestContext(requestId);
  
  // Parse debug mode
  const { searchParams } = new URL(request.url);
  const isDebugMode = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true';
  const showModel = searchParams.get('show_model') === '1' || process.env.DEBUG_SHOW_MODEL === 'true';
  const useLLMRerank = searchParams.get('rerank') === '1' || searchParams.get('rerank') === 'true' || process.env.RAG_USE_LLM_RERANK === 'true';

  logStep(reqContext, 'request_start', {
    method: 'POST',
    path: '/api/agent',
    debugMode: isDebugMode,
  });

  try {
    // Parse request body
    let body: AgentRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      logStep(reqContext, 'parse_error', { error: String(parseError) });
      const response = NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      );
      return setCorsHeaders(response, origin);
    }
    
    const { messages, userId, context } = body;

    logStep(reqContext, 'request_parsed', {
      messageCount: messages?.length,
      userId: userId?.slice(0, 8),
      hasContext: !!context,
    });

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const response = NextResponse.json(
        { error: 'Invalid messages format', requestId },
        { status: 400 }
      );
      return setCorsHeaders(response, origin);
    }

    // Get last user message
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
      logStep(reqContext, 'input_blocked', { reason: safetyCheck.reason });
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
    logStep(reqContext, 'sentiment_analyzed', { 
      label: sentiment.label, 
      score: sentiment.score,
      shouldEscalate: sentiment.shouldEscalate,
    });

    // Hybrid RAG search
    const ragStartTime = Date.now();
    const ragResult = await hybridSearch(sanitizedInput, { 
      topK: 5,
      useLLMRerank,
    });
    const ragDuration = Date.now() - ragStartTime;

    logStep(reqContext, 'rag_complete', {
      resultCount: ragResult.relevantChunks.length,
      maxScore: ragResult.maxCombinedScore,
      fallbackLevel: ragResult.fallbackLevel,
      duration: ragDuration,
    });

    // Build context for prompt selection
    const promptContext: PromptSelectionContext = {
      widgetMode: context?.widgetMode,
      detectedTone: context?.preferredTone,
      isTechnicalQuestion: detectTechnicalQuestion(sanitizedInput),
      messageCount: messages.length,
    };

    // Select appropriate prompt
    const basePrompt = selectPrompt(promptContext);
    
    // Format RAG context
    const ragContext = formatRAGContext(ragResult);
    const fallbackMessage = getFallbackMessage(ragResult.fallbackLevel);
    
    // Inject RAG context into prompt
    const systemPrompt = injectRAGContext(basePrompt, {
      relevantChunks: ragContext,
      fallbackMessage,
    });

    // Build user context info
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
      logStep(reqContext, 'ai_not_configured', { mockMode: isMockMode });
      const diagnostics = zai.getDiagnostics();
      
      const response = NextResponse.json({
        response: FALLBACK_RESPONSES.configError,
        sentiment,
        knowledgeUsed: ragResult.relevantChunks.length > 0,
        fallbackLevel: ragResult.fallbackLevel,
        error: 'AI_SERVICE_NOT_CONFIGURED',
        diagnostics: isDebugMode ? diagnostics : undefined,
        requestId,
      });
      return setCorsHeaders(response, origin);
    }

    // MOCK MODE
    if (isMockMode) {
      logStep(reqContext, 'mock_mode_response');
      
      let mockResponse = 'Здравствуйте! Я AI-ассистент Chatbot24. ';
      
      if (ragResult.relevantChunks.length > 0 && ragResult.fallbackLevel !== 'full') {
        mockResponse += ragResult.relevantChunks[0].text;
      } else {
        mockResponse += 'Чем могу помочь? Я могу рассказать о наших услугах, сроках и стоимости разработки чат-ботов и сайтов.';
      }
      
      const duration = Date.now() - startTime;
      
      const responseData: Record<string, unknown> = {
        response: mockResponse,
        sentiment,
        knowledgeUsed: ragResult.relevantChunks.length > 0,
        fallbackLevel: ragResult.fallbackLevel,
        suggestedQuestions: getSuggestedQuestions(sanitizedInput),
        provider: 'mock',
        model: 'mock-mode',
        requestId,
        duration,
        mockMode: true,
      };

      // Add debug info if requested
      if (isDebugMode) {
        responseData._debug = {
          model: 'mock/mock-mode',
          provider: 'mock',
          request_id: requestId,
          processing_time_ms: duration,
          tokens: { prompt: 0, completion: 0 },
          rag: {
            result_count: ragResult.relevantChunks.length,
            max_score: ragResult.maxCombinedScore,
            fallback_level: ragResult.fallbackLevel,
            use_llm_rerank: useLLMRerank,
          },
        };
      }
      
      const response = NextResponse.json(responseData);
      return setCorsHeaders(response, origin);
    }

    // Call AI API
    logStep(reqContext, 'ai_request_start', {
      messageCount: messages.length,
      promptLength: systemPrompt.length,
    });

    const aiStartTime = Date.now();
    
    try {
      const apiMessages = [
        { role: 'system' as const, content: systemPrompt + contextInfo },
        ...messages.map(m => ({ 
          role: m.role as 'user' | 'assistant' | 'system', 
          content: m.content 
        }))
      ];

      const completion = await zai.createCompletion(apiMessages, {
        temperature: 0.7,
        max_tokens: 2000, // Увеличено для длинных ответов
      });

      const aiResponse = completion.choices?.[0]?.message?.content || '';
      const finishReason = completion.choices?.[0]?.finish_reason;
      const aiDuration = Date.now() - aiStartTime;

      // Проверка на обрыв ответа
      if (finishReason === 'length') {
        logStep(reqContext, 'ai_response_truncated', { 
          finishReason, 
          responseLength: aiResponse.length 
        });
      }

      if (!aiResponse) {
        logStep(reqContext, 'ai_empty_response');
        const response = NextResponse.json({
          response: 'Извините, не удалось получить ответ. Попробуйте переформулировать вопрос.',
          sentiment,
          knowledgeUsed: ragResult.relevantChunks.length > 0,
          fallbackLevel: ragResult.fallbackLevel,
          requestId,
        });
        return setCorsHeaders(response, origin);
      }

      const duration = Date.now() - startTime;
      
      // Determine provider and model from debug metadata
      const debugInfo = completion._debug;
      const provider = debugInfo?.provider || 'unknown';
      const model = debugInfo?.model || completion.model || 'unknown';
      const isFallbackUsed = debugInfo?.fallbackUsed || false;
      
      logStep(reqContext, 'ai_response_complete', {
        provider,
        model,
        aiDuration,
        totalDuration: duration,
        fallbackUsed: isFallbackUsed,
      });

      const responseData: Record<string, unknown> = {
        response: aiResponse,
        sentiment,
        knowledgeUsed: ragResult.relevantChunks.length > 0,
        fallbackLevel: ragResult.fallbackLevel,
        suggestedQuestions: getSuggestedQuestions(sanitizedInput),
        provider,
        model: showModel || isDebugMode ? model : undefined,
        requestId,
        duration,
      };

      // Add debug info if requested
      if (isDebugMode) {
        responseData._debug = {
          model_used: model,
          provider: provider as 'openrouter' | 'zai',
          request_id: requestId,
          processing_time_ms: duration,
          ai_time_ms: aiDuration,
          rag_time_ms: ragDuration,
          tokens: {
            prompt: completion.usage?.prompt_tokens || 0,
            completion: completion.usage?.completion_tokens || 0,
          },
          fallback_triggered_at: isFallbackUsed ? 'api_request' : undefined,
          finish_reason: finishReason,
          rag: {
            result_count: ragResult.relevantChunks.length,
            max_combined_score: ragResult.maxCombinedScore,
            fallback_level: ragResult.fallbackLevel,
            semantic_weight: 0.6,
            keyword_weight: 0.4,
            use_llm_rerank: useLLMRerank,
          },
          prompt_context: {
            selected_persona: promptContext.widgetMode || 'consultant',
            detected_tone: promptContext.detectedTone,
            message_count: messages.length,
          },
        };
      }

      const response = NextResponse.json(responseData);
      return setCorsHeaders(response, origin);

    } catch (apiError) {
      const aiDuration = Date.now() - aiStartTime;
      logStep(reqContext, 'ai_error', {
        duration: aiDuration,
        error: apiError instanceof Error ? apiError.message : String(apiError),
      });
      
      // Determine error type for fallback message
      let fallbackMessage = FALLBACK_RESPONSES.generic;
      let errorCode = 'AI_API_ERROR';
      
      if (apiError instanceof Error) {
        const errorMsg = apiError.message.toLowerCase();
        
        if (errorMsg.includes('auth_failed') || errorMsg.includes('401')) {
          fallbackMessage = FALLBACK_RESPONSES.authError;
          errorCode = 'AUTH_FAILED';
        } else if (errorMsg.includes('rate_limit') || errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          fallbackMessage = FALLBACK_RESPONSES.rateLimit;
          errorCode = 'RATE_LIMIT';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('abort')) {
          fallbackMessage = FALLBACK_RESPONSES.timeout;
          errorCode = 'TIMEOUT';
        } else if (errorMsg.includes('no_api_configured') || errorMsg.includes('ни один api')) {
          fallbackMessage = FALLBACK_RESPONSES.configError;
          errorCode = 'NO_API_CONFIGURED';
        } else if (errorMsg.includes('zai_not_configured') || (errorMsg.includes('fallback') && errorMsg.includes('failed'))) {
          fallbackMessage = FALLBACK_RESPONSES.noProvider;
          errorCode = 'ALL_PROVIDERS_FAILED';
        }
      }
      
      const duration = Date.now() - startTime;
      
      const response = NextResponse.json({
        response: fallbackMessage,
        sentiment,
        knowledgeUsed: ragResult.relevantChunks.length > 0,
        fallbackLevel: ragResult.fallbackLevel,
        error: errorCode,
        errorDetails: isDebugMode && apiError instanceof Error ? apiError.message : undefined,
        diagnostics: isDebugMode ? {
          aiConfigured: zai.isConfigured(),
          mockMode: isMockMode,
        } : undefined,
        requestId,
        duration,
      });
      return setCorsHeaders(response, origin);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    logStep(reqContext, 'critical_error', {
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    
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

/**
 * Detect if question is technical
 */
function detectTechnicalQuestion(text: string): boolean {
  const technicalKeywords = [
    'api', 'rest', 'graphql', 'webhook', 'интеграция',
    'база данных', 'сервер', 'хостинг', 'домен',
    'react', 'next.js', 'node.js', 'python',
    'ssl', 'https', 'cdn', 'кэширование',
    'docker', 'kubernetes', 'ci/cd', 'devops',
  ];
  
  const textLower = text.toLowerCase();
  return technicalKeywords.some(kw => textLower.includes(kw));
}

/**
 * Debug endpoint for diagnostics
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const origin = request.headers.get('origin');
  
  const { searchParams } = new URL(request.url);
  const isDebugMode = searchParams.get('debug') === '1';

  if (!isDebugMode) {
    const response = NextResponse.json({
      status: 'ok',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return setCorsHeaders(response, origin);
  }

  // Debug diagnostics
  const diagnostics = {
    mode: 'DIAGNOSTIC',
    requestId,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    },
    ai_providers: {
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasZaiKey: !!process.env.ZAI_API_KEY,
      zaiDiagnostics: zai.getDiagnostics(),
      isConfigured: zai.isConfigured(),
      isMockMode,
    },
    rag: {
      semanticWeight: 0.6,
      keywordWeight: 0.4,
      topK: 5,
      rerankThreshold: 0.5,
      llmRerank: true,
    },
    features: {
      hybridRag: true,
      aiScoring: true,
      personaSelection: true,
      debugMode: true,
      llmRerank: true,
    },
    timestamp: new Date().toISOString(),
  };

  const response = NextResponse.json(diagnostics);
  return setCorsHeaders(response, origin);
}
