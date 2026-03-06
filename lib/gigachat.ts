/**
 * GigaChat API Client
 * Handles OAuth authentication and chat completions
 */

interface GigaChatToken {
  access_token: string;
  expires_at: number;
}

interface GigaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface GigaChatCompletionRequest {
  model: string;
  messages: GigaChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface GigaChatCompletionResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }[];
  created: number;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class GigaChatClient {
  private token: GigaChatToken | null = null;
  private apiKey: string;
  private scope: string;
  private authUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
  private baseUrl = 'https://gigachat.devices.sberbank.ru/api/v1';

  constructor() {
    this.apiKey = process.env.GIGACHAT_API_KEY || '';
    this.scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
    
    if (!this.apiKey) {
      console.warn('GIGACHAT_API_KEY not set');
    }
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.token && this.token.expires_at > Date.now()) {
      return this.token.access_token;
    }

    // Request new token
    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${this.apiKey}`,
        'RqUID': this.generateUUID(),
      },
      body: `scope=${encodeURIComponent(this.scope)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GigaChat auth error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Cache token with expiration (subtract 60 seconds for safety margin)
    this.token = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_at * 1000) - 60000,
    };

    return this.token.access_token;
  }

  /**
   * Generate UUID for RqUID header
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Create chat completion
   */
  async createCompletion(
    messages: GigaChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<GigaChatCompletionResponse> {
    const token = await this.getAccessToken();

    const requestBody: GigaChatCompletionRequest = {
      model: options.model || 'GigaChat',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1000,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GigaChat API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Check if client is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}

// Singleton instance
export const gigachat = new GigaChatClient();
export type { GigaChatMessage, GigaChatCompletionResponse };
