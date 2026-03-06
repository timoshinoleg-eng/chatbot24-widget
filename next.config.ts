import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export' убрано — оно мешает API routes в Next.js
  
  images: {
    unoptimized: true,
  },
  
  // Переменные окружения доступные на сервере
  env: {
    // AI API Keys (серверные только!)
    ZAI_API_KEY: process.env.ZAI_API_KEY || '',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    
    // Bitrix24 Integration
    BITRIX24_WEBHOOK_URL: process.env.BITRIX24_WEBHOOK_URL || '',
    BITRIX24_MANAGER_ID: process.env.BITRIX24_MANAGER_ID || '1',
    
    // Upstash Redis
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    
    // Site URL для OpenRouter Referer header
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://chatbot24-widget.vercel.app',
  },
  
  // CORS для embed.js и API
  async headers() {
    return [
      {
        source: '/embed.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS, HEAD' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
  
  // Настройки для Vercel
  poweredByHeader: false,
  generateEtags: false,
};

export default nextConfig;
