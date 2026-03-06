/**
 * Bitrix24 Tasks Module
 * Automated task creation and management for leads
 */

import { LeadScore } from './scoring';

// ============================================
// Types
// ============================================

export interface TaskData {
  title: string;
  description?: string;
  responsibleId?: string;
  deadline?: string; // ISO 8601
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  leadId?: number;
  contactId?: number;
}

export interface TaskResult {
  success: boolean;
  taskId?: number;
  error?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: TaskData['priority'];
  defaultDeadlineHours: number;
}

// ============================================
// Task Templates
// ============================================

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  HOT_LEAD_NO_RESPONSE: {
    id: 'hot_lead_no_response',
    name: 'HOT-лид без обработки',
    title: '🔥 СРОЧНО: HOT-лид без обработки — {{leadName}}',
    description: `HOT-лид ожидает обработки более 2 часов.

AI-скоринг: {{scoreStatus}} ({{scoreConfidence}}%)
Обоснование: {{scoreJustification}}

Контакты:
- Телефон: {{phone}}
- Email: {{email}}

Рекомендуемое действие: {{recommendedAction}}

Ссылка на лид: {{leadUrl}}`,
    priority: 'HIGH',
    defaultDeadlineHours: 2,
  },
  OVERDUE_PROPOSAL: {
    id: 'overdue_proposal',
    name: 'Просроченное КП',
    title: '⏰ Напоминание: КП отправлено 3 дня назад — {{leadName}}',
    description: `Клиенту отправлено коммерческое предложение 3 дня назад, ответа нет.

Необходимо:
1. Позвонить клиенту
2. Уточнить статус рассмотрения
3. Ответить на возникшие вопросы

Ссылка на лид: {{leadUrl}}`,
    priority: 'MEDIUM',
    defaultDeadlineHours: 24,
  },
  INCOMPLETE_FORM: {
    id: 'incomplete_form',
    name: 'Незавершённая форма',
    title: '📝 Дозвониться — незавершённая заявка — {{leadName}}',
    description: `Клиент начал заполнять форму 30+ минут назад, но не завершил.

Возможные причины:
- Отвлеклись
- Возникли вопросы
- Технические проблемы

Контакты:
- Телефон: {{phone}}
- Email: {{email}}

Ссылка на лид: {{leadUrl}}`,
    priority: 'MEDIUM',
    defaultDeadlineHours: 4,
  },
  NEGATIVE_SENTIMENT: {
    id: 'negative_sentiment',
    name: 'Негативный сентимент',
    title: '⚠️ Обработать негатив — {{leadName}}',
    description: `Клиент выразил негативное отношение в чате.

Сентимент-анализ: {{sentimentScore}}
История сообщений: {{chatHistory}}

Необходимо оперативно связаться и разрешить ситуацию.

Ссылка на лид: {{leadUrl}}`,
    priority: 'HIGH',
    defaultDeadlineHours: 1,
  },
  FOLLOW_UP_CALL: {
    id: 'follow_up_call',
    name: 'Плановый звонок',
    title: '📞 Плановый звонок — {{leadName}}',
    description: `Запланированный звонок по лиду.

Тема: {{topic}}
Предыдущий контакт: {{lastContact}}

Ссылка на лид: {{leadUrl}}`,
    priority: 'LOW',
    defaultDeadlineHours: 24,
  },
};

// ============================================
// Bitrix24 Tasks Client
// ============================================

export class Bitrix24TasksClient {
  private webhookUrl: string;
  private defaultResponsibleId: string;

  constructor(webhookUrl?: string, defaultResponsibleId?: string) {
    this.webhookUrl = webhookUrl || process.env.BITRIX24_WEBHOOK_URL || '';
    this.defaultResponsibleId = defaultResponsibleId || process.env.BITRIX24_MANAGER_ID || '1';
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return !!this.webhookUrl && this.webhookUrl.includes('bitrix24');
  }

  /**
   * Create a task
   */
  async createTask(data: TaskData): Promise<TaskResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    const deadline = data.deadline || this.getDefaultDeadline(24);

    try {
      const response = await fetch(`${this.webhookUrl}/tasks.task.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            TITLE: data.title,
            DESCRIPTION: data.description || '',
            RESPONSIBLE_ID: data.responsibleId || this.defaultResponsibleId,
            DEADLINE: deadline,
            PRIORITY: data.priority || 'MEDIUM',
            UF_CRM_TASK: data.leadId ? [`L_${data.leadId}`] : undefined,
          },
        }),
      });

      const result = await response.json();

      if (result.error) {
        console.error('[Bitrix24 Tasks] API error:', result.error);
        return { success: false, error: result.error_description || result.error };
      }

      return { success: true, taskId: result.result.task?.id };
    } catch (error) {
      console.error('[Bitrix24 Tasks] Request failed:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Create task from template
   */
  async createTaskFromTemplate(
    templateId: string,
    variables: Record<string, string>,
    overrides?: Partial<TaskData>
  ): Promise<TaskResult> {
    const template = TASK_TEMPLATES[templateId];
    if (!template) {
      return { success: false, error: `Template ${templateId} not found` };
    }

    // Replace variables in template
    let title = template.title;
    let description = template.description;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), value);
      description = description.replace(new RegExp(placeholder, 'g'), value);
    }

    const deadline = this.getDefaultDeadline(template.defaultDeadlineHours);

    return this.createTask({
      title,
      description,
      priority: template.priority,
      deadline,
      ...overrides,
    });
  }

  /**
   * Create HOT lead task
   */
  async createHotLeadTask(
    leadId: number,
    leadName: string,
    score: LeadScore,
    contacts: { phone?: string; email?: string }
  ): Promise<TaskResult> {
    const leadUrl = `${this.getPortalUrl()}/crm/lead/details/${leadId}/`;

    return this.createTaskFromTemplate('HOT_LEAD_NO_RESPONSE', {
      leadId: leadId.toString(),
      leadName,
      scoreStatus: score.status,
      scoreConfidence: (score.confidence * 100).toFixed(0),
      scoreJustification: score.justification,
      phone: contacts.phone || 'не указан',
      email: contacts.email || 'не указан',
      recommendedAction: `${score.recommendedAction.timeframe}, ${score.recommendedAction.channel}`,
      leadUrl,
    }, {
      leadId,
      priority: 'HIGH',
    });
  }

  /**
   * Create overdue proposal task
   */
  async createOverdueProposalTask(
    leadId: number,
    leadName: string
  ): Promise<TaskResult> {
    const leadUrl = `${this.getPortalUrl()}/crm/lead/details/${leadId}/`;

    return this.createTaskFromTemplate('OVERDUE_PROPOSAL', {
      leadId: leadId.toString(),
      leadName,
      leadUrl,
    }, {
      leadId,
      priority: 'MEDIUM',
    });
  }

  /**
   * Create incomplete form task
   */
  async createIncompleteFormTask(
    leadId: number,
    leadName: string,
    contacts: { phone?: string; email?: string }
  ): Promise<TaskResult> {
    const leadUrl = `${this.getPortalUrl()}/crm/lead/details/${leadId}/`;

    return this.createTaskFromTemplate('INCOMPLETE_FORM', {
      leadId: leadId.toString(),
      leadName,
      phone: contacts.phone || 'не указан',
      email: contacts.email || 'не указан',
      leadUrl,
    }, {
      leadId,
      priority: 'MEDIUM',
    });
  }

  /**
   * Create negative sentiment task
   */
  async createNegativeSentimentTask(
    leadId: number,
    leadName: string,
    sentimentScore: number,
    chatHistory: string
  ): Promise<TaskResult> {
    const leadUrl = `${this.getPortalUrl()}/crm/lead/details/${leadId}/`;

    return this.createTaskFromTemplate('NEGATIVE_SENTIMENT', {
      leadId: leadId.toString(),
      leadName,
      sentimentScore: sentimentScore.toFixed(2),
      chatHistory: chatHistory.substring(0, 500),
      leadUrl,
    }, {
      leadId,
      priority: 'HIGH',
    });
  }

  /**
   * Link task to lead
   */
  async linkTaskToLead(taskId: number, leadId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/tasks.task.update.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          fields: {
            UF_CRM_TASK: [`L_${leadId}`],
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
   * Set task deadline
   */
  async setTaskDeadline(taskId: number, deadline: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/tasks.task.update.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          fields: {
            DEADLINE: deadline,
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
   * Complete task
   */
  async completeTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/tasks.task.complete.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
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
   * Get task list
   */
  async getTaskList(filter?: Record<string, unknown>): Promise<{ 
    success: boolean; 
    tasks?: unknown[]; 
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/tasks.task.list.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: filter || {},
          select: ['ID', 'TITLE', 'STATUS', 'DEADLINE', 'PRIORITY', 'RESPONSIBLE_ID'],
        }),
      });

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true, tasks: result.result.tasks || [] };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Helper: Get default deadline
   */
  private getDefaultDeadline(hoursFromNow: number): string {
    const date = new Date();
    date.setHours(date.getHours() + hoursFromNow);
    return date.toISOString();
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
let tasksClient: Bitrix24TasksClient | null = null;

export function getBitrix24TasksClient(): Bitrix24TasksClient {
  if (!tasksClient) {
    tasksClient = new Bitrix24TasksClient();
  }
  return tasksClient;
}
