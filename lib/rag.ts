/**
 * RAG (Retrieval-Augmented Generation) Module
 * Knowledge base search for FAQ and documentation
 */

import faqData from '@/data/faq.json';

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  confidence?: number;
}

export interface SearchResult {
  items: KnowledgeItem[];
  total: number;
  query: string;
}

// Simple TF-IDF-like scoring
function calculateRelevance(query: string, item: KnowledgeItem): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const questionWords = item.question.toLowerCase();
  const answerWords = item.answer.toLowerCase();
  const tagsWords = item.tags.join(' ').toLowerCase();
  
  let score = 0;
  
  for (const word of queryWords) {
    // Exact match in question (highest weight)
    if (questionWords.includes(word)) {
      score += 3;
    }
    
    // Match in answer
    if (answerWords.includes(word)) {
      score += 1;
    }
    
    // Match in tags
    if (tagsWords.includes(word)) {
      score += 2;
    }
    
    // Partial match in question
    if (item.question.toLowerCase().split(/\s+/).some(qw => qw.includes(word) || word.includes(qw))) {
      score += 1.5;
    }
  }
  
  // Boost for shorter, more precise answers
  score += Math.max(0, 5 - item.answer.length / 100);
  
  return score;
}

export function searchKnowledgeBase(query: string, limit: number = 3): SearchResult {
  if (!query || query.trim().length < 2) {
    return { items: [], total: 0, query };
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  
  // Calculate relevance for all items
  const scoredItems = (faqData as KnowledgeItem[]).map(item => ({
    ...item,
    confidence: calculateRelevance(normalizedQuery, item)
  }));
  
  // Sort by confidence and filter relevant items
  const relevantItems = scoredItems
    .filter(item => (item.confidence || 0) > 2)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, limit);
  
  return {
    items: relevantItems,
    total: relevantItems.length,
    query
  };
}

export function getAnswerById(id: string): KnowledgeItem | null {
  const item = (faqData as KnowledgeItem[]).find(i => i.id === id);
  return item || null;
}

export function getAnswersByCategory(category: string): KnowledgeItem[] {
  return (faqData as KnowledgeItem[]).filter(
    item => item.category.toLowerCase() === category.toLowerCase()
  );
}

export function getAllCategories(): string[] {
  const categories = new Set((faqData as KnowledgeItem[]).map(item => item.category));
  return Array.from(categories);
}

// Get suggested questions based on context
export function getSuggestedQuestions(context?: string): string[] {
  const suggestions = [
    'Какие услуги вы предлагаете?',
    'Сколько стоит разработка сайта?',
    'Какие сроки разработки?',
    'Есть ли гарантия на работы?',
    'Как начать сотрудничество?',
  ];
  
  if (context) {
    const contextLower = context.toLowerCase();
    
    if (contextLower.includes('цена') || contextLower.includes('стоимость') || contextLower.includes('сколько')) {
      return [
        'Какие тарифы на разработку?',
        'Есть ли скидки для новых клиентов?',
        'Какая стоимость поддержки?',
      ];
    }
    
    if (contextLower.includes('срок') || contextLower.includes('время') || contextLower.includes('когда')) {
      return [
        'Сколько времени занимает разработка?',
        'Можно ли ускорить процесс?',
        'Когда начнётся работа?',
      ];
    }
  }
  
  return suggestions;
}

// Format answer with context
export function formatAnswer(item: KnowledgeItem, includeSource: boolean = false): string {
  let answer = item.answer;
  
  if (includeSource) {
    answer += `\n\n[Категория: ${item.category}]`;
  }
  
  return answer;
}
