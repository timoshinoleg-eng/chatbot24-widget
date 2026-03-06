/**
 * Safety Guardrails
 * Blocks forbidden requests and prevents abuse
 */

export interface SafetyCheck {
  isSafe: boolean;
  reason?: string;
  blocked: boolean;
}

const FORBIDDEN_PATTERNS = [
  /\b(пароль|password|секрет|secret)\b/i,
  /\b(взлом|hack|exploit|attack|взломать|ломать)\b/i,
  /\b(спам|spam|рассылка|bulk|насрать)\b/i,
  /\b(вирус|virus|malware|троян|trojan)\b/i,
  /\b(кредитная карта|credit card|cvv|cvc)\b/i,
  /\b(паспорт|passport|инн|снилс)\b/i,
  /\b( ddos |ддос|phishing|фишинг)\b/i,
  /\b(скидка 100%|бесплатно навсегда|развод|обман)\b/i,
];

const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_PER_MINUTE = 60;

// In-memory rate limiting store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkInputSafety(input: string, userId?: string): SafetyCheck {
  // Check message length
  if (input.length > MAX_MESSAGE_LENGTH) {
    return { 
      isSafe: false, 
      reason: 'Сообщение слишком длинное (максимум 5000 символов)', 
      blocked: true 
    };
  }

  // Check rate limiting
  if (userId) {
    const now = Date.now();
    const userLimit = rateLimitStore.get(userId);
    
    if (userLimit) {
      if (now > userLimit.resetTime) {
        rateLimitStore.set(userId, { count: 1, resetTime: now + 60000 });
      } else if (userLimit.count >= RATE_LIMIT_PER_MINUTE) {
        return { 
          isSafe: false, 
          reason: 'Превышен лимит сообщений. Попробуйте через минуту.', 
          blocked: true 
        };
      } else {
        userLimit.count++;
      }
    } else {
      rateLimitStore.set(userId, { count: 1, resetTime: now + 60000 });
    }
  }

  // Check forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(input)) {
      return { 
        isSafe: false, 
        reason: 'Запрещённый контент обнаружен. Пожалуйста, соблюдайте правила общения.', 
        blocked: true 
      };
    }
  }

  return { isSafe: true, blocked: false };
}

export function checkOutputSafety(output: string): SafetyCheck {
  // Check for API key leaks
  if (output.includes('sk-') || output.toLowerCase().includes('api_key')) {
    return { 
      isSafe: false, 
      reason: 'Попытка раскрытия ключей', 
      blocked: true 
    };
  }

  // Check for internal system prompts
  if (output.includes('system prompt') || output.includes('instruction:')) {
    return { 
      isSafe: false, 
      reason: 'Раскрытие системных инструкций', 
      blocked: true 
    };
  }

  return { isSafe: true, blocked: false };
}

export function sanitizeInput(input: string): string {
  // Remove potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}
