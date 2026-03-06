/**
 * Bitrix24 Triggers Module
 * Automated communications and trigger-based actions
 */

import { LeadScore } from './scoring';

// ============================================
// Types
// ============================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  fromName?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  text: string;
}

export interface TriggerConfig {
  id: string;
  name: string;
  condition: string;
  action: 'send_email' | 'send_sms' | 'notify_manager' | 'create_task';
  templateId?: string;
  delayMinutes?: number;
}

// ============================================
// Email Templates
// ============================================

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  WELCOME_NEW_LEAD: {
    id: 'welcome_new_lead',
    name: 'Приветствие нового лида',
    subject: 'Спасибо за обращение в Chatbot24!',
    body: `Здравствуйте, {{name}}!

Спасибо за интерес к нашим услугам. Мы получили вашу заявку на {{serviceType}}.

Что будет дальше:
1. Наш менеджер свяжется с вами в течение {{responseTime}}
2. Мы уточним детали проекта
3. Подготовим индивидуальное коммерческое предложение

Пока вы ждёте, можете ознакомиться с нашим портфолио: {{portfolioUrl}}

Если у вас есть срочные вопросы, звоните: +7 (XXX) XXX-XX-XX

С уважением,
Команда Chatbot24
{{siteUrl}}`,
    fromName: 'Chatbot24',
  },
  PROPOSAL_FOLLOW_UP: {
    id: 'proposal_follow_up',
    name: 'Напоминание о КП',
    subject: 'Есть ли вопросы по коммерческому предложению?',
    body: `Здравствуйте, {{name}}!

Недавно мы отправили вам коммерческое предложение на {{serviceType}}.

Хотели бы узнать:
• Получили ли вы наше письмо?
• Есть ли вопросы по составу работ?
• Нужна ли помощь в принятии решения?

Мы готовы обсудить детали по телефону или встретиться лично.

С уважением,
{{managerName}}
Chatbot24
Тел: {{managerPhone}}`,
    fromName: 'Chatbot24',
  },
  PROJECT_COMPLETE: {
    id: 'project_complete',
    name: 'Завершение проекта',
    subject: 'Ваш проект готов! 🎉',
    body: `Здравствуйте, {{name}}!

Рады сообщить, что проект "{{projectName}}" успешно завершён!

Что дальше:
• Все доступы и документация отправлены на ваш email
• Гарантийная поддержка 12 месяцев активирована
• Вы можете обращаться к нам по любым вопросам

Будем благодарны за отзыв о нашей работе: {{reviewUrl}}

Спасибо за доверие!

С уважением,
Команда Chatbot24`,
    fromName: 'Chatbot24',
  },
};

// ============================================
// SMS Templates
// ============================================

export const SMS_TEMPLATES: Record<string, SMSTemplate> = {
  WELCOME_SMS: {
    id: 'welcome_sms',
    name: 'Приветственное SMS',
    text: '{{name}}, спасибо за обращение в Chatbot24! Менеджер свяжется с вами в течение {{responseTime}}. {{siteUrl}}',
  },
  CALL_REMINDER: {
    id: 'call_reminder',
    name: 'Напоминание о звонке',
    text: '{{name}}, напоминаем о запланированном звонке сегодня в {{callTime}}. Если время не подходит — позвоните нам: {{managerPhone}}',
  },
  HOT_LEAD_SMS: {
    id: 'hot_lead_sms',
    name: 'SMS для HOT-лида',
    text: '{{name}}, получили вашу заявку на {{serviceType}}. Готовы обсудить детали прямо сейчас! Перезвоните: {{managerPhone}}',
  },
};

// ============================================
// Trigger Configurations
// ============================================

export const TRIGGER_CONFIGS: TriggerConfig[] = [
  {
    id: 'hot_lead_notify',
    name: 'Уведомление о HOT-лиде',
    condition: 'lead.score.status === "HOT"',
    action: 'notify_manager',
    delayMinutes: 0,
  },
  {
    id: 'welcome_email',
    name: 'Приветственное письмо',
    condition: 'lead.created',
    action: 'send_email',
    templateId: 'WELCOME_NEW_LEAD',
    delayMinutes: 5,
  },
  {
    id: 'proposal_follow_up',
    name: 'Напоминание о КП',
    condition: 'proposal.sent && daysSince(3) && !client.response',
    action: 'send_email',
    templateId: 'PROPOSAL_FOLLOW_UP',
    delayMinutes: 0,
  },
];

// ============================================
// Bitrix24 Triggers Client
// ============================================

export class Bitrix24TriggersClient {
  private webhookUrl: string;
  private managerId: string;

  constructor(webhookUrl?: string, managerId?: string) {
    this.webhookUrl = webhookUrl || process.env.BITRIX24_WEBHOOK_URL || '';
    this.managerId = managerId || process.env.BITRIX24_MANAGER_ID || '1';
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return !!this.webhookUrl && this.webhookUrl.includes('bitrix24');
  }

  /**
   * Send email to lead
   */
  async sendEmail(
    leadId: number,
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    const template = EMAIL_TEMPLATES[templateId];
    if (!template) {
      return { success: false, error: `Template ${templateId} not found` };
    }

    // Replace variables
    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    }

    try {
      // Create email activity
      const response = await fetch(`${this.webhookUrl}/crm.activity.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            OWNER_TYPE_ID: 'LEAD',
            OWNER_ID: leadId,
            TYPE_ID: 'EMAIL',
            SUBJECT: subject,
            DESCRIPTION: body,
            DESCRIPTION_TYPE: 'html',
            DIRECTION: '2', // Outgoing
            RESPONSIBLE_ID: this.managerId,
          },
        }),
      });

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Send SMS to lead
   * Note: Requires SMS provider integration in Bitrix24
   */
  async sendSMS(
    leadId: number,
    templateId: string,
    variables: Record<string, string>,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    const template = SMS_TEMPLATES[templateId];
    if (!template) {
      return { success: false, error: `Template ${templateId} not found` };
    }

    // Replace variables
    let text = template.text;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      text = text.replace(new RegExp(placeholder, 'g'), value);
    }

    try {
      // Create SMS activity
      const response = await fetch(`${this.webhookUrl}/crm.activity.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            OWNER_TYPE_ID: 'LEAD',
            OWNER_ID: leadId,
            TYPE_ID: 'SMS',
            SUBJECT: 'SMS сообщение',
            DESCRIPTION: text,
            DESCRIPTION_TYPE: 'plain',
            DIRECTION: '2', // Outgoing
            RESPONSIBLE_ID: this.managerId,
            // Note: Actual SMS sending requires provider setup
            SETTINGS: {
              PHONE: phone,
            },
          },
        }),
      });

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Notify manager
   */
  async notifyManager(message: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/im.notify.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          USER_ID: userId || this.managerId,
          MESSAGE: message,
          TYPE: 'SYSTEM',
        }),
      });

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Send HOT lead notification
   */
  async sendHotLeadNotification(
    leadId: number,
    leadName: string,
    score: LeadScore
  ): Promise<{ success: boolean; error?: string }> {
    const leadUrl = `${this.getPortalUrl()}/crm/lead/details/${leadId}/`;
    
    const message = `🔥 *HOT ЛИД ТРЕБУЕТ ВНИМАНИЯ!*

Клиент: ${leadName}
Статус: ${score.status}
Уверенность: ${(score.confidence * 100).toFixed(0)}%

Обоснование: ${score.justification}

Рекомендуемое действие: ${score.recommendedAction.timeframe}, ${score.recommendedAction.channel}

[Открыть лид](${leadUrl})`;

    return this.notifyManager(message);
  }

  /**
   * Send welcome email to new lead
   */
  async sendWelcomeEmail(
    leadId: number,
    leadData: {
      name: string;
      serviceType?: string;
      email: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendEmail(leadId, 'WELCOME_NEW_LEAD', {
      name: leadData.name,
      serviceType: leadData.serviceType || 'разработку',
      responseTime: '2 часов',
      portfolioUrl: 'https://chatbot24.su/portfolio',
      siteUrl: 'https://chatbot24.su',
    });
  }

  /**
   * Send proposal follow-up
   */
  async sendProposalFollowUp(
    leadId: number,
    leadData: {
      name: string;
      serviceType?: string;
    },
    managerData: {
      name: string;
      phone: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendEmail(leadId, 'PROPOSAL_FOLLOW_UP', {
      name: leadData.name,
      serviceType: leadData.serviceType || 'разработку',
      managerName: managerData.name,
      managerPhone: managerData.phone,
    });
  }

  /**
   * Send welcome SMS
   */
  async sendWelcomeSMS(
    leadId: number,
    leadData: {
      name: string;
      phone: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendSMS(leadId, 'WELCOME_SMS', {
      name: leadData.name,
      responseTime: '2 часов',
      siteUrl: 'chatbot24.su',
    }, leadData.phone);
  }

  /**
   * Send HOT lead SMS
   */
  async sendHotLeadSMS(
    leadId: number,
    leadData: {
      name: string;
      phone: string;
      serviceType?: string;
    },
    managerPhone: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendSMS(leadId, 'HOT_LEAD_SMS', {
      name: leadData.name,
      serviceType: leadData.serviceType || 'разработку',
      managerPhone,
    }, leadData.phone);
  }

  /**
   * Check and execute triggers for lead
   */
  async checkTriggers(
    leadId: number,
    leadData: {
      name: string;
      score: LeadScore;
      email?: string;
      phone?: string;
    }
  ): Promise<{ executed: string[]; errors: string[] }> {
    const executed: string[] = [];
    const errors: string[] = [];

    // HOT lead trigger
    if (leadData.score.status === 'HOT') {
      const notifyResult = await this.sendHotLeadNotification(leadId, leadData.name, leadData.score);
      if (notifyResult.success) {
        executed.push('hot_lead_notify');
      } else {
        errors.push(`hot_lead_notify: ${notifyResult.error}`);
      }

      // Send HOT lead SMS if phone available
      if (leadData.phone) {
        const smsResult = await this.sendHotLeadSMS(leadId, {
          name: leadData.name,
          phone: leadData.phone,
          serviceType: leadData.score.extractedData.projectType,
        }, '+7 (XXX) XXX-XX-XX');
        
        if (smsResult.success) {
          executed.push('hot_lead_sms');
        }
      }
    }

    // Welcome email for new leads
    if (leadData.email) {
      const emailResult = await this.sendWelcomeEmail(leadId, {
        name: leadData.name,
        serviceType: leadData.score.extractedData.projectType,
        email: leadData.email,
      });
      
      if (emailResult.success) {
        executed.push('welcome_email');
      }
    }

    return { executed, errors };
  }

  /**
   * Helper: Extract portal URL from webhook
   */
  private getPortalUrl(): string {
    const match = this.webhookUrl.match(/(https?:\/\/[^/]+)/);
    return match ? match[1] : '';
  }
}

// Singleton instance
let triggersClient: Bitrix24TriggersClient | null = null;

export function getBitrix24TriggersClient(): Bitrix24TriggersClient {
  if (!triggersClient) {
    triggersClient = new Bitrix24TriggersClient();
  }
  return triggersClient;
}
