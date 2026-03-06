/**
 * Proposal Generator Module
 * AI-powered commercial proposal generation
 */

import { zai } from './zai';
import { PROPOSAL_PROMPT } from './prompts';

// ============================================
// Types
// ============================================

export interface ProposalStage {
  name: string;
  duration: string;
  deliverables: string[];
  result: string;
}

export interface ProposalData {
  proposalNumber: string;
  currentDate: string;
  clientName: string;
  clientContact: string;
  projectContext: string;
  stages: ProposalStage[];
  totalDuration: string;
  totalCost: number;
  prepaymentPercent: number;
  includedItems: string[];
  excludedItems: string[];
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  validUntil: string;
}

export interface GeneratedProposal {
  markdown: string;
  html: string;
  data: ProposalData;
}

// ============================================
// Pipeline
// ============================================

/**
 * Generate proposal number
 */
function generateProposalNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `КП-${year}-${month}-${random}`;
}

/**
 * Calculate valid until date
 */
function calculateValidUntil(days: number = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('ru-RU');
}

/**
 * Extract project info from conversation
 */
function extractProjectInfo(messages: Array<{ role: string; content: string }>): {
  type: string;
  requirements: string[];
  budget?: number;
  timeline?: string;
} {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase());

  const allText = userMessages.join(' ');

  // Detect project type
  let type = 'Веб-разработка';
  if (allText.includes('бот') || allText.includes('чат-бот')) {
    type = 'Чат-бот';
  } else if (allText.includes('приложение') || allText.includes('app') || allText.includes('ios') || allText.includes('android')) {
    type = 'Мобильное приложение';
  } else if (allText.includes('сайт') || allText.includes('лендинг') || allText.includes('корпсайт')) {
    type = 'Сайт';
  }

  // Extract requirements
  const requirements: string[] = [];
  const requirementPatterns = [
    /нужно\s+(.+?)(?:\.|,|;|$)/i,
    /требуется\s+(.+?)(?:\.|,|;|$)/i,
    /хотим\s+(.+?)(?:\.|,|;|$)/i,
    /необходимо\s+(.+?)(?:\.|,|;|$)/i,
  ];

  for (const msg of userMessages) {
    for (const pattern of requirementPatterns) {
      const match = msg.match(pattern);
      if (match) {
        requirements.push(match[1].trim());
      }
    }
  }

  if (requirements.length === 0) {
    requirements.push('Разработка с нуля', 'Индивидуальный дизайн', 'Базовая SEO-оптимизация');
  }

  // Extract budget hint
  let budget: number | undefined;
  const budgetMatch = allText.match(/(\d[\d\s]*000)/);
  if (budgetMatch) {
    budget = parseInt(budgetMatch[1].replace(/\s/g, ''), 10);
  }

  // Extract timeline
  let timeline: string | undefined;
  const timelinePatterns = [
    /(\d+)\s*недел/i,
    /(\d+)\s*месяц/i,
    /к\s+(.+?)(?:\.|,|;|$)/i,
  ];
  for (const pattern of timelinePatterns) {
    const match = allText.match(pattern);
    if (match) {
      timeline = match[0];
      break;
    }
  }

  return { type, requirements, budget, timeline };
}

/**
 * Generate default stages based on project type
 */
function generateStages(projectType: string): ProposalStage[] {
  const defaultStages: ProposalStage[] = [
    {
      name: 'Анализ и проектирование',
      duration: '3-5 дней',
      deliverables: ['Техническое задание', 'Прототип интерфейса'],
      result: 'Утверждённое ТЗ и структура проекта',
    },
    {
      name: 'Дизайн',
      duration: '5-10 дней',
      deliverables: ['Дизайн-макеты', 'UI-kit'],
      result: 'Готовый дизайн всех страниц',
    },
    {
      name: 'Разработка',
      duration: '10-20 дней',
      deliverables: ['Frontend', 'Backend', 'Интеграции'],
      result: 'Работающий продукт',
    },
    {
      name: 'Тестирование',
      duration: '3-5 дней',
      deliverables: ['Отчёт о тестировании', 'Исправленные баги'],
      result: 'Стабильная версия продукта',
    },
    {
      name: 'Запуск',
      duration: '1-2 дня',
      deliverables: ['Деплой', 'Настройка домена', 'SSL'],
      result: 'Продукт в продакшене',
    },
  ];

  // Adjust for chatbot
  if (projectType.includes('бот')) {
    return [
      {
        name: 'Анализ сценариев',
        duration: '2-3 дня',
        deliverables: ['Сценарии диалогов', 'Структура базы знаний'],
        result: 'Утверждённые сценарии',
      },
      {
        name: 'Разработка',
        duration: '5-10 дней',
        deliverables: ['Бот', 'Админ-панель', 'Интеграции'],
        result: 'Работающий чат-бот',
      },
      {
        name: 'Тестирование',
        duration: '2-3 дня',
        deliverables: ['Тестовые диалоги', 'Исправления'],
        result: 'Готовый к запуску бот',
      },
      {
        name: 'Запуск',
        duration: '1 день',
        deliverables: ['Публикация', 'Настройка каналов'],
        result: 'Бот на сайте/в мессенджерах',
      },
    ];
  }

  return defaultStages;
}

/**
 * Calculate cost based on project type and requirements
 */
function calculateCost(projectType: string, requirements: string[]): number {
  const baseCosts: Record<string, number> = {
    'Чат-бот': 49000,
    'Сайт': 50000,
    'Мобильное приложение': 200000,
    'Веб-разработка': 50000,
  };

  let cost = baseCosts[projectType] || 50000;

  // Add for complexity
  if (requirements.some(r => r.includes('интеграц'))) cost += 20000;
  if (requirements.some(r => r.includes('админ'))) cost += 15000;
  if (requirements.some(r => r.includes('оплат'))) cost += 25000;
  if (requirements.some(r => r.includes('дизайн'))) cost += 20000;

  return cost;
}

/**
 * Generate proposal with AI
 */
export async function generateProposal(
  messages: Array<{ role: string; content: string }>,
  clientInfo: {
    name: string;
    contact: string;
  },
  managerInfo: {
    name: string;
    phone: string;
    email: string;
  }
): Promise<GeneratedProposal> {
  // Extract project info
  const projectInfo = extractProjectInfo(messages);
  
  // Generate proposal data
  const proposalData: ProposalData = {
    proposalNumber: generateProposalNumber(),
    currentDate: new Date().toLocaleDateString('ru-RU'),
    clientName: clientInfo.name,
    clientContact: clientInfo.contact,
    projectContext: `${projectInfo.type}: ${projectInfo.requirements.join(', ')}`,
    stages: generateStages(projectInfo.type),
    totalDuration: projectInfo.timeline || '3-4 недели',
    totalCost: projectInfo.budget || calculateCost(projectInfo.type, projectInfo.requirements),
    prepaymentPercent: 50,
    includedItems: [
      'Разработка по утверждённому ТЗ',
      'Адаптивный дизайн',
      'Базовая SEO-оптимизация',
      'Наполнение контентом (до 10 страниц)',
      'Обучение работе с системой',
      'Гарантийная поддержка 1 месяц',
    ],
    excludedItems: [
      'Написание текстов (копирайтинг)',
      'Профессиональная фотосъёмка',
      'Продвижение и реклама',
      'Домен и хостинг (первый год)',
    ],
    managerName: managerInfo.name,
    managerPhone: managerInfo.phone,
    managerEmail: managerInfo.email,
    validUntil: calculateValidUntil(),
  };

  // Build prompt with data
  const promptVariables: Record<string, string> = {
    proposalNumber: proposalData.proposalNumber,
    currentDate: proposalData.currentDate,
    clientName: proposalData.clientName,
    clientContact: proposalData.clientContact,
    projectContext: proposalData.projectContext,
    totalDuration: proposalData.totalDuration,
    totalCost: proposalData.totalCost.toLocaleString('ru-RU'),
    prepaymentPercent: proposalData.prepaymentPercent.toString(),
    managerName: proposalData.managerName,
    managerPhone: proposalData.managerPhone,
    managerEmail: proposalData.managerEmail,
    validUntil: proposalData.validUntil,
    stagesMarkdown: proposalData.stages.map((s, i) => 
      `| ${i + 1} | ${s.name} | ${s.duration} | ${s.deliverables.join(', ')} | ${s.result} |`
    ).join('\n'),
    includedItemsMarkdown: proposalData.includedItems.map(i => `✓ ${i}`).join('\n'),
    excludedItemsMarkdown: proposalData.excludedItems.map(i => `✗ ${i}`).join('\n'),
  };

  let markdown = PROPOSAL_PROMPT;
  for (const [key, value] of Object.entries(promptVariables)) {
    markdown = markdown.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Try AI generation
  if (zai.isConfigured()) {
    try {
      const response = await zai.createCompletion([
        { 
          role: 'system', 
          content: 'Ты — менеджер по работе с клиентами. Составь коммерческое предложение в формате Markdown.' 
        },
        { 
          role: 'user', 
          content: `Составь коммерческое предложение на основе этих данных:\n\n${JSON.stringify(proposalData, null, 2)}\n\nИспользуй структуру:\n1. Заголовок с ASCII-оформлением\n2. Описание проекта\n3. Таблица этапов\n4. Стоимость и сроки\n5. Что включено/не включено\n6. Контакты\n7. Срок действия` 
        },
      ], {
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiContent = response.choices?.[0]?.message?.content;
      if (aiContent) {
        markdown = aiContent;
      }
    } catch (error) {
      console.warn('[Proposal Generator] AI generation failed, using template:', error);
    }
  }

  // Convert to HTML
  const html = markdownToHTML(markdown);

  return {
    markdown,
    html,
    data: proposalData,
  };
}

/**
 * Simple Markdown to HTML converter
 */
function markdownToHTML(markdown: string): string {
  let html = markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    // Line breaks
    .replace(/\n/gim, '<br>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        h3 { color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
        th { background-color: #f3f4f6; }
        .price { font-size: 24px; color: #2563eb; font-weight: bold; }
        .valid-until { color: #dc2626; }
        ul { margin: 10px 0; }
        li { margin: 5px 0; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
}

/**
 * Generate proposal PDF (placeholder)
 * In production, use Puppeteer/Playwright
 */
export async function generateProposalPDF(
  proposal: GeneratedProposal
): Promise<Buffer> {
  // Placeholder - in production, use Puppeteer to convert HTML to PDF
  console.log('[Proposal Generator] PDF generation placeholder');
  
  // Return empty buffer as placeholder
  return Buffer.from(proposal.html);
}

export default {
  generateProposal,
  generateProposalPDF,
};
