/**
 * OpenRouter / Z.AI API Client
 * OpenRouter is the primary provider with qwen/qwen-2.5-14b-instruct model
 * Z.AI serves as a fallback provider
 * FIXED: Added proper error handling, timeouts, retries, and headers
 */

// Конфигурация API endpoints
const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/chat/completions';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Модели
const PRIMARY_MODEL = 'qwen/qwen-2.5-14b-instruct'; // Основная модель через OpenRouter
const FALLBACK_MODEL = 'glm-4.7-flash'; // Запасная модель через Z.AI

// Конфигурация таймаутов и ретраев
const CONFIG = {
  timeout: 25000,        // 25 секунд на запрос к API
  maxRetries: 2,         // Максимум 2 повторные попытки
  retryDelays: [1000, 3000], // Задержки между ретраями (экспоненциальная)
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface APIError {
  status: number;
  code: string;
  message: string;
  action?: string;
}

class ZAIClient {
  private apiKey: string;
  private fallbackApiKey: string | null;
  private model: string;
  private apiUrl: string;
  private siteUrl: string;
  private appName: string;
  private isPrimary: boolean; // true = OpenRouter, false = Z.AI (fallback)

  constructor(
    apiKey: string = '', // Основной ключ (OpenRouter)
    fallbackApiKey: string | null = null, // Запасной ключ (Z.AI)
    model: string = PRIMARY_MODEL,
    siteUrl: string = 'https://chatbot24-widget.vercel.app',
    appName: string = 'Chatbot24 Widget',
    isPrimary: boolean = true
  ) {
    this.apiKey = apiKey;
    this.fallbackApiKey = fallbackApiKey;
    this.model = model;
    this.siteUrl = siteUrl;
    this.appName = appName;
    this.isPrimary = isPrimary;
    
    // Определяем URL API в зависимости от типа провайдера
    if (isPrimary) {
      this.apiUrl = OPENROUTER_API_URL;
    } else {
      this.apiUrl = ZAI_API_URL;
    }
  }

  /**
   * Проверка конфигурации клиента
   * Проверяет наличие хотя бы одного валидного ключа (основного или запасного)
   */
  isConfigured(): boolean {
    const hasPrimaryKey = this.isValidOpenRouterKey(this.apiKey);
    const hasFallbackKey = this.fallbackApiKey && this.fallbackApiKey.length > 10 && !this.fallbackApiKey.startsWith('sk-or-v1-');
    
    if (!hasPrimaryKey && !hasFallbackKey) {
      console.error('[ZAI Client] Ни основной (OpenRouter), ни запасной (Z.AI) API ключ не настроены');
      return false;
    }
    
    return true;
  }

  /**
   * Проверка валидности ключа OpenRouter
   */
  private isValidOpenRouterKey(key: string): boolean {
    return key.startsWith('sk-or-v1-') && key.length > 20;
  }

  /**
   * Проверка, используется ли основной провайдер (OpenRouter)
   */
  isUsingPrimaryProvider(): boolean {
    return this.isPrimary && this.isValidOpenRouterKey(this.apiKey);
  }

  /**
   * Получение диагностической информации
   */
  getDiagnostics(): Record<string, unknown> {
    return {
      hasPrimaryKey: this.isValidOpenRouterKey(this.apiKey),
      hasFallbackKey: !!this.fallbackApiKey && this.fallbackApiKey.length > 10,
      primaryKeyPrefix: this.apiKey ? `${this.apiKey.slice(0, 15)}...` : 'none',
      keyFormat: 'openrouter',
      model: this.model,
      apiUrl: this.apiUrl,
      siteUrl: this.siteUrl,
      isPrimaryProvider: this.isPrimary,
      provider: this.isPrimary ? 'openrouter' : 'zai-fallback',
    };
  }

  /**
   * Выполнение запроса с таймаутом
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Обработка ошибок API
   */
  private async handleAPIError(response: Response): Promise<APIError> {
    const status = response.status;
    let errorBody: Record<string, unknown> = {};
    
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: { message: response.statusText } };
    }

    const errorMap: Record<number, { message: string; code: string; action?: string }> = {
      401: {
        message: 'Ошибка аутентификации — проверьте API ключ',
        code: 'AUTH_FAILED',
        action: 'Проверьте ключ в Vercel Dashboard и личном кабинете провайдера',
      },
      429: {
        message: 'Превышен лимит запросов',
        code: 'RATE_LIMIT',
        action: 'Подождите немного и попробуйте снова',
      },
      502: {
        message: 'API временно недоступен (Gateway Error)',
        code: 'GATEWAY_ERROR',
        action: 'Попробуйте повторить запрос позже',
      },
      503: {
        message: 'Модель временно недоступна',
        code: 'MODEL_UNAVAILABLE',
        action: 'Попробуйте повторить запрос позже',
      },
      504: {
        message: 'Таймаут запроса к API',
        code: 'TIMEOUT',
        action: 'Попробуйте снова или уменьшите max_tokens',
      },
    };

    const errorInfo = errorMap[status] || {
      message: `Неизвестная ошибка API: ${status}`,
      code: 'UNKNOWN_ERROR',
    };

    // Безопасное извлечение сообщения об ошибке
    const errorMessage = typeof errorBody.error === 'object' && errorBody.error !== null
      ? (errorBody.error as Record<string, unknown>).message as string
      : undefined;

    return {
      status,
      code: errorInfo.code,
      message: errorMessage || errorInfo.message,
      action: errorInfo.action,
    };
  }

  /**
   * Запрос с retry-логикой
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt: number = 0
  ): Promise<Response> {
    try {
      const response = await this.fetchWithTimeout(url, options, CONFIG.timeout);

      // Ретраим только определённые статусы
      if (!response.ok) {
        const shouldRetry = [429, 502, 503, 504].includes(response.status);
        
        if (shouldRetry && attempt < CONFIG.maxRetries) {
          const delay = CONFIG.retryDelays[attempt] || 5000;
          console.warn(`[ZAI Client] Ретрай ${attempt + 1}/${CONFIG.maxRetries} через ${delay}ms (статус: ${response.status})`);
          await new Promise((r) => setTimeout(r, delay));
          return this.fetchWithRetry(url, options, attempt + 1);
        }
      }

      return response;
    } catch (error) {
      // AbortError или сетевая ошибка — пробуем ещё раз
      if (attempt < CONFIG.maxRetries) {
        const delay = CONFIG.retryDelays[attempt] || 5000;
        console.warn(`[ZAI Client] Ретрай ${attempt + 1}/${CONFIG.maxRetries} после ошибки сети через ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Создание чат-комплишена
   * Сначала пробует основной провайдер (OpenRouter), затем запасной (Z.AI) при ошибке
   */
  async createCompletion(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<ChatCompletionResponse> {
    // Сначала пробуем основной провайдер (OpenRouter)
    if (this.isPrimary && this.isValidOpenRouterKey(this.apiKey)) {
      try {
        const result = await this.callOpenRouter(messages, options);
        console.log('[ZAI Client] Успешный ответ от OpenRouter (основной провайдер)');
        return result;
      } catch (error) {
        console.warn('[ZAI Client] OpenRouter недоступен, пробуем Z.AI (запасной):', error instanceof Error ? error.message : error);
        
        // Если есть запасной ключ Z.AI — пробуем его
        if (this.fallbackApiKey) {
          return await this.callZAI(messages, options);
        }
        throw error;
      }
    }
    
    // Если основной недоступен или не настроен — используем запасной
    if (this.fallbackApiKey) {
      return await this.callZAI(messages, options);
    }
    
    throw new Error('NO_API_CONFIGURED: Ни один API ключ не настроен');
  }

  /**
   * Вызов OpenRouter API (основной провайдер)
   */
  private async callOpenRouter(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    }
  ): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': this.siteUrl,
      'X-Title': this.appName,
    };

    const requestBody = {
      model: PRIMARY_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1000,
      stream: options.stream ?? false,
      transforms: ['middle-out'],
      route: 'fallback',
    };

    console.log('[ZAI Client] Отправка запроса в OpenRouter:', {
      model: PRIMARY_MODEL,
      messagesCount: messages.length,
    });

    const response = await this.fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await this.handleAPIError(response);
      console.error('[ZAI Client] Ошибка OpenRouter:', error);
      throw new Error(`${error.code}: ${error.message}${error.action ? ` (${error.action})` : ''}`);
    }

    const data = await response.json();
    
    console.log('[ZAI Client] Успешный ответ от OpenRouter:', {
      model: data.model,
      tokens: data.usage?.total_tokens,
    });

    return data;
  }

  /**
   * Вызов Z.AI API (запасной провайдер)
   */
  private async callZAI(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    }
  ): Promise<ChatCompletionResponse> {
    if (!this.fallbackApiKey) {
      throw new Error('ZAI_NOT_CONFIGURED: Запасной Z.AI API ключ не настроен');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.fallbackApiKey}`,
    };

    const requestBody = {
      model: FALLBACK_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1000,
      stream: options.stream ?? false,
    };

    console.log('[ZAI Client] Отправка запроса в Z.AI (запасной провайдер):', {
      model: FALLBACK_MODEL,
      messagesCount: messages.length,
    });

    const response = await this.fetchWithRetry(ZAI_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await this.handleAPIError(response);
      console.error('[ZAI Client] Ошибка Z.AI:', error);
      throw new Error(`${error.code}: ${error.message}${error.action ? ` (${error.action})` : ''}`);
    }

    const data = await response.json();
    
    console.log('[ZAI Client] Успешный ответ от Z.AI (запасной):', {
      model: data.model,
      tokens: data.usage?.total_tokens,
    });

    // Добавляем флаг, что использовался запасной провайдер
    return {
      ...data,
      _fallbackUsed: true,
    } as ChatCompletionResponse;
  }
}

// Определяем API ключи из переменных окружения
// OpenRouter — основной провайдер (qwen/qwen-2.5-14b-instruct)
const openRouterKey = process.env.OPENROUTER_API_KEY || '';

// Z.AI — запасной провайдер (используется при недоступности OpenRouter)
const zaiKey = process.env.ZAI_API_KEY || '';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chatbot24-widget.vercel.app';

// Проверяем валидность ключей
const isValidOpenRouterKey = openRouterKey.startsWith('sk-or-v1-') && openRouterKey.length > 20;
const isValidZaiKey = zaiKey.length > 10 && !zaiKey.startsWith('sk-or-v1-');

// Singleton instance
// Передаём OpenRouter как основной, Z.AI как запасной
export const zai = new ZAIClient(
  isValidOpenRouterKey ? openRouterKey : '',
  isValidZaiKey ? zaiKey : null,
  PRIMARY_MODEL,
  siteUrl,
  'Chatbot24 Widget',
  true // isPrimary = true (OpenRouter)
);

// Флаг мок-режима (если оба ключа невалидны)
export const isMockMode = !isValidOpenRouterKey && !isValidZaiKey;

// Экспорт класса для создания кастомных инстансов
export { ZAIClient };
export type { ChatMessage, ChatCompletionResponse, APIError };
