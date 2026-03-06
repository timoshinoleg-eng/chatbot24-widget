/**
 * Bitrix24 Extended Integration
 * Enhanced lead management with custom fields and automation
 */

import { LeadScore } from './scoring';

// ============================================
// Types
// ============================================

export interface ExtendedLeadData {
  // Standard fields
  name: string;
  company: string;
  phone: string;
  email: string;
  
  // Scoring data
  aiScore: LeadScore;
  conversationSummary?: string;
  
  // Source tracking
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  pageUrl?: string;
  
  // Estimated values
  estimatedValue?: number;
  estimatedTimeline?: string;
  
  // Next actions from AI
  nextAction?: string;
  nextActionTimeframe?: string;
  
  // Additional info
  comments?: string;
  projectType?: string;
}

export interface LeadStage {
  id: 'NEW' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'WON' | 'LOST';
  name: string;
}

export const LEAD_STAGES: Record<LeadStage['id'], string> = {
  NEW: 'Новый',
  QUALIFIED: 'Квалифицирован',
  PROPOSAL_SENT: 'КП отправлено',
  NEGOTIATION: 'Переговоры',
  WON: 'Успешно',
  LOST: 'Отказ',
};

// ============================================
// Extended Bitrix24 Client
// ============================================

export class Bitrix24ExtendedClient {
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
   * Create lead with extended fields
   */
  async createExtendedLead(data: ExtendedLeadData): Promise<{ 
    success: boolean; 
    leadId?: number; 
    error?: string;
    fields?: Record<string, unknown>;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    const fields = this.buildLeadFields(data);

    try {
      const response = await fetch(`${this.webhookUrl}/crm.lead.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          params: { REGISTER_SONET_EVENT: 'Y' }
        }),
      });

      const result = await response.json();

      if (result.error) {
        console.error('[Bitrix24 Extended] API error:', result.error);
        return { 
          success: false, 
          error: result.error_description || result.error,
          fields,
        };
      }

      return { 
        success: true, 
        leadId: result.result,
        fields,
      };
    } catch (error) {
      console.error('[Bitrix24 Extended] Request failed:', error);
      return { 
        success: false, 
        error: 'Network error',
        fields,
      };
    }
  }

  /**
   * Build lead fields for Bitrix24
   */
  private buildLeadFields(data: ExtendedLeadData): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      // Standard fields
      TITLE: `Лид из чат-бота — ${data.name}`,
      NAME: data.name,
      COMPANY_TITLE: data.company,
      PHONE: [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: data.email, VALUE_TYPE: 'WORK' }],
      
      // Source tracking
      SOURCE_ID: data.source || 'chatbot_widget',
      SOURCE_DESCRIPTION: data.conversationSummary?.substring(0, 255) || 'AI Chat Widget',
      
      // UTM fields
      UTM_SOURCE: data.utmSource,
      UTM_MEDIUM: data.utmMedium,
      UTM_CAMPAIGN: data.utmCampaign,
      
      // Opportunity
      OPPORTUNITY: data.estimatedValue || 0,
      CURRENCY_ID: 'RUB',
      
      // Comments
      COMMENTS: this.buildComments(data),
      
      // Stage
      STATUS_ID: 'NEW',
      
      // Assigned to
      ASSIGNED_BY_ID: this.managerId,
    };

    // Custom fields for AI scoring (UF_CRM_*)
    if (data.aiScore) {
      fields.UF_CRM_AI_SCORE_STATUS = data.aiScore.status;
      fields.UF_CRM_AI_SCORE_CONFIDENCE = data.aiScore.confidence.toFixed(2);
      fields.UF_CRM_AI_SCORE_JUSTIFICATION = data.aiScore.justification.substring(0, 255);
      fields.UF_CRM_AI_SCORE_DETAILS = JSON.stringify(data.aiScore).substring(0, 65000);
      fields.UF_CRM_CONVERSATION_SUMMARY = data.conversationSummary?.substring(0, 2000) || '';
      
      // Next action
      fields.UF_CRM_NEXT_ACTION_PRIORITY = data.aiScore.recommendedAction.priority.toString();
      fields.UF_CRM_NEXT_ACTION_TIMEFRAME = data.aiScore.recommendedAction.timeframe;
      fields.UF_CRM_NEXT_ACTION_CHANNEL = data.aiScore.recommendedAction.channel;
      fields.UF_CRM_NEXT_ACTION_ASSIGNED = data.aiScore.recommendedAction.assignedTo;
      
      // Estimated values
      if (data.aiScore.extractedData.budget?.value) {
        fields.UF_CRM_ESTIMATED_VALUE = data.aiScore.extractedData.budget.value.toString();
      }
      if (data.aiScore.extractedData.timeline) {
        fields.UF_CRM_ESTIMATED_TIMELINE = 
          `${data.aiScore.extractedData.timeline.minWeeks}-${data.aiScore.extractedData.timeline.maxWeeks} недель`;
      }
      
      // Project type
      fields.UF_CRM_PROJECT_TYPE = data.aiScore.extractedData.projectType;
      
      // Red flags
      if (data.aiScore.redFlags.length > 0) {
        fields.UF_CRM_RED_FLAGS = data.aiScore.redFlags.join('; ').substring(0, 255);
      }
    }

    // Extracted contacts from AI
    if (data.aiScore?.extractedData.contacts) {
      const contacts = data.aiScore.extractedData.contacts;
      if (contacts.phone && !fields.PHONE) {
        fields.PHONE = [{ VALUE: contacts.phone, VALUE_TYPE: 'WORK' }];
      }
      if (contacts.email && !fields.EMAIL) {
        fields.EMAIL = [{ VALUE: contacts.email, VALUE_TYPE: 'WORK' }];
      }
      if (contacts.name && !fields.NAME) {
        fields.NAME = contacts.name;
      }
      if (contacts.company && !fields.COMPANY_TITLE) {
        fields.COMPANY_TITLE = contacts.company;
      }
    }

    return fields;
  }

  /**
   * Build comments from lead data
   */
  private buildComments(data: ExtendedLeadData): string {
    const parts: string[] = [];

    if (data.aiScore) {
      parts.push(`AI Скоринг: ${data.aiScore.status} (уверенность: ${(data.aiScore.confidence * 100).toFixed(0)}%)`);
      parts.push(`Обоснование: ${data.aiScore.justification}`);
      
      if (data.aiScore.extractedData.budget) {
        const b = data.aiScore.extractedData.budget;
        parts.push(`Бюджет: ${b.value.toLocaleString('ru-RU')} ${b.currency}`);
      }
      
      if (data.aiScore.extractedData.timeline) {
        const t = data.aiScore.extractedData.timeline;
        parts.push(`Сроки: ${t.minWeeks}-${t.maxWeeks} недель, срочность: ${t.urgency}`);
      }
      
      parts.push(`Рекомендуемое действие: ${data.aiScore.recommendedAction.timeframe}, ${data.aiScore.recommendedAction.channel}`);
      
      if (data.aiScore.redFlags.length > 0) {
        parts.push(`⚠️ Риски: ${data.aiScore.redFlags.join(', ')}`);
      }
    }

    if (data.pageUrl) {
      parts.push(`Страница: ${data.pageUrl}`);
    }

    if (data.comments) {
      parts.push(`Дополнительно: ${data.comments}`);
    }

    return parts.join('\n');
  }

  /**
   * Update lead stage
   */
  async updateLeadStage(leadId: number, stage: LeadStage['id']): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.lead.update.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          fields: {
            STATUS_ID: stage,
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
   * Add comment to lead timeline
   */
  async addTimelineComment(leadId: number, comment: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.timeline.comment.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ENTITY_ID: leadId,
            ENTITY_TYPE: 'lead',
            COMMENT: comment,
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
   * Get lead details
   */
  async getLead(leadId: number): Promise<{ success: boolean; lead?: unknown; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.lead.get.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      });

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error_description };
      }

      return { success: true, lead: result.result };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Find lead by phone or email
   */
  async findLead(contact: { phone?: string; email?: string }): Promise<{ 
    success: boolean; 
    leads?: unknown[]; 
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Bitrix24 webhook not configured' };
    }

    const filter: Record<string, unknown> = {};
    
    if (contact.phone) {
      filter.PHONE = contact.phone;
    }
    if (contact.email) {
      filter.EMAIL = contact.email;
    }

    try {
      const response = await fetch(`${this.webhookUrl}/crm.lead.list.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter,
          select: ['ID', 'TITLE', 'NAME', 'PHONE', 'EMAIL', 'DATE_CREATE'],
        }),
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
}

// Singleton instance
let extendedClient: Bitrix24ExtendedClient | null = null;

export function getBitrix24ExtendedClient(): Bitrix24ExtendedClient {
  if (!extendedClient) {
    extendedClient = new Bitrix24ExtendedClient();
  }
  return extendedClient;
}
