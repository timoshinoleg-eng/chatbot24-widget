/**
 * Context Module
 * Page context, industry context extraction and management
 */

// ============================================
// Types
// ============================================

export interface PageContext {
  url: string;
  title: string;
  h1?: string;
  keywords: string[];
  productCategory?: string;
  path: string;
}

export interface IndustryContext {
  id: string;
  name: string;
  services: string[];
  budgetRange: { min: number; max: number };
  typicalTimeline: string;
  painPoints: string[];
}

export interface UserProfile {
  id: string;
  firstSeen: string;
  lastSeen: string;
  totalConversations: number;
  lastTopics: string[];
  preferredTone?: 'formal' | 'casual' | 'technical';
  indicatedBudget?: number;
  conversionStage: 'awareness' | 'evaluation' | 'decision' | 'purchase';
  contacts?: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  };
}

export interface ConversationContext {
  pageContext: PageContext;
  industryContext?: IndustryContext;
  userProfile?: UserProfile;
  widgetMode?: 'faq' | 'sales' | 'support';
  detectedTone?: 'formal' | 'casual' | 'technical';
  leadStage?: 'awareness' | 'evaluation' | 'decision' | 'purchase';
}

// ============================================
// Industry Profiles
// ============================================

export const INDUSTRY_PROFILES: Record<string, IndustryContext> = {
  'web-development': {
    id: 'web-development',
    name: 'Веб-разработка',
    services: ['Корпсайты', 'лендинги', 'веб-приложения'],
    budgetRange: { min: 100000, max: 1000000 },
    typicalTimeline: '4-12 недель',
    painPoints: [
      'Согласование дизайна',
      'Интеграции с legacy-системами',
      'Согласование с SEO-специалистами',
      'Адаптация под мобильные устройства',
    ],
  },
  'ecommerce': {
    id: 'ecommerce',
    name: 'E-commerce',
    services: ['Интернет-магазины', 'маркетплейсы', 'личные кабинеты'],
    budgetRange: { min: 300000, max: 2000000 },
    typicalTimeline: '8-16 недель',
    painPoints: [
      'Платёжные шлюзы и безопасность',
      'Нагрузочное тестирование',
      'SEO-оптимизация каталога',
      'Интеграция с 1C и складскими системами',
    ],
  },
  'corporate': {
    id: 'corporate',
    name: 'Корпоративный сектор',
    services: ['Корпоративные порталы', 'intranet', 'личные кабинеты'],
    budgetRange: { min: 500000, max: 3000000 },
    typicalTimeline: '12-24 недели',
    painPoints: [
      'Согласование безопасности и SLA',
      'Соответствие брендбуку',
      'Интеграция с Active Directory',
      'Многоуровневая система согласований',
    ],
  },
  'startup': {
    id: 'startup',
    name: 'Стартапы',
    services: ['MVP', 'прототипы', 'пивоты'],
    budgetRange: { min: 50000, max: 500000 },
    typicalTimeline: '2-8 недель',
    painPoints: [
      'Скорость запуска',
      'Гибкость изменений',
      'Ограниченный бюджет',
      'Неопределённость требований',
    ],
  },
  'chatbot': {
    id: 'chatbot',
    name: 'Чат-боты и AI',
    services: ['Чат-боты', 'AI-ассистенты', 'автоматизация'],
    budgetRange: { min: 49000, max: 500000 },
    typicalTimeline: '2-4 недели',
    painPoints: [
      'Интеграция с CRM',
      'Обучение на данных компании',
      'Обработка сложных сценариев',
      'Поддержка мультиканальности',
    ],
  },
};

// ============================================
// Page Context Extraction
// ============================================

/**
 * Extract page context from DOM (client-side)
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
 * Detect product category from URL path
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

/**
 * Get industry context based on page or explicit selection
 */
export function getIndustryContext(category?: string): IndustryContext | undefined {
  if (!category) return undefined;
  return INDUSTRY_PROFILES[category];
}

/**
 * Detect industry from page context
 */
export function detectIndustryFromPage(pageContext: PageContext): IndustryContext | undefined {
  const pathLower = pageContext.path.toLowerCase();
  const titleLower = pageContext.title.toLowerCase();

  // Chatbot indicators
  if (pathLower.includes('chatbot') || pathLower.includes('bot') ||
      titleLower.includes('чат-бот') || titleLower.includes('ai-ассистент')) {
    return INDUSTRY_PROFILES['chatbot'];
  }

  // E-commerce indicators
  if (pathLower.includes('shop') || pathLower.includes('store') || pathLower.includes('ecommerce') ||
      titleLower.includes('магазин') || titleLower.includes('e-commerce')) {
    return INDUSTRY_PROFILES['ecommerce'];
  }

  // Startup indicators
  if (pathLower.includes('startup') || pathLower.includes('mvp') ||
      titleLower.includes('стартап') || titleLower.includes('mvp')) {
    return INDUSTRY_PROFILES['startup'];
  }

  // Corporate indicators
  if (pathLower.includes('corporate') || pathLower.includes('enterprise') ||
      titleLower.includes('корпоративный') || titleLower.includes('портал')) {
    return INDUSTRY_PROFILES['corporate'];
  }

  // Default to web-development
  return INDUSTRY_PROFILES['web-development'];
}

// ============================================
// Quick Buttons Configuration
// ============================================

export interface QuickButton {
  label: string;
  action: string;
  category?: string;
}

export const QUICK_BUTTONS_CONFIG: Record<string, QuickButton[]> = {
  '/': [
    { label: 'Сколько стоит сайт?', action: 'ask_price_website', category: 'pricing' },
    { label: 'Сроки разработки', action: 'ask_timeline', category: 'timeline' },
    { label: 'Портфолио', action: 'ask_portfolio', category: 'portfolio' },
    { label: 'Бесплатная консультация', action: 'request_consultation', category: 'lead' },
  ],
  '/services/chatbots': [
    { label: 'Стоимость чат-бота', action: 'ask_price_chatbot', category: 'pricing' },
    { label: 'Интеграция с CRM', action: 'ask_integration', category: 'features' },
    { label: 'Примеры ботов', action: 'ask_examples', category: 'portfolio' },
    { label: 'Сроки разработки', action: 'ask_timeline_chatbot', category: 'timeline' },
  ],
  '/services/websites': [
    { label: 'Стоимость корпоративного сайта', action: 'ask_price_corp', category: 'pricing' },
    { label: 'Технологический стек', action: 'ask_tech_stack', category: 'tech' },
    { label: 'SEO-оптимизация', action: 'ask_seo', category: 'features' },
    { label: 'Поддержка сайта', action: 'ask_support', category: 'support' },
  ],
  '/services/mobile': [
    { label: 'Стоимость приложения', action: 'ask_price_app', category: 'pricing' },
    { label: 'iOS или Android?', action: 'ask_platform', category: 'tech' },
    { label: 'Сроки разработки', action: 'ask_timeline_app', category: 'timeline' },
    { label: 'Публикация в сторах', action: 'ask_publishing', category: 'features' },
  ],
  '/cases': [
    { label: 'Похожий проект для нас', action: 'request_similar', category: 'lead' },
    { label: 'Связаться с менеджером', action: 'request_manager', category: 'lead' },
    { label: 'Стоимость аналогичного', action: 'ask_price_similar', category: 'pricing' },
  ],
  '/pricing': [
    { label: 'Получить точный расчёт', action: 'request_calculation', category: 'lead' },
    { label: 'Сравнить тарифы', action: 'ask_comparison', category: 'pricing' },
    { label: 'Акции и скидки', action: 'ask_discounts', category: 'pricing' },
  ],
};

/**
 * Get quick buttons for current page
 */
export function getQuickButtonsForPage(path: string): QuickButton[] {
  // Find most specific match
  const sortedPaths = Object.keys(QUICK_BUTTONS_CONFIG).sort((a, b) => b.length - a.length);
  
  for (const configPath of sortedPaths) {
    if (path.startsWith(configPath)) {
      return QUICK_BUTTONS_CONFIG[configPath];
    }
  }

  // Default buttons
  return QUICK_BUTTONS_CONFIG['/'];
}

// ============================================
// Greeting Messages by Time
// ============================================

export interface TimeBasedGreeting {
  period: 'night' | 'morning' | 'day' | 'evening';
  timeRange: [number, number]; // hours in MSK
  greeting: string;
  tone: string;
}

export const TIME_BASED_GREETINGS: TimeBasedGreeting[] = [
  {
    period: 'night',
    timeRange: [0, 6],
    greeting: 'Доброй ночи! Работаем 24/7 — ответим сразу',
    tone: 'профессиональная, уравновешенная',
  },
  {
    period: 'morning',
    timeRange: [6, 12],
    greeting: 'Доброе утро! Готовы обсудить ваш проект',
    tone: 'энергичная, конструктивная',
  },
  {
    period: 'day',
    timeRange: [12, 18],
    greeting: 'Здравствуйте! Чем можем помочь?',
    tone: 'нейтральная, деловая',
  },
  {
    period: 'evening',
    timeRange: [18, 24],
    greeting: 'Добрый вечер! Есть вопросы по услугам?',
    tone: 'мягкая, приглашающая',
  },
];

/**
 * Get greeting based on current time (MSK)
 */
export function getTimeBasedGreeting(): TimeBasedGreeting {
  // Get current time in MSK (UTC+3)
  const now = new Date();
  const mskHour = (now.getUTCHours() + 3) % 24;

  for (const greeting of TIME_BASED_GREETINGS) {
    if (mskHour >= greeting.timeRange[0] && mskHour < greeting.timeRange[1]) {
      return greeting;
    }
  }

  return TIME_BASED_GREETINGS[2]; // Default to day
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
  const industryContext = detectIndustryFromPage(pageContext);

  return {
    pageContext,
    industryContext,
    userProfile,
    widgetMode,
  };
}

/**
 * Format context for system prompt
 */
export function formatContextForPrompt(context: ConversationContext): string {
  const parts: string[] = [];

  // Page context
  if (context.pageContext.title) {
    parts.push(`Страница: ${context.pageContext.title}`);
  }
  if (context.pageContext.productCategory) {
    parts.push(`Категория: ${context.pageContext.productCategory}`);
  }

  // Industry context
  if (context.industryContext) {
    parts.push(`Отрасль: ${context.industryContext.name}`);
    parts.push(`Типичный бюджет: ${context.industryContext.budgetRange.min}-${context.industryContext.budgetRange.max} ₽`);
    parts.push(`Типичные сроки: ${context.industryContext.typicalTimeline}`);
  }

  // User profile
  if (context.userProfile) {
    if (context.userProfile.contacts?.name) {
      parts.push(`Клиент: ${context.userProfile.contacts.name}`);
    }
    if (context.userProfile.indicatedBudget) {
      parts.push(`Бюджет клиента: ~${context.userProfile.indicatedBudget.toLocaleString('ru-RU')} ₽`);
    }
    parts.push(`Стадия воронки: ${context.userProfile.conversionStage}`);
  }

  return parts.length > 0 ? '\n\nКОНТЕКСТ:\n' + parts.join('\n') : '';
}
