/**
 * AI Lead Scoring System
 * LLM-based lead qualification and scoring
 * Replaces rule-based scoring with deep semantic analysis
 */

import { zai } from './zai';

// Types
export interface ExtractedBudget {
  value: number;
  currency: string;
  confidence: number;
  range?: { min: number; max: number };
}

export interface ExtractedTimeline {
  minWeeks: number;
  maxWeeks: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  deadline?: string;
  confidence: number;
}

export type ProjectType = 'лендинг' | 'корпсайт' | 'магазин' | 'приложение' | 'бот' | 'не ясно';

export interface ExtractedEntities {
  budget: ExtractedBudget | null;
  timeline: ExtractedTimeline | null;
  projectType: ProjectType;
  decisionMaker: boolean | null;
  previousExperience: 'positive' | 'negative' | 'none';
  contacts: {
    phone?: string;
    email?: string;
    name?: string;
    company?: string;
  };
}

export interface RecommendedAction {
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  timeframe: 'сейчас' | 'в течение часа' | 'сегодня' | 'неделя';
  channel: 'звонок' | 'email' | 'мессенджер';
  assignedTo: 'sales-manager' | 'tech-lead';
}

export interface LeadScore {
  status: 'HOT' | 'WARM' | 'COLD';
  confidence: number; // 0.0-1.0
  justification: string; // 2-3 sentences
  extractedData: ExtractedEntities;
  recommendedAction: RecommendedAction;
  redFlags: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ScoringContext {
  messages: ConversationMessage[];
  userId?: string;
  pageUrl?: string;
  source?: string;
}

// Legacy interface for backward compatibility
export interface LegacyLeadScore {
  score: number;
  status: 'HOT' | 'WARM' | 'COLD';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
}

const SCORING_PROMPT = `Ты — AI-система скоринга лидов для веб-студии. Проанализируй диалог с потенциальным клиентом и извлеки структурированные данные.

Извлеки следующие сущности:
1. Бюджет: числовое значение, валюта, уверенность (0-1)
2. Сроки: minWeeks, maxWeeks, срочность (critical/high/medium/low), уверенность
3. Тип проекта: лендинг/корпсайт/магазин/приложение/бот/не ясно
4. Лицо принимающее решение: true/false/null
5. Предыдущий опыт: positive/negative/none
6. Контакты: телефон, email, имя, компания

Определи статус лида:
- HOT: бюджет >= 100000 ИЛИ срочность critical/high ИЛИ явные маркеры готовности ("готовы обсудить", "жду звонка", "пришлите КП")
- WARM: бюджет 50000-100000 ИЛИ средняя срочность ИЛИ интерес без явной срочности
- COLD: бюджет < 50000 ИЛИ низкая срочность ИЛИ информационный запрос

Рекомендуемое действие:
- Приоритет 1-10 (1 — максимальный)
- Время ответа: сейчас/в течение часа/сегодня/неделя
- Канал: звонок/email/мессенджер
- Исполнитель: sales-manager/tech-lead

Red flags — потенциальные риски: неадекватные ожидания, упоминание конкурентов с негативом, неопределённость бюджета, "просто справочный звонок".

Ответь СТРОГО в JSON-формате без markdown:
{
  "status": "HOT|WARM|COLD",
  "confidence": 0.85,
  "justification": "2-3 предложения обоснования",
  "extractedData": {
    "budget": { "value": 150000, "currency": "RUB", "confidence": 0.8, "range": { "min": 100000, "max": 200000 } },
    "timeline": { "minWeeks": 2, "maxWeeks": 4, "urgency": "high", "confidence": 0.9 },
    "projectType": "бот",
    "decisionMaker": true,
    "previousExperience": "none",
    "contacts": { "phone": "+7...", "email": "...", "name": "...", "company": "..." }
  },
  "recommendedAction": {
    "priority": 2,
    "timeframe": "в течение часа",
    "channel": "звонок",
    "assignedTo": "sales-manager"
  },
  "redFlags": ["..."]
}`;

/**
 * Parse budget from text
 */
function parseBudget(text: string): ExtractedBudget | null {
  const patterns = [
    // "100 000 рублей", "100000₽", "100 тыс"
    { regex: /(\d[\d\s]*)\s*(?:тыс|тысяч)?\.?\s*(?:руб|₽|RUB)/i, multiplier: 1 },
    // "150-200к", "150-200 тыс"
    { regex: /(\d+)-(\d+)\s*(?:к|тыс)/i, multiplier: 1000 },
    // "до 100 000", "порядка ста тысяч"
    { regex: /(?:до|порядка|около|примерно)\s*(\d[\d\s]*)/i, multiplier: 1 },
    // "от 50к"
    { regex: /(?:от|starting|от\s*)(\d[\d\s]*)/i, multiplier: 1 },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      if (match[2]) {
        // Range match
        const min = parseInt(match[1].replace(/\s/g, ''), 10) * pattern.multiplier;
        const max = parseInt(match[2].replace(/\s/g, ''), 10) * pattern.multiplier;
        return {
          value: Math.round((min + max) / 2),
          currency: 'RUB',
          confidence: 0.7,
          range: { min, max },
        };
      } else {
        const value = parseInt(match[1].replace(/\s/g, ''), 10) * pattern.multiplier;
        if (!isNaN(value) && value > 0) {
          return {
            value,
            currency: 'RUB',
            confidence: 0.8,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Parse timeline from text
 */
function parseTimeline(text: string): ExtractedTimeline | null {
  const textLower = text.toLowerCase();
  
  // Urgency keywords
  const urgencyPatterns = {
    critical: ['срочно', 'горит', 'вчера', 'немедленно', 'asap', 'критично'],
    high: ['высокий приоритет', 'важно', 'в ближайшее время', 'к началу', 'к запуску'],
    medium: ['в этом месяце', 'в течение месяца', 'нормальные сроки'],
    low: ['не горит', 'когда будет готово', 'без спешки', 'подождём'],
  };

  let urgency: ExtractedTimeline['urgency'] = 'medium';
  for (const [level, patterns] of Object.entries(urgencyPatterns)) {
    if (patterns.some(p => textLower.includes(p))) {
      urgency = level as ExtractedTimeline['urgency'];
      break;
    }
  }

  // Week patterns
  const weekMatch = text.match(/(\d+)\s*(?:недел|week)/i);
  const monthMatch = text.match(/(\d+)\s*(?:месяц|month)/i);
  const dayMatch = text.match(/(\d+)\s*(?:день|дней|day)/i);

  let minWeeks = 2;
  let maxWeeks = 8;

  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    minWeeks = Math.max(1, Math.floor(days / 7));
    maxWeeks = minWeeks + 1;
  } else if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10);
    minWeeks = weeks;
    maxWeeks = weeks + 2;
  } else if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    minWeeks = months * 4;
    maxWeeks = months * 4 + 2;
  }

  return {
    minWeeks,
    maxWeeks,
    urgency,
    confidence: 0.7,
  };
}

/**
 * Detect project type from text
 */
function detectProjectType(text: string): ProjectType {
  const textLower = text.toLowerCase();
  
  const patterns: Record<ProjectType, string[]> = {
    'лендинг': ['лендинг', 'landing', 'одностраничник', 'продающая страница'],
    'корпсайт': ['корпоративный', 'сайт компании', 'визитка', 'корпсайт'],
    'магазин': ['магазин', 'shop', 'ecommerce', 'интернет-магазин', 'каталог'],
    'приложение': ['приложение', 'app', 'ios', 'android', 'мобильное'],
    'бот': ['бот', 'чат-бот', 'chatbot', 'ai-ассистент', 'автоответчик'],
    'не ясно': [],
  };

  for (const [type, typePatterns] of Object.entries(patterns)) {
    if (typePatterns.some(p => textLower.includes(p))) {
      return type as ProjectType;
    }
  }

  return 'не ясно';
}

/**
 * Detect if user is decision maker
 */
function detectDecisionMaker(text: string): boolean | null {
  const textLower = text.toLowerCase();
  
  const decisionPatterns = ['решу я', 'я решаю', 'я владелец', 'я директор', 'мой бизнес', 'мне нужно'];
  const nonDecisionPatterns = ['надо согласовать', 'спрошу у', 'обсужу с', 'покажу директору', 'решение принимает'];

  if (decisionPatterns.some(p => textLower.includes(p))) {
    return true;
  }
  if (nonDecisionPatterns.some(p => textLower.includes(p))) {
    return false;
  }
  return null;
}

/**
 * Detect previous experience
 */
function detectPreviousExperience(text: string): ExtractedEntities['previousExperience'] {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('уже работали') || textLower.includes('хороший опыт') || textLower.includes('довольны')) {
    return 'positive';
  }
  if (textLower.includes('плохой опыт') || textLower.includes('разочаровались') || textLower.includes('проблемы с подрядчиком')) {
    return 'negative';
  }
  return 'none';
}

/**
 * Extract contacts from messages
 */
function extractContacts(messages: ConversationMessage[]): ExtractedEntities['contacts'] {
  const allText = messages.map(m => m.content).join(' ');
  const contacts: ExtractedEntities['contacts'] = {};

  // Phone regex (Russian format)
  const phoneRegex = /(?:\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/;
  const phoneMatch = allText.match(phoneRegex);
  if (phoneMatch) {
    contacts.phone = phoneMatch[0];
  }

  // Email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = allText.match(emailRegex);
  if (emailMatch) {
    contacts.email = emailMatch[0];
  }

  // Name detection (simplified)
  const namePatterns = [
    /меня зовут ([А-Я][а-я]+)/i,
    /я ([А-Я][а-я]+)/i,
    /имя: ([А-Я][а-я]+)/i,
  ];
  for (const pattern of namePatterns) {
    const match = allText.match(pattern);
    if (match) {
      contacts.name = match[1];
      break;
    }
  }

  // Company detection
  const companyPatterns = [
    /компания ([А-Я][^,.\s]+)/i,
    /из компании ([^,.]+)/i,
    /в компании ([^,.]+)/i,
  ];
  for (const pattern of companyPatterns) {
    const match = allText.match(pattern);
    if (match) {
      contacts.company = match[1].trim();
      break;
    }
  }

  return contacts;
}

/**
 * AI-based lead scoring
 */
export async function scoreLeadWithAI(context: ScoringContext): Promise<LeadScore> {
  const { messages } = context;
  
  // Build conversation text
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'Клиент' : 'Ассистент'}: ${m.content}`)
    .join('\n');

  // Try AI scoring first
  if (zai.isConfigured()) {
    try {
      const response = await zai.createCompletion([
        { role: 'system', content: SCORING_PROMPT },
        { role: 'user', content: `Проанализируй диалог:\n\n${conversationText}` },
      ], {
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices?.[0]?.message?.content || '';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as LeadScore;
        return parsed;
      }
    } catch (error) {
      console.warn('[Scoring] AI scoring failed, falling back to heuristic:', error);
    }
  }

  // Fallback to heuristic scoring
  return scoreLeadHeuristic(messages);
}

/**
 * Heuristic scoring (fallback when AI is unavailable)
 */
function scoreLeadHeuristic(messages: ConversationMessage[]): LeadScore {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  
  // Extract entities
  const budget = parseBudget(allText);
  const timeline = parseTimeline(allText);
  const projectType = detectProjectType(allText);
  const decisionMaker = detectDecisionMaker(allText);
  const previousExperience = detectPreviousExperience(allText);
  const contacts = extractContacts(messages);

  // Determine status
  let status: LeadScore['status'] = 'COLD';
  let confidence = 0.5;
  const redFlags: string[] = [];

  // HOT criteria
  const isHotBudget = budget && budget.value >= 100000 && budget.confidence >= 0.7;
  const isHotTimeline = timeline && ['critical', 'high'].includes(timeline.urgency);
  const isHotReady = ['готовы обсудить', 'жду звонка', 'пришлите кп', 'отправьте предложение'].some(
    p => allText.includes(p)
  );

  if (isHotBudget || isHotTimeline || isHotReady) {
    status = 'HOT';
    confidence = 0.8;
  } else if ((budget && budget.value >= 50000) || (timeline && timeline.urgency === 'medium')) {
    status = 'WARM';
    confidence = 0.6;
  }

  // Red flags
  if (!budget) redFlags.push('Бюджет не указан');
  if (!timeline) redFlags.push('Сроки не определены');
  if (decisionMaker === false) redFlags.push('Не лицо принимающее решение');
  if (previousExperience === 'negative') redFlags.push('Негативный предыдущий опыт');
  if (allText.includes('просто справочный') || allText.includes('просто интересно')) {
    redFlags.push('Информационный запрос без намерения покупки');
  }

  // Recommended action
  const recommendedAction: RecommendedAction = {
    priority: status === 'HOT' ? 2 : status === 'WARM' ? 5 : 8,
    timeframe: status === 'HOT' ? 'в течение часа' : status === 'WARM' ? 'сегодня' : 'неделя',
    channel: status === 'HOT' ? 'звонок' : 'мессенджер',
    assignedTo: projectType === 'бот' || projectType === 'не ясно' ? 'sales-manager' : 'tech-lead',
  };

  // Justification
  const justifications: string[] = [];
  if (budget) {
    justifications.push(`Указан бюджет около ${budget.value.toLocaleString('ru-RU')} ₽.`);
  }
  if (timeline) {
    justifications.push(`Сроки: ${timeline.minWeeks}-${timeline.maxWeeks} недель, срочность ${timeline.urgency}.`);
  }
  if (decisionMaker) {
    justifications.push('Клиент является лицом, принимающим решение.');
  }
  if (redFlags.length > 0) {
    justifications.push(`Обнаружены риски: ${redFlags.join(', ')}.`);
  }

  return {
    status,
    confidence,
    justification: justifications.join(' ') || 'Недостаточно данных для полной оценки.',
    extractedData: {
      budget,
      timeline,
      projectType,
      decisionMaker,
      previousExperience,
      contacts,
    },
    recommendedAction,
    redFlags,
  };
}

/**
 * Legacy scoring function for backward compatibility
 */
export function scoreLead(budget: string, timeline: string): LegacyLeadScore {
  const budgetMap: Record<string, number> = {
    'до 50 000₽': 20,
    '50 000₽ - 100 000₽': 40,
    '100 000₽ - 250 000₽': 60,
    '250 000₽+': 90,
    'unknown': 30,
    'не указан': 30,
  };

  const timelineMap: Record<string, number> = {
    'срочно': 30,
    '1 неделя': 25,
    '1 месяц': 20,
    'не определено': 5,
    'unknown': 10,
    'не указаны': 10,
  };

  const budgetScore = budgetMap[budget] || 30;
  const timelineScore = timelineMap[timeline.toLowerCase()] || 10;
  const score = budgetScore + timelineScore;

  return {
    score,
    status: score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD',
    priority: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
    action: score >= 70
      ? 'Немедленный звонок менеджером'
      : score >= 40
        ? 'Отправка КП в течение 24 часов'
        : 'Добавить в рассылку',
  };
}

/**
 * Get score color classes
 */
export function getScoreColor(status: LeadScore['status'] | LegacyLeadScore['status']): string {
  switch (status) {
    case 'HOT':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'WARM':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'COLD':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: LegacyLeadScore['priority']): string {
  switch (priority) {
    case 'HIGH':
      return 'bg-red-500';
    case 'MEDIUM':
      return 'bg-amber-500';
    case 'LOW':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Check if lead qualifies as HOT based on AI scoring
 */
export function isHotLead(score: LeadScore): boolean {
  return score.status === 'HOT' && score.confidence >= 0.6;
}

/**
 * Format lead score for Bitrix24 custom fields
 */
export function formatScoreForBitrix(score: LeadScore): Record<string, string> {
  return {
    UF_CRM_AI_SCORE_STATUS: score.status,
    UF_CRM_AI_SCORE_CONFIDENCE: score.confidence.toFixed(2),
    UF_CRM_AI_SCORE_JUSTIFICATION: score.justification,
    UF_CRM_AI_SCORE_DETAILS: JSON.stringify(score),
    UF_CRM_NEXT_ACTION_PRIORITY: score.recommendedAction.priority.toString(),
    UF_CRM_NEXT_ACTION_TIMEFRAME: score.recommendedAction.timeframe,
    UF_CRM_NEXT_ACTION_CHANNEL: score.recommendedAction.channel,
    UF_CRM_ESTIMATED_VALUE: score.extractedData.budget?.value?.toString() || '',
    UF_CRM_ESTIMATED_TIMELINE: score.extractedData.timeline 
      ? `${score.extractedData.timeline.minWeeks}-${score.extractedData.timeline.maxWeeks} недель`
      : '',
  };
}
