import { NextRequest, NextResponse } from 'next/server';
import { gigachat } from '@/lib/gigachat';

export const dynamic = 'force-dynamic';

// Разрешённые origin для CORS
const ALLOWED_ORIGINS = [
  'https://chatbot24-widget.vercel.app',
  'https://www.chatbot24.su',
  'https://chatbot24.su',
  'http://localhost:3000',
];

// CORS headers helper
function setCorsHeaders(response: NextResponse, origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response, origin);
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  config: {
    gigachatConfigured: boolean;
    allowedOrigins: string[];
  };
  services: {
    gigachat: {
      status: string;
      latencyMs?: number;
      error?: string;
    };
  };
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'unknown',
    
    config: {
      gigachatConfigured: gigachat.isConfigured(),
      allowedOrigins: ALLOWED_ORIGINS,
    },
    
    services: {
      gigachat: {
        status: gigachat.isConfigured() ? 'configured' : 'not_configured',
      },
    },
  };

  // Проверяем GigaChat API если настроен
  if (gigachat.isConfigured()) {
    const startTime = Date.now();
    try {
      const testResponse = await gigachat.createCompletion(
        [{ role: 'user', content: 'hi' }],
        { max_tokens: 5 }
      );

      const latencyMs = Date.now() - startTime;
      
      if (testResponse.choices?.[0]?.message?.content) {
        health.services.gigachat = {
          status: 'connected',
          latencyMs,
        };
      } else {
        health.services.gigachat = {
          status: 'error',
          error: 'Empty response',
          latencyMs,
        };
        health.status = 'degraded';
      }
    } catch (e) {
      health.services.gigachat = {
        status: 'error',
        error: e instanceof Error ? e.message : 'Network error',
      };
      health.status = 'degraded';
    }
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  
  const response = NextResponse.json(health, { status: statusCode });
  return setCorsHeaders(response, origin);
}
