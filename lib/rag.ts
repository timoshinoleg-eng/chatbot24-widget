/**
 * RAG (Retrieval-Augmented Generation) Module
 * Hybrid search: BM25 keyword + Semantic similarity
 * With LLM reranking and intelligent fallback strategies
 */

import faqData from '@/data/faq-chatbot24.json';
import { SemanticSearcher, createEmbeddingModel, cosineSimilarity } from './embeddings';
import { zai } from './zai';

// Configuration
const SEMANTIC_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;
const TOP_K = 5;
const RERANK_THRESHOLD = 0.5;

// Types
export interface KnowledgeChunk {
  id: string;
  category: string;
  questionVariants: string[];
  answer: string;
  metadata: {
    minPrice?: number;
    serviceType?: string;
    typicalTimeline?: string;
    urgency?: string;
    [key: string]: unknown;
  };
}

export interface HybridSearchResultItem {
  id: string;
  text: string;
  semanticScore: number;  // normalized [0, 1]
  bm25Score: number;      // normalized [0, 1]
  combinedScore: number;  // 0.6 × semantic + 0.4 × bm25
  llmScore?: number;      // optional LLM rerank score
  rerankReason?: string;  // optional reason from LLM rerank
  category: string;
  metadata: Record<string, unknown>;
}

export interface HybridSearchResult {
  relevantChunks: HybridSearchResultItem[];
  maxCombinedScore: number;
  topK: number;
  rerankThreshold: number;
  fallbackLevel: 'none' | 'partial' | 'full';
}

export interface SearchResult {
  items: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    confidence: number;
  }>;
  total: number;
  query: string;
  fallbackLevel?: string;
}

// Parse FAQ data
type FAQData = {
  version: string;
  lastUpdated: string;
  chunks: KnowledgeChunk[];
};

const knowledgeBase = (faqData as FAQData).chunks;

/**
 * Calculate BM25 score
 * Simplified implementation for keyword matching
 */
function calculateBM25(query: string, chunk: KnowledgeChunk): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const allTexts = [
    ...chunk.questionVariants,
    chunk.answer,
    chunk.category,
  ].map(t => t.toLowerCase());

  let score = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgDocLength = 100; // Approximate average document length

  for (const term of queryTerms) {
    let docFreq = 0;
    let termFreq = 0;
    let docLength = 0;

    for (const text of allTexts) {
      docLength += text.length;
      const freq = (text.match(new RegExp(term, 'g')) || []).length;
      if (freq > 0) {
        docFreq++;
        termFreq += freq;
      }
    }

    // IDF calculation
    const idf = Math.log((knowledgeBase.length - docFreq + 0.5) / (docFreq + 0.5) + 1);
    
    // TF normalization
    const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));
    
    score += idf * tf;
  }

  // Boost for exact phrase match in question variants
  const exactMatchBoost = chunk.questionVariants.some(qv => 
    qv.toLowerCase().includes(query.toLowerCase())
  ) ? 2.0 : 1.0;

  return score * exactMatchBoost;
}

/**
 * Normalize scores to [0, 1] range using min-max
 */
function normalizeScores(scores: number[]): number[] {
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  
  if (max === min) {
    return scores.map(() => 0.5);
  }
  
  return scores.map(s => (s - min) / (max - min));
}

/**
 * Hybrid search combining BM25 and semantic similarity
 * Optionally uses LLM-based reranking for high-confidence candidates
 */
export async function hybridSearch(
  query: string,
  options: {
    topK?: number;
    rerankThreshold?: number;
    semanticWeight?: number;
    keywordWeight?: number;
    useLLMRerank?: boolean;
  } = {}
): Promise<HybridSearchResult> {
  const {
    topK = TOP_K,
    rerankThreshold = RERANK_THRESHOLD,
    semanticWeight = SEMANTIC_WEIGHT,
    keywordWeight = KEYWORD_WEIGHT,
    useLLMRerank = false,
  } = options;

  if (!query || query.trim().length < 2) {
    return {
      relevantChunks: [],
      maxCombinedScore: 0,
      topK,
      rerankThreshold,
      fallbackLevel: 'full',
    };
  }

  const normalizedQuery = query.toLowerCase().trim();

  // BM25 keyword search
  const bm25Scores = knowledgeBase.map(chunk => ({
    chunk,
    score: calculateBM25(normalizedQuery, chunk),
  }));

  // Semantic search
  const semanticSearcher = new SemanticSearcher(createEmbeddingModel());
  const semanticDocs = knowledgeBase.map(chunk => ({
    id: chunk.id,
    text: [...chunk.questionVariants, chunk.answer].join(' '),
    metadata: { chunk },
  }));

  let semanticResults: Array<{ id: string; score: number }> = [];
  try {
    semanticResults = await semanticSearcher.searchBatch(normalizedQuery, semanticDocs, topK * 2);
  } catch (error) {
    console.warn('[RAG] Semantic search failed, using keyword only:', error);
    // Fall back to BM25 only
    semanticResults = knowledgeBase.map((chunk, i) => ({
      id: chunk.id,
      score: bm25Scores[i].score,
    }));
  }

  // Normalize scores
  const bm25Values = bm25Scores.map(s => s.score);
  const normalizedBM25 = normalizeScores(bm25Values);

  const semanticMap = new Map(semanticResults.map(r => [r.id, r.score]));

  // Combine scores
  const combinedResults = knowledgeBase.map((chunk, i) => {
    const bm25Norm = normalizedBM25[i];
    const semanticScore = semanticMap.get(chunk.id) || 0;
    
    return {
      id: chunk.id,
      text: chunk.answer,
      semanticScore,
      bm25Score: bm25Norm,
      combinedScore: semanticWeight * semanticScore + keywordWeight * bm25Norm,
      category: chunk.category,
      metadata: chunk.metadata,
    };
  });

  // Sort by combined score
  let sortedResults = combinedResults
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, topK);

  const maxCombinedScore = sortedResults[0]?.combinedScore || 0;

  // Apply LLM reranking if enabled and score is high enough
  if (useLLMRerank && maxCombinedScore >= rerankThreshold) {
    try {
      sortedResults = await llmRerank(query, sortedResults, {
        threshold: rerankThreshold,
        maxCandidates: topK,
      });
    } catch (error) {
      console.warn('[RAG] LLM reranking failed, using original scores:', error);
    }
  }

  // Determine fallback level
  let fallbackLevel: 'none' | 'partial' | 'full' = 'none';
  if (maxCombinedScore < 0.3) {
    fallbackLevel = 'full';
  } else if (maxCombinedScore < 0.6) {
    fallbackLevel = 'partial';
  }

  return {
    relevantChunks: sortedResults,
    maxCombinedScore,
    topK,
    rerankThreshold,
    fallbackLevel,
  };
}

/**
 * LLM-based reranking for high-confidence candidates
 * Uses a lightweight model to verify relevance and reorder results
 */
export async function llmRerank(
  query: string,
  candidates: HybridSearchResultItem[],
  options: {
    threshold?: number;
    maxCandidates?: number;
    temperature?: number;
  } = {}
): Promise<HybridSearchResultItem[]> {
  const threshold = options.threshold || RERANK_THRESHOLD;
  const maxCandidates = options.maxCandidates || 5;
  const temperature = options.temperature ?? 0.1;

  // Filter candidates above threshold
  const eligibleCandidates = candidates.filter(c => c.combinedScore >= threshold);

  if (eligibleCandidates.length === 0) {
    return candidates.slice(0, maxCandidates);
  }

  // If only one candidate, return it
  if (eligibleCandidates.length === 1) {
    return eligibleCandidates;
  }

  // If ZAI is not configured, return sorted by combined score
  if (!zai.isConfigured()) {
    return eligibleCandidates
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, maxCandidates);
  }

  try {
    // Build prompt for LLM reranking
    const rerankPrompt = `Ты — система реранжирования результатов поиска. Оцени релевантность каждого документа к запросу пользователя.

ЗАПРОС ПОЛЬЗОВАТЕЛЯ:
"""${query}"""

ДОКУМЕНТЫ ДЛЯ ОЦЕНКИ:
${eligibleCandidates.map((c, i) => `
[${i + 1}] ID: ${c.id}
Категория: ${c.category}
Текст: ${c.text.substring(0, 200)}${c.text.length > 200 ? '...' : ''}
Текущий скор: ${(c.combinedScore * 100).toFixed(1)}%`).join('\n---\n')}

ЗАДАЧА:
Оцени релевантность каждого документа к запросу по шкале 0-100, где:
- 0-30: Не релевантен
- 31-60: Частично релевантен
- 61-85: Релевантен
- 86-100: Высоко релевантен, прямое совпадение

Учитывай:
1. Смысловое соответствие запросу
2. Полнота ответа на вопрос
3. Точность информации

Ответь СТРОГО в формате JSON:
{
  "rankings": [
    {"id": "doc_id", "score": 95, "reason": "краткое обоснование"},
    ...
  ]
}`;

    const response = await zai.createCompletion([
      { role: 'system', content: 'Ты — система реранжирования. Отвечай только в JSON формате.' },
      { role: 'user', content: rerankPrompt },
    ], {
      temperature,
      max_tokens: 800,
    });

    const content = response.choices?.[0]?.message?.content || '';

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { rankings: Array<{ id: string; score: number; reason: string }> };

      // Create score map from LLM rankings
      const scoreMap = new Map(parsed.rankings.map(r => [r.id, r.score]));

      // Re-rank candidates based on LLM scores
      const rerankedCandidates = eligibleCandidates.map(c => {
        const llmScore = scoreMap.get(c.id);
        if (llmScore !== undefined) {
          // Combine original score with LLM score (weighted average)
          const normalizedLlmScore = llmScore / 100;
          const newCombinedScore = (c.combinedScore * 0.4) + (normalizedLlmScore * 0.6);
          return {
            ...c,
            combinedScore: newCombinedScore,
            llmScore: normalizedLlmScore,
            rerankReason: parsed.rankings.find(r => r.id === c.id)?.reason,
          };
        }
        return c;
      });

      // Sort by new combined score
      return rerankedCandidates
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, maxCandidates);
    }
  } catch (error) {
    console.warn('[RAG] LLM reranking failed, using original scores:', error);
  }

  // Fallback: return sorted by original combined score
  return eligibleCandidates
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, maxCandidates);
}

/**
 * Get context string for LLM prompt based on search results
 */
export function formatRAGContext(result: HybridSearchResult): string {
  if (result.relevantChunks.length === 0) {
    return '';
  }

  let context = '\n\nРелевантная информация из базы знаний:\n';

  for (const chunk of result.relevantChunks) {
    // Find original chunk for question variants
    const originalChunk = knowledgeBase.find(c => c.id === chunk.id);
    if (originalChunk) {
      context += `\n[${chunk.category}] ${originalChunk.questionVariants[0]}\n`;
      context += `Ответ: ${chunk.text}\n`;
    }
  }

  return context;
}

/**
 * Get fallback message based on confidence level
 */
export function getFallbackMessage(fallbackLevel: string): string {
  switch (fallbackLevel) {
    case 'full':
      return 'К сожалению, в моей базе знаний нет точного ответа на ваш вопрос. Рекомендую связаться с нашим менеджером для получения детальной консультации.';
    case 'partial':
      return 'Согласно частично релевантной информации из базы знаний, я могу предложить следующее (но рекомендую уточнить детали):';
    default:
      return '';
  }
}

/**
 * Legacy search function for backward compatibility
 */
export function searchKnowledgeBase(query: string, limit: number = 3): SearchResult {
  // Synchronous fallback using BM25 only
  if (!query || query.trim().length < 2) {
    return { items: [], total: 0, query };
  }

  const normalizedQuery = query.toLowerCase().trim();

  const scoredItems = knowledgeBase.map(chunk => {
    const bm25Score = calculateBM25(normalizedQuery, chunk);
    return {
      chunk,
      score: bm25Score,
    };
  });

  const relevantItems = scoredItems
    .filter(item => item.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({
      id: item.chunk.id,
      question: item.chunk.questionVariants[0],
      answer: item.chunk.answer,
      category: item.chunk.category,
      confidence: Math.min(item.score / 5, 1), // Normalize to 0-1
    }));

  return {
    items: relevantItems,
    total: relevantItems.length,
    query,
  };
}

/**
 * Get answer by ID
 */
export function getAnswerById(id: string): KnowledgeChunk | null {
  return knowledgeBase.find(c => c.id === id) || null;
}

/**
 * Get answers by category
 */
export function getAnswersByCategory(category: string): KnowledgeChunk[] {
  return knowledgeBase.filter(
    item => item.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  const categories = new Set(knowledgeBase.map(item => item.category));
  return Array.from(categories);
}

/**
 * Get suggested questions based on context
 */
export function getSuggestedQuestions(context?: string): string[] {
  const defaultSuggestions = [
    'Сколько стоит чат-бот?',
    'Какие сроки разработки?',
    'С какими CRM интегрируется?',
    'Как начать сотрудничество?',
  ];

  if (!context) {
    return defaultSuggestions;
  }

  const contextLower = context.toLowerCase();

  if (contextLower.includes('цена') || contextLower.includes('стоимость') || contextLower.includes('сколько')) {
    return [
      'Стоимость чат-бота для сайта?',
      'Цена корпоративного сайта?',
      'Есть ли скидки?',
      'Какие условия оплаты?',
    ];
  }

  if (contextLower.includes('срок') || contextLower.includes('время') || contextLower.includes('когда')) {
    return [
      'Можно ли ускорить разработку?',
      'Сроки разработки чат-бота?',
      'Когда начнётся работа?',
      'Срочный проект возможен?',
    ];
  }

  if (contextLower.includes('интеграция') || contextLower.includes('crm') || contextLower.includes('bitrix')) {
    return [
      'Интеграция с Битрикс24?',
      'Работает с Telegram?',
      'Подключение к WhatsApp?',
      'Какие API поддерживаются?',
    ];
  }

  if (contextLower.includes('чат-бот') || contextLower.includes('бот')) {
    return [
      'Возможности чат-бота?',
      'AI-ассистент сделает заявки?',
      'Квалификация лидов?',
      'Стоимость разработки бота?',
    ];
  }

  return defaultSuggestions;
}

/**
 * Format answer with source attribution
 */
export function formatAnswer(chunk: KnowledgeChunk, includeSource: boolean = false): string {
  let answer = chunk.answer;

  if (includeSource) {
    answer += `\n\n[Источник: ${chunk.category}]`;
  }

  return answer;
}

/**
 * Pre-compute embeddings for all chunks
 * Call this during initialization or build time
 */
export async function precomputeEmbeddings(): Promise<void> {
  const model = createEmbeddingModel();
  
  console.log('[RAG] Precomputing embeddings for', knowledgeBase.length, 'chunks');

  const embeddings: Array<{ id: string; embedding: number[] }> = [];

  for (const chunk of knowledgeBase) {
    const text = [...chunk.questionVariants, chunk.answer].join(' ');
    try {
      const embedding = await model.embed(text);
      embeddings.push({ id: chunk.id, embedding });
    } catch (error) {
      console.error(`[RAG] Failed to embed chunk ${chunk.id}:`, error);
    }
  }

  console.log('[RAG] Precomputed', embeddings.length, 'embeddings');
  // In production, save to file or vector database
}
