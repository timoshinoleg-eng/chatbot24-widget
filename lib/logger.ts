/**
 * Structured Logging Module
 * JSON-formatted logs for observability and debugging
 */

// ============================================
// Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  step: string;
  requestId: string;
  level: LogLevel;
  data?: Record<string, unknown>;
  duration?: number;
}

export interface RequestContext {
  requestId: string;
  startTime: number;
  steps: LogEntry[];
}

// ============================================
// Configuration
// ============================================

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const ENABLE_STRUCTURED_LOGS = process.env.ENABLE_STRUCTURED_LOGS !== 'false';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[LOG_LEVEL];
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Skip sensitive fields
    if (key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('api_key') ||
        key.toLowerCase().includes('webhook')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ============================================
// Logging Functions
// ============================================

/**
 * Create a log entry
 */
export function log(
  level: LogLevel,
  step: string,
  requestId: string,
  data?: Record<string, unknown>
): LogEntry {
  if (!shouldLog(level)) {
    return {
      timestamp: new Date().toISOString(),
      step,
      requestId,
      level,
      data,
    };
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    step,
    requestId,
    level,
    data: data ? sanitizeData(data) : undefined,
  };

  if (ENABLE_STRUCTURED_LOGS) {
    // Structured JSON output
    console.log(JSON.stringify(entry));
  } else {
    // Human-readable format
    const dataStr = data ? ` | ${JSON.stringify(entry.data)}` : '';
    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] [${requestId}] ${step}${dataStr}`);
  }

  return entry;
}

/**
 * Log a step in request processing
 */
export function logStep(
  context: RequestContext,
  step: string,
  data?: Record<string, unknown>,
  level: LogLevel = 'info'
): LogEntry {
  const entry = log(level, step, context.requestId, data);
  context.steps.push(entry);
  return entry;
}

/**
 * Create a new request context
 */
export function createRequestContext(requestId: string): RequestContext {
  return {
    requestId,
    startTime: Date.now(),
    steps: [],
  };
}

/**
 * Log request completion
 */
export function logRequestComplete(
  context: RequestContext,
  data?: Record<string, unknown>
): LogEntry {
  const duration = Date.now() - context.startTime;
  return logStep(context, 'request_complete', {
    duration,
    stepCount: context.steps.length,
    ...data,
  });
}

/**
 * Log error
 */
export function logError(
  context: RequestContext,
  step: string,
  error: Error | string,
  data?: Record<string, unknown>
): LogEntry {
  const errorData: Record<string, unknown> = {
    error: typeof error === 'string' ? error : error.message,
    errorType: typeof error === 'string' ? 'string' : error.constructor.name,
    ...data,
  };

  if (error instanceof Error && error.stack) {
    errorData.stack = error.stack.split('\n').slice(0, 5).join('\n');
  }

  return logStep(context, step, errorData, 'error');
}

// ============================================
// Convenience Functions
// ============================================

export function debug(step: string, requestId: string, data?: Record<string, unknown>): LogEntry {
  return log('debug', step, requestId, data);
}

export function info(step: string, requestId: string, data?: Record<string, unknown>): LogEntry {
  return log('info', step, requestId, data);
}

export function warn(step: string, requestId: string, data?: Record<string, unknown>): LogEntry {
  return log('warn', step, requestId, data);
}

export function error(step: string, requestId: string, data?: Record<string, unknown>): LogEntry {
  return log('error', step, requestId, data);
}

// ============================================
// Key Logging Points
// ============================================

export const LOGGING_POINTS = {
  // Request lifecycle
  REQUEST_START: 'request_start',
  REQUEST_COMPLETE: 'request_complete',
  REQUEST_ERROR: 'request_error',

  // Environment
  ENV_CHECK: 'env_check',
  CONFIG_LOADED: 'config_loaded',

  // Input processing
  INPUT_PARSED: 'input_parsed',
  INPUT_BLOCKED: 'input_blocked',
  INPUT_VALIDATED: 'input_validated',

  // RAG
  RAG_START: 'rag_start',
  RAG_COMPLETE: 'rag_complete',
  RAG_FALLBACK: 'rag_fallback',

  // AI providers
  AI_PROVIDER_SELECTION: 'ai_provider_selection',
  AI_REQUEST_START: 'ai_request_start',
  AI_RESPONSE_COMPLETE: 'ai_response_complete',
  AI_ERROR: 'ai_error',
  AI_FALLBACK_TRIGGERED: 'ai_fallback_triggered',

  // Scoring
  SCORING_START: 'scoring_start',
  SCORING_RESULT: 'scoring_result',

  // Bitrix24
  BITRIX24_SYNC_START: 'bitrix24_sync_start',
  BITRIX24_SYNC_COMPLETE: 'bitrix24_sync_complete',
  BITRIX24_ERROR: 'bitrix24_error',

  // Personalization
  TONE_DETECTED: 'tone_detected',
  CONTEXT_RESTORED: 'context_restored',
} as const;

// ============================================
// Logger Class (for advanced use cases)
// ============================================

export class Logger {
  private requestId: string;
  private context: Record<string, unknown>;
  private steps: LogEntry[];

  constructor(requestId: string, context: Record<string, unknown> = {}) {
    this.requestId = requestId;
    this.context = context;
    this.steps = [];
  }

  log(level: LogLevel, step: string, data?: Record<string, unknown>): LogEntry {
    const mergedData = { ...this.context, ...data };
    const entry = log(level, step, this.requestId, mergedData);
    this.steps.push(entry);
    return entry;
  }

  debug(step: string, data?: Record<string, unknown>): LogEntry {
    return this.log('debug', step, data);
  }

  info(step: string, data?: Record<string, unknown>): LogEntry {
    return this.log('info', step, data);
  }

  warn(step: string, data?: Record<string, unknown>): LogEntry {
    return this.log('warn', step, data);
  }

  error(step: string, data?: Record<string, unknown>): LogEntry {
    return this.log('error', step, data);
  }

  getSteps(): LogEntry[] {
    return this.steps;
  }

  toJSON(): Record<string, unknown> {
    return {
      requestId: this.requestId,
      context: this.context,
      steps: this.steps,
    };
  }
}

export default {
  log,
  logStep,
  logRequestComplete,
  logError,
  debug,
  info,
  warn,
  error,
  createRequestContext,
  LOGGING_POINTS,
};
