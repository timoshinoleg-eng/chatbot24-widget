import { BriefData, LeadScore } from '../types';
import { redis } from './redis';

interface Bitrix24Lead {
  TITLE: string;
  NAME?: string;
  PHONE?: { VALUE: string; VALUE_TYPE: string }[];
  EMAIL?: { VALUE: string; VALUE_TYPE: string }[];
  COMMENTS?: string;
  SOURCE_ID?: string;
  STATUS_ID?: string;
  OPPORTUNITY?: number;
  CURRENCY_ID?: string;
  UTM_SOURCE?: string;
  UTM_MEDIUM?: string;
  UTM_CAMPAIGN?: string;
}

/**
 * Send lead to Bitrix24 CRM
 */
export const sendLeadToBitrix24 = async (
  briefData: BriefData,
  leadScore?: LeadScore
): Promise<{ success: boolean; leadId?: number; error?: string }> => {
  const webhookUrl = process.env.BITRIX24_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('[Bitrix24] BITRIX24_WEBHOOK_URL не настроен');
    return { success: false, error: 'Webhook URL not configured' };
  }

  const comments = formatBriefForComments(briefData, leadScore);
  
  const lead: Bitrix24Lead = {
    TITLE: `ChatBot24 - ${briefData.businessType} - ${briefData.contacts.name || 'Без имени'}`,
    NAME: briefData.contacts.name || 'Не указано',
    PHONE: briefData.contacts.phone ? [{ VALUE: briefData.contacts.phone, VALUE_TYPE: 'WORK' }] : undefined,
    EMAIL: briefData.contacts.email ? [{ VALUE: briefData.contacts.email, VALUE_TYPE: 'WORK' }] : undefined,
    COMMENTS: comments,
    SOURCE_ID: 'WEB',
    STATUS_ID: leadScore?.status === 'HOT' ? 'NEW' : 'IN_PROCESS',
    UTM_SOURCE: 'chatbot24-widget',
    UTM_MEDIUM: 'chat',
    UTM_CAMPAIGN: 'widget-v2',
  };

  // Определяем примерную стоимость по бюджету
  const opportunity = parseBudgetToOpportunity(briefData.budget);
  if (opportunity && opportunity > 0) {
    lead.OPPORTUNITY = opportunity;
    lead.CURRENCY_ID = 'RUB';
  }

  try {
    const response = await fetch(`${webhookUrl}crm.lead.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fields: lead, 
        params: { REGISTER_SONET_EVENT: 'Y' } 
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[Bitrix24] API error:', data.error);
      return { success: false, error: data.error };
    }

    const leadId = data.result;

    // Отправляем дублирование в группу/чат
    await sendAlertToGroup(briefData, leadScore, leadId);

    // Сохраняем в Redis для аналитики
    if (redis) {
      await redis.setex(
        `lead:${leadId}`,
        60 * 60 * 24 * 30, // 30 дней
        JSON.stringify({ briefData, leadScore, leadId, createdAt: new Date().toISOString() })
      );
    }

    return { success: true, leadId };
  } catch (error) {
    console.error('[Bitrix24] Error sending lead:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Send alert notification to Telegram group
 */
export const sendAlertToGroup = async (
  briefData: BriefData,
  leadScore?: LeadScore,
  leadId?: number
): Promise<boolean> => {
  const alertChatId = process.env.ALERT_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!alertChatId || !botToken) {
    console.log('[Alert] Переменные не настроены, пропускаем дублирование');
    return false;
  }

  const scoreEmoji = {
    'HOT': '🔥',
    'WARM': '⚡',
    'COLD': '❄️'
  };

  const message = `
${scoreEmoji[leadScore?.status || 'WARM']} <b>Новая заявка ChatBot24!</b>

📊 Оценка: <b>${leadScore?.status || 'WARM'}</b>
🏢 Сфера: ${briefData.businessType}
📱 Каналы: ${briefData.channels?.join(', ') || 'Не указаны'}
📈 Заявок/день: ${briefData.dailyRequests}
🎯 Задачи: ${briefData.botTasks?.join(', ') || 'Не указаны'}
💰 Бюджет: ${briefData.budget}
${briefData.referenceBots ? `🔗 Примеры: ${briefData.referenceBots}` : ''}

👤 <b>Контакты:</b>
Имя: ${briefData.contacts.name || 'Не указано'}
📞 Тел: ${briefData.contacts.phone}
${briefData.contacts.email ? `📧 Email: ${briefData.contacts.email}` : ''}

${leadId ? `🔗 <a href="https://${process.env.BITRIX24_DOMAIN}/crm/lead/details/${leadId}/">Лид в Битрикс24</a>` : ''}
  `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: alertChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });

    return true;
  } catch (error) {
    console.error('[Alert] Error sending notification:', error);
    return false;
  }
};

/**
 * Format brief data for Bitrix24 comments
 */
const formatBriefForComments = (briefData: BriefData, leadScore?: LeadScore): string => {
  return `
=== БРИФ ChatBot24 ===

Оценка лида: ${leadScore?.status || 'Не определена'} (${leadScore?.confidence ? Math.round(leadScore.confidence * 100) + '%' : 'N/A'})

СФЕРА БИЗНЕСА:
${briefData.businessType}

КАНАЛЫ СВЯЗИ:
${briefData.channels?.join(', ') || 'Не указаны'}

ОБЪЁМ ЗАЯВОК:
${briefData.dailyRequests} в день

ЗАДАЧИ БОТА:
${briefData.botTasks?.join(', ') || 'Не указаны'}

ПРИМЕРЫ ДЛЯ ВДОХНОВЕНИЯ:
${briefData.referenceBots || 'Не указаны'}

БЮДЖЕТ:
${briefData.budget}

КОНТАКТЫ:
Имя: ${briefData.contacts.name || 'Не указано'}
Телефон: ${briefData.contacts.phone}
${briefData.contacts.email ? `Email: ${briefData.contacts.email}` : ''}

=== КОНЕЦ БРИФА ===
  `.trim();
};

/**
 * Parse budget string to numeric value
 */
const parseBudgetToOpportunity = (budget: string): number | undefined => {
  const budgetMap: Record<string, number> = {
    'До 50 000 ₽': 49000,
    '50-100к': 75000,
    '100-200к': 150000,
    '200к+': 250000,
    'Обсудить с менеджером': 0
  };
  
  return budgetMap[budget] || 0;
};

/**
 * Score lead based on brief data
 */
export const scoreLeadFromBrief = (briefData: BriefData): LeadScore => {
  const justification: string[] = [];
  const redFlags: string[] = [];
  
  // Оценка по бюджету
  if (briefData.budget === 'До 50 000 ₽') {
    redFlags.push('Бюджет ниже минимальной стоимости (49 000 ₽)');
  } else if (briefData.budget === '200к+' || briefData.budget === '100-200к') {
    justification.push('Высокий бюджет — готовность инвестировать');
  }
  
  // Оценка по каналам
  if (briefData.channels && briefData.channels.length >= 3) {
    justification.push('Множественные каналы — высокая вовлечённость');
  }
  
  // Оценка по задачам
  if (briefData.botTasks?.includes('Интеграция CRM')) {
    justification.push('Нужна интеграция CRM — серьёзный проект');
  }
  
  // Оценка по объёму заявок
  if (briefData.dailyRequests === '100+') {
    justification.push('Высокий объём заявок — готовность к автоматизации');
  }

  // Оценка по примерам
  if (briefData.referenceBots && briefData.referenceBots !== 'Нет') {
    justification.push('Клиент понимает, что хочет — есть референсы');
  }
  
  // Определение итогового статуса
  let status: 'HOT' | 'WARM' | 'COLD' = 'WARM';
  let confidence = 0.6;
  
  if (justification.length >= 2 && redFlags.length === 0) {
    status = 'HOT';
    confidence = 0.85;
  } else if (redFlags.length > 0 && justification.length === 0) {
    status = 'COLD';
    confidence = 0.7;
  }
  
  return { 
    status, 
    confidence,
    justification: justification.join('; ') || 'Стандартный лид',
    redFlags: redFlags.length > 0 ? redFlags : undefined 
  };
};
