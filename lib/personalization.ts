/**
 * Personalization Module
 * Tone detection, context restoration, and user preference management
 */

import { redis } from './redis';
import { 
  PageContext, 
  UserProfile, 
  ConversationContext,
  getTimeBasedGreeting,
  getQuickButtonsForPage,
} from './context';

// ============================================
// Tone Detection
// ============================================

export type ToneType = 'formal' | 'casual' | 'technical';

interface ToneIndicators {
  formal: string[];
  casual: string[];
  technical: string[];
}

const TONE_INDICATORS: ToneIndicators = {
  formal: [
    'вы', 'вас', 'ваш', 'вам',
    'здравствуйте', 'добрый день', 'доброе утро', 'добрый вечер',
    'пожалуйста', 'благодарю', 'спасибо большое',
    'прошу', 'не могли бы вы', 'будьте добры',
  ],
  casual: [
    'ты', 'тебя', 'твой', 'тебе',
    'привет', 'здарова', 'йо', 'хай',
    'спс', 'плиз', 'пжлста',
    'короче', 'типа', 'кстати',
    '))', ')))', '😊', '👍', '🔥',
  ],
  technical: [
    'api', 'rest', 'json', 'xml',
    'база данных', 'sql', 'nosql',
    'интеграция', 'webhook', 'endpoint',
    'backend', 'frontend', 'fullstack',
    'react', 'vue', 'angular', 'node',
    'docker', 'kubernetes', 'ci/cd',
    'микросервис', 'монолит', 'архитектура',
    'протокол', 'аутентификация', 'авторизация',
  ],
};

/**
 * Detect tone from first few messages
 */
export function detectTone(messages: Array<{ role: string; content: string }>): ToneType {
  // Analyze first 3 user messages
  const userMessages = messages
    .filter(m => m.role === 'user')
    .slice(0, 3)
    .map(m => m.content.toLowerCase());

  if (userMessages.length === 0) {
    return 'formal'; // Default
  }

  const text = userMessages.join(' ');
  
  // Count indicators
  const scores: Record<ToneType, number> = {
    formal: 0,
    casual: 0,
    technical: 0,
  };

  for (const [tone, indicators] of Object.entries(TONE_INDICATORS)) {
    for (const indicator of indicators) {
      if (text.includes(indicator)) {
        scores[tone as ToneType]++;
      }
    }
  }

  // Check sentence structure
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  
  // Longer sentences with complex structure suggest formal tone
  if (avgLength > 50 && scores.formal > 0) {
    scores.formal += 1;
  }
  
  // Short sentences with emoji suggest casual
  if (avgLength < 30 && (text.includes(')') || text.includes('😊'))) {
    scores.casual += 1;
  }

  // Multiple technical terms suggest technical tone
  if (scores.technical >= 2) {
    scores.technical += 2;
  }

  // Determine dominant tone
  const entries = Object.entries(scores);
  entries.sort((a, b) => b[1] - a[1]);

  return entries[0][1] > 0 ? (entries[0][0] as ToneType) : 'formal';
}

/**
 * Detect if message contains technical questions
 */
export function detectTechnicalQuestion(text: string): boolean {
  const technicalPatterns = [
    /как(ая|ое|ие|ой)\s+(технолог|стек|архитектур)/i,
    /на\s+(чём|чем)\s+(разработан|написан|сделан)/i,
    /используете\s+(ли\s+)?/i,
    /(поддерживает|работает\s+с)/i,
    /(api|интеграция|вебхук|webhook)/i,
  ];

  return technicalPatterns.some(pattern => pattern.test(text));
}

// ============================================
// Context Restoration
// ============================================

const CONTEXT_KEY_PREFIX = 'chatbot24:context:';
const CONTEXT_TTL = 60 * 60 * 24 * 7; // 7 days

interface StoredContext {
  userProfile: UserProfile;
  lastMessages: Array<{ role: string; content: string; timestamp: string }>;
  draftMessage?: string;
  openForm?: string;
}

/**
 * Save user context to Redis
 */
export async function saveUserContext(
  userId: string,
  context: Partial<StoredContext>
): Promise<void> {
  if (!redis) {
    // Fallback to localStorage (client-side)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chatbot24_context_${userId}`, JSON.stringify(context));
    }
    return;
  }

  try {
    const key = `${CONTEXT_KEY_PREFIX}${userId}`;
    await redis.set(key, JSON.stringify(context), { ex: CONTEXT_TTL });
  } catch (error) {
    console.error('[Personalization] Failed to save context:', error);
  }
}

/**
 * Restore user context from Redis
 */
export async function restoreUserContext(userId: string): Promise<Partial<StoredContext> | null> {
  if (!redis) {
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`chatbot24_context_${userId}`);
        if (!stored) return null;
        // Handle corrupted data - check for common issues
        if (stored === '[object Object]' || stored.startsWith('[object')) {
          console.warn('[Personalization] Found corrupted context data, removing:', stored);
          localStorage.removeItem(`chatbot24_context_${userId}`);
          return null;
        }
        // Validate JSON before parsing
        if (!stored.trim().startsWith('{') && !stored.trim().startsWith('[')) {
          console.warn('[Personalization] Invalid JSON format, removing:', stored.substring(0, 50));
          localStorage.removeItem(`chatbot24_context_${userId}`);
          return null;
        }
        return JSON.parse(stored);
      } catch (error) {
        console.error('[Personalization] Failed to parse context:', error);
        localStorage.removeItem(`chatbot24_context_${userId}`);
        return null;
      }
    }
    return null;
  }

  try {
    const key = `${CONTEXT_KEY_PREFIX}${userId}`;
    const data = await redis.get<string>(key);
    if (!data) return null;
    // Handle corrupted data
    if (data === '[object Object]' || data.startsWith('[object')) {
      console.warn('[Personalization] Found corrupted Redis context data');
      await redis.del(key);
      return null;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('[Personalization] Failed to restore context:', error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const existing = await restoreUserContext(userId);
  
  const updatedProfile: UserProfile = {
    ...existing?.userProfile,
    ...updates,
    id: userId,
    lastSeen: new Date().toISOString(),
  } as UserProfile;

  await saveUserContext(userId, {
    ...existing,
    userProfile: updatedProfile,
  });
}

/**
 * Track conversation topic
 */
export async function trackConversationTopic(
  userId: string,
  topic: string
): Promise<void> {
  const existing = await restoreUserContext(userId);
  
  const currentTopics = existing?.userProfile?.lastTopics || [];
  const updatedTopics = [topic, ...currentTopics].slice(0, 5); // Keep last 5

  await updateUserProfile(userId, {
    lastTopics: updatedTopics,
    totalConversations: (existing?.userProfile?.totalConversations || 0) + 1,
  });
}

// ============================================
// LocalStorage Helpers (Client-side)
// ============================================

const STORAGE_KEYS = {
  USER_ID: 'chatbot24_user_id',
  PROFILE: 'chatbot24_profile',
  PREFERENCES: 'chatbot24_preferences',
  DRAFT_MESSAGE: 'chatbot24_draft',
  CONVERSATION_HISTORY: 'chatbot24_history',
};

/**
 * Get or create user ID
 */
export function getUserId(): string {
  if (typeof window === 'undefined') {
    return `server_${Date.now()}`;
  }

  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  return userId;
}

/**
 * Save draft message
 */
export function saveDraftMessage(message: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DRAFT_MESSAGE, message);
}

/**
 * Get draft message
 */
export function getDraftMessage(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.DRAFT_MESSAGE) || '';
}

/**
 * Clear draft message
 */
export function clearDraftMessage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.DRAFT_MESSAGE);
}

/**
 * Save conversation history
 */
export function saveConversationHistory(messages: Array<{ role: string; content: string }>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CONVERSATION_HISTORY, JSON.stringify(messages));
}

/**
 * Get conversation history
 */
export function getConversationHistory(): Array<{ role: string; content: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATION_HISTORY);
    if (!stored) return [];
    // Handle corrupted data
    if (stored === '[object Object]') {
      localStorage.removeItem(STORAGE_KEYS.CONVERSATION_HISTORY);
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('[Personalization] Failed to parse conversation history:', error);
    localStorage.removeItem(STORAGE_KEYS.CONVERSATION_HISTORY);
    return [];
  }
}

// ============================================
// Adaptive Greeting
// ============================================

export interface GreetingConfig {
  message: string;
  tone: ToneType;
  quickButtons: Array<{ label: string; action: string }>;
}

/**
 * Generate adaptive greeting based on context
 */
export function generateAdaptiveGreeting(
  pageContext: PageContext,
  userProfile?: UserProfile
): GreetingConfig {
  // Get time-based greeting
  const timeGreeting = getTimeBasedGreeting();
  
  // Get page-specific quick buttons
  const quickButtons = getQuickButtonsForPage(pageContext.path);

  // Adjust tone based on user profile
  let tone: ToneType = 'formal';
  if (userProfile?.preferredTone) {
    tone = userProfile.preferredTone;
  } else if (pageContext.productCategory === 'chatbot') {
    tone = 'casual';
  }

  // Personalize greeting
  let message = timeGreeting.greeting;
  
  if (userProfile?.contacts?.name) {
    message = `${timeGreeting.greeting.split('!')[0]}, ${userProfile.contacts.name}!`;
  }

  // Add context-specific follow-up
  if (pageContext.productCategory === 'chatbot') {
    message += ' Расскажу о возможностях чат-ботов для вашего бизнеса.';
  } else if (pageContext.productCategory === 'website') {
    message += ' Помогу рассчитать стоимость разработки сайта.';
  }

  return {
    message,
    tone,
    quickButtons: quickButtons.map(btn => ({
      label: btn.label,
      action: btn.action,
    })),
  };
}

// ============================================
// Page Context Extraction
// ============================================

/**
 * Extract page context (for server-side or client-side)
 */
export function extractPageContext(): PageContext {
  if (typeof window === 'undefined') {
    return {
      url: '',
      title: '',
      keywords: [],
      path: '',
    };
  }

  const url = window.location.href;
  const title = document.title;
  const path = window.location.pathname;
  const h1 = document.querySelector('h1')?.textContent || undefined;

  // Extract keywords from meta
  const keywordsMeta = document.querySelector('meta[name="keywords"]');
  const keywords = keywordsMeta
    ? (keywordsMeta.getAttribute('content') || '').split(',').map(k => k.trim())
    : [];

  // Detect product category from URL
  const productCategory = detectProductCategory(path);

  return {
    url,
    title,
    h1,
    keywords,
    productCategory,
    path,
  };
}

/**
 * Detect product category from path
 */
function detectProductCategory(path: string): string | undefined {
  const patterns: Record<string, string[]> = {
    'chatbot': ['/chatbot', '/bot', '/ai-assistant'],
    'website': ['/website', '/site', '/web'],
    'mobile': ['/mobile', '/app', '/ios', '/android'],
    'design': ['/design', '/ui', '/ux'],
    'marketing': ['/seo', '/marketing', '/ads'],
  };

  const pathLower = path.toLowerCase();
  for (const [category, paths] of Object.entries(patterns)) {
    if (paths.some(p => pathLower.includes(p))) {
      return category;
    }
  }

  return undefined;
}

// ============================================
// Context Builder
// ============================================

/**
 * Build complete conversation context
 */
export function buildConversationContext(
  pageContext: PageContext,
  userProfile?: UserProfile,
  widgetMode?: ConversationContext['widgetMode']
): ConversationContext {
  const { detectIndustryFromPage } = require('./context');
  
  return {
    pageContext,
    industryContext: detectIndustryFromPage(pageContext),
    userProfile,
    widgetMode,
  };
}

/**
 * Format context for system prompt
 */
export function formatContextForPrompt(context: ConversationContext): string {
  const parts: string[] = [];

  if (context.pageContext.title) {
    parts.push(`Страница: ${context.pageContext.title}`);
  }
  if (context.pageContext.productCategory) {
    parts.push(`Категория: ${context.pageContext.productCategory}`);
  }

  if (context.industryContext) {
    parts.push(`Отрасль: ${context.industryContext.name}`);
    parts.push(`Типичный бюджет: ${context.industryContext.budgetRange.min}-${context.industryContext.budgetRange.max} ₽`);
  }

  if (context.userProfile?.contacts?.name) {
    parts.push(`Клиент: ${context.userProfile.contacts.name}`);
  }
  if (context.userProfile?.indicatedBudget) {
    parts.push(`Бюджет клиента: ~${context.userProfile.indicatedBudget.toLocaleString('ru-RU')} ₽`);
  }

  return parts.length > 0 ? '\n\nКОНТЕКСТ:\n' + parts.join('\n') : '';
}
