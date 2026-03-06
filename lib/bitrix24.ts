/**
 * Bitrix24 SDK
 * Integration with Bitrix24 CRM via Webhook API
 */

export interface LeadData {
  name: string;
  company: string;
  phone: string;
  email: string;
  budget: string;
  timeline: string;
  score: number;
  status: string;
  source?: string;
  comments?: string;
}

export interface ActivityData {
  leadId: number;
  subject: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description?: string;
}

export class Bitrix24Client {
  private webhookUrl: string;
  private managerId: string;

  constructor(webhookUrl?: string, managerId?: string) {
    this.webhookUrl = webhookUrl || process.env.BITRIX24_WEBHOOK_URL || '';
    this.managerId = managerId || process.env.BITRIX24_MANAGER_ID || '1';
  }

  async createLead(data: LeadData): Promise<{ success: boolean; leadId?: number; error?: string }> {
    if (!this.webhookUrl) {
      console.warn('Bitrix24 webhook URL not configured');
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.lead.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            TITLE: `Лид с сайта (Kimi Agent 2.5) — ${data.name}`,
            NAME: data.name,
            COMPANY_TITLE: data.company,
            PHONE: [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }],
            EMAIL: [{ VALUE: data.email, VALUE_TYPE: 'WORK' }],
            OPPORTUNITY: this.parseBudget(data.budget),
            CURRENCY_ID: 'RUB',
            SOURCE_ID: 'kimi_agent_2.5',
            SOURCE_DESCRIPTION: 'AI Chat Widget',
            ORIGIN_ID: 'kimi_agent_bot',
            COMMENTS: `Скоринг: ${data.score}/100, Статус: ${data.status}, Сроки: ${data.timeline}`,
            UF_CRM_SCORE: data.score.toString(),
            UF_CRM_STATUS: data.status,
            UF_CRM_TIMELINE: data.timeline,
          },
          params: { REGISTER_SONET_EVENT: 'Y' }
        })
      });

      const result = await response.json();
      
      if (result.error) {
        console.error('Bitrix24 API error:', result.error);
        return { success: false, error: result.error_description || result.error };
      }

      return { success: true, leadId: result.result };
    } catch (error) {
      console.error('Bitrix24 request failed:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async createActivity(data: ActivityData): Promise<{ success: boolean; error?: string }> {
    if (!this.webhookUrl) {
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.activity.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            OWNER_TYPE_ID: 'LEAD',
            OWNER_ID: data.leadId,
            TYPE_ID: 'TASK',
            SUBJECT: data.subject,
            PRIORITY: data.priority,
            DESCRIPTION: data.description || '',
            RESPONSIBLE_ID: this.managerId,
          }
        })
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

  async notifyManager(message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.webhookUrl) {
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/im.notify.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          USER_ID: this.managerId,
          MESSAGE: message,
          TYPE: 'SYSTEM'
        })
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

  async uploadFile(filename: string, content: Buffer): Promise<{ success: boolean; fileId?: number; error?: string }> {
    if (!this.webhookUrl) {
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      // Convert buffer to base64
      const base64Content = content.toString('base64');
      
      const response = await fetch(`${this.webhookUrl}/disk.storage.uploadfile.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'shared',
          data: {
            NAME: filename,
            FILE: [
              filename,
              base64Content
            ]
          }
        })
      });

      const result = await response.json();
      
      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true, fileId: result.result.ID };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  async getLeadList(filter?: Record<string, unknown>): Promise<{ success: boolean; leads?: unknown[]; error?: string }> {
    if (!this.webhookUrl) {
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.lead.list.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: filter || {},
          select: ['ID', 'TITLE', 'NAME', 'COMPANY_TITLE', 'OPPORTUNITY', 'DATE_CREATE', 'SOURCE_ID'],
          order: { DATE_CREATE: 'DESC' }
        })
      });

      const result = await response.json();
      
      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true, leads: result.result };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  private parseBudget(budget: string): number {
    // Extract numeric value from budget string
    const match = budget.match(/(\d+(?:\s*\d+)*)/);
    if (match) {
      // Remove spaces and convert to number
      const value = parseInt(match[1].replace(/\s/g, ''), 10);
      return value;
    }
    return 0;
  }
}

// Singleton instance
let bitrixClient: Bitrix24Client | null = null;

export function getBitrixClient(): Bitrix24Client {
  if (!bitrixClient) {
    bitrixClient = new Bitrix24Client();
  }
  return bitrixClient;
}
