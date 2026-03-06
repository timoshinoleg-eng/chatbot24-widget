/**
 * Widget Modes Module
 * Configuration and management for FAQ, Sales, and Support modes
 */

import type { PromptVariant } from './prompts';

// ============================================
// Types
// ============================================

export type WidgetMode = 'faq' | 'sales' | 'support';

export interface ProactiveTrigger {
  afterSeconds?: number;
  onScrollDepth?: number; // percentage 0-100
  message: string;
}

export interface EscalationTrigger {
  keyword?: string;
  afterMessages?: number;
  onNegativeSentiment?: number; // threshold 0-1
}

export interface WidgetModeConfig {
  id: WidgetMode;
  name: string;
  greeting: string;
  enableLeadCapture: boolean;
  maxResponseLength?: number;
  fallbackToHuman: boolean;
  promptVariant: PromptVariant;
  proactiveTriggers?: ProactiveTrigger[];
  escalationTriggers?: EscalationTrigger[];
  urgencyIndicators?: boolean;
  ticketCreation?: boolean;
  quickButtons: Array<{ label: string; action: string }>;
  features: {
    showTypingIndicator: boolean;
    showOnlineStatus: boolean;
    enableFileUpload: boolean;
    enableVoice: boolean;
  };
}

// ============================================
// Mode Configurations
// ============================================

export const WIDGET_MODE_CONFIGS: Record<WidgetMode, WidgetModeConfig> = {
  // FAQ Mode
  faq: {
    id: 'faq',
    name: 'FAQ / Справка',
    greeting: 'Задайте вопрос — найдём ответ в базе знаний',
    enableLeadCapture: false,
    maxResponseLength: 500,
    fallbackToHuman: false,
    promptVariant: 'faq',
    proactiveTriggers: [],
    escalationTriggers: [],
    urgencyIndicators: false,
    ticketCreation: false,
    quickButtons: [
      { label: 'Какие услуги?', action: 'ask_services' },
      { label: 'Стоимость', action: 'ask_pricing' },
      { label: 'Сроки', action: 'ask_timeline' },
      { label: 'Поддержка', action: 'ask_support' },
    ],
    features: {
      showTypingIndicator: true,
      showOnlineStatus: false,
      enableFileUpload: false,
      enableVoice: false,
    },
  },

  // Sales Mode
  sales: {
    id: 'sales',
    name: 'Продажи',
    greeting: 'Привет! 👋 Готов помочь выбрать решение для вашего бизнеса',
    enableLeadCapture: true,
    fallbackToHuman: true,
    promptVariant: 'sales',
    proactiveTriggers: [
      {
        afterSeconds: 30,
        message: 'Есть вопросы? Я помогу подобрать оптимальное решение!',
      },
      {
        onScrollDepth: 70,
        message: 'Увидели что-то интересное? Давайте обсудим детали!',
      },
    ],
    escalationTriggers: [
      {
        keyword: 'менеджер',
      },
      {
        keyword: 'позвоните',
      },
    ],
    urgencyIndicators: true,
    ticketCreation: false,
    quickButtons: [
      { label: 'Рассчитать стоимость', action: 'request_calculation' },
      { label: 'Получить консультацию', action: 'request_consultation' },
      { label: 'Посмотреть кейсы', action: 'view_cases' },
      { label: 'Оставить заявку', action: 'submit_lead' },
    ],
    features: {
      showTypingIndicator: true,
      showOnlineStatus: true,
      enableFileUpload: false,
      enableVoice: true,
    },
  },

  // Support Mode
  support: {
    id: 'support',
    name: 'Поддержка',
    greeting: 'Здравствуйте! Служба поддержки на связи. Опишите вашу проблему.',
    enableLeadCapture: false,
    fallbackToHuman: true,
    promptVariant: 'support',
    proactiveTriggers: [],
    escalationTriggers: [
      {
        keyword: 'срочно',
      },
      {
        keyword: 'авария',
      },
      {
        keyword: 'не работает',
      },
      {
        afterMessages: 5,
      },
      {
        onNegativeSentiment: 0.8,
      },
    ],
    urgencyIndicators: false,
    ticketCreation: true,
    quickButtons: [
      { label: 'Техническая проблема', action: 'report_technical' },
      { label: 'Вопрос по оплате', action: 'ask_billing' },
      { label: 'Статус заявки', action: 'check_status' },
      { label: 'Связаться с менеджером', action: 'request_manager' },
    ],
    features: {
      showTypingIndicator: true,
      showOnlineStatus: true,
      enableFileUpload: true,
      enableVoice: false,
    },
  },
};

// ============================================
// Mode Management
// ============================================

const CURRENT_MODE_KEY = 'chatbot24_widget_mode';

/**
 * Get current widget mode
 */
export function getCurrentMode(): WidgetMode {
  if (typeof window === 'undefined') {
    return 'sales'; // Default for SSR
  }

  const stored = localStorage.getItem(CURRENT_MODE_KEY);
  if (stored && ['faq', 'sales', 'support'].includes(stored)) {
    return stored as WidgetMode;
  }

  return 'sales'; // Default
}

/**
 * Set widget mode
 */
export function setWidgetMode(mode: WidgetMode): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(CURRENT_MODE_KEY, mode);
  
  // Dispatch event for real-time updates
  window.dispatchEvent(new CustomEvent('chatbot24:modeChanged', { detail: { mode } }));
}

/**
 * Get mode configuration
 */
export function getModeConfig(mode?: WidgetMode): WidgetModeConfig {
  const currentMode = mode || getCurrentMode();
  return WIDGET_MODE_CONFIGS[currentMode];
}

/**
 * Check if feature is enabled in current mode
 */
export function isFeatureEnabled(feature: keyof WidgetModeConfig['features']): boolean {
  const config = getModeConfig();
  return config.features[feature];
}

/**
 * Check if lead capture is enabled
 */
export function isLeadCaptureEnabled(): boolean {
  const config = getModeConfig();
  return config.enableLeadCapture;
}

/**
 * Check if should escalate to human
 */
export function shouldEscalate(
  messageCount: number,
  sentimentScore: number,
  messageText: string
): boolean {
  const config = getModeConfig();
  
  if (!config.fallbackToHuman) {
    return false;
  }

  const triggers = config.escalationTriggers || [];
  
  for (const trigger of triggers) {
    // Keyword trigger
    if (trigger.keyword && messageText.toLowerCase().includes(trigger.keyword.toLowerCase())) {
      return true;
    }
    
    // Message count trigger
    if (trigger.afterMessages && messageCount >= trigger.afterMessages) {
      return true;
    }
    
    // Sentiment trigger
    if (trigger.onNegativeSentiment && sentimentScore <= -trigger.onNegativeSentiment) {
      return true;
    }
  }

  return false;
}

// ============================================
// Proactive Triggers
// ============================================

interface TriggerState {
  scrollTriggered: boolean;
  timeTriggered: boolean;
  lastTriggerTime: number;
}

const triggerStates = new Map<string, TriggerState>();

/**
 * Initialize trigger state for session
 */
export function initTriggerState(sessionId: string): void {
  triggerStates.set(sessionId, {
    scrollTriggered: false,
    timeTriggered: false,
    lastTriggerTime: Date.now(),
  });
}

/**
 * Check scroll depth trigger
 */
export function checkScrollTrigger(sessionId: string, scrollDepth: number): string | null {
  const config = getModeConfig();
  const state = triggerStates.get(sessionId);
  
  if (!state || state.scrollTriggered) {
    return null;
  }

  for (const trigger of config.proactiveTriggers || []) {
    if (trigger.onScrollDepth && scrollDepth >= trigger.onScrollDepth) {
      state.scrollTriggered = true;
      return trigger.message;
    }
  }

  return null;
}

/**
 * Check time-based trigger
 */
export function checkTimeTrigger(sessionId: string, elapsedSeconds: number): string | null {
  const config = getModeConfig();
  const state = triggerStates.get(sessionId);
  
  if (!state || state.timeTriggered) {
    return null;
  }

  for (const trigger of config.proactiveTriggers || []) {
    if (trigger.afterSeconds && elapsedSeconds >= trigger.afterSeconds) {
      state.timeTriggered = true;
      return trigger.message;
    }
  }

  return null;
}

// ============================================
// Mode Detection
// ============================================

/**
 * Auto-detect mode based on page context
 */
export function detectModeFromPage(path: string): WidgetMode {
  const pathLower = path.toLowerCase();

  // Support pages
  if (pathLower.includes('/support') || 
      pathLower.includes('/help') || 
      pathLower.includes('/faq') ||
      pathLower.includes('/contact')) {
    return 'support';
  }

  // Pricing/sales pages
  if (pathLower.includes('/pricing') || 
      pathLower.includes('/buy') || 
      pathLower.includes('/order') ||
      pathLower.includes('/demo')) {
    return 'sales';
  }

  // Documentation pages
  if (pathLower.includes('/docs') || 
      pathLower.includes('/kb') || 
      pathLower.includes('/wiki')) {
    return 'faq';
  }

  return 'sales'; // Default
}

// ============================================
// Admin Functions
// ============================================

export interface ModeSwitchEvent {
  from: WidgetMode;
  to: WidgetMode;
  timestamp: string;
  userId?: string;
}

const MODE_HISTORY_KEY = 'chatbot24_mode_history';

/**
 * Log mode switch
 */
export function logModeSwitch(from: WidgetMode, to: WidgetMode, userId?: string): void {
  if (typeof window === 'undefined') return;

  const event: ModeSwitchEvent = {
    from,
    to,
    timestamp: new Date().toISOString(),
    userId,
  };

  const history = getModeHistory();
  history.push(event);
  
  // Keep only last 50 events
  if (history.length > 50) {
    history.shift();
  }

  localStorage.setItem(MODE_HISTORY_KEY, JSON.stringify(history));
}

/**
 * Get mode switch history
 */
export function getModeHistory(): ModeSwitchEvent[] {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem(MODE_HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Get mode statistics
 */
export function getModeStats(): Record<WidgetMode, number> {
  const history = getModeHistory();
  const stats: Record<WidgetMode, number> = {
    faq: 0,
    sales: 0,
    support: 0,
  };

  for (const event of history) {
    stats[event.to]++;
  }

  return stats;
}
