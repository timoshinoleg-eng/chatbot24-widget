/**
 * Redis Client for Upstash
 * Used for conversation logging and lead tracking
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Check if Redis is configured
const isRedisConfigured = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

export interface ConversationLog {
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'guardrail_blocked';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface LeadLog {
  name: string;
  phone: string;
  email?: string;
  budget?: string;
  timeline?: string;
  businessType?: string;
  scoreCategory?: string;
  scoreValue?: number;
  bitrixLeadId?: number;
  pdfUrl?: string | null;
  timestamp: string;
  source?: string;
}

/**
 * Log a conversation message
 */
export async function logConversation(
  sessionId: string,
  role: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!isRedisConfigured()) {
    console.log('Redis not configured, skipping conversation log');
    return;
  }

  try {
    const key = `chat:${sessionId}:${Date.now()}`;
    const data: ConversationLog = {
      sessionId,
      role: role as any,
      message,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata }),
    };

    await redis.set(key, JSON.stringify(data), { ex: 60 * 60 * 24 * 30 }); // 30 days
  } catch (error) {
    console.error('Failed to log conversation:', error);
  }
}

/**
 * Log a lead
 */
export async function logLead(leadData: LeadLog): Promise<void> {
  if (!isRedisConfigured()) {
    console.log('Redis not configured, skipping lead log');
    return;
  }

  try {
    const key = `lead:${Date.now()}`;
    await redis.set(key, JSON.stringify(leadData), { ex: 60 * 60 * 24 * 365 }); // 1 year
  } catch (error) {
    console.error('Failed to log lead:', error);
  }
}

/**
 * Get all leads (for admin dashboard)
 */
export async function getStats(): Promise<LeadLog[]> {
  if (!isRedisConfigured()) {
    console.log('Redis not configured, returning empty stats');
    return [];
  }

  try {
    const keys = await redis.keys('lead:*');
    if (!keys || keys.length === 0) {
      return [];
    }

    const leads = await Promise.all(
      keys.map(async (key) => {
        const data = await redis.get(key);
        return data as LeadLog;
      })
    );

    return leads.filter(Boolean) as LeadLog[];
  } catch (error) {
    console.error('Failed to get stats:', error);
    return [];
  }
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(sessionId: string): Promise<ConversationLog[]> {
  if (!isRedisConfigured()) {
    return [];
  }

  try {
    const keys = await redis.keys(`chat:${sessionId}:*`);
    if (!keys || keys.length === 0) {
      return [];
    }

    const messages = await Promise.all(
      keys.map(async (key) => {
        const data = await redis.get(key);
        return data as ConversationLog;
      })
    );

    return (messages.filter(Boolean) as ConversationLog[]).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (error) {
    console.error('Failed to get conversation history:', error);
    return [];
  }
}

/**
 * Get recent conversations count
 */
export async function getRecentConversationsCount(hours: number = 24): Promise<number> {
  if (!isRedisConfigured()) {
    return 0;
  }

  try {
    const keys = await redis.keys('chat:*');
    if (!keys || keys.length === 0) {
      return 0;
    }

    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    let count = 0;

    for (const key of keys) {
      const data = await redis.get(key) as ConversationLog | null;
      if (data && new Date(data.timestamp).getTime() > cutoffTime) {
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error('Failed to get recent conversations count:', error);
    return 0;
  }
}

export { redis };
