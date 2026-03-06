/**
 * Embeddings Module
 * Semantic search using vector embeddings
 * Supports OpenAI text-embedding-3-large or fallback to local BM25
 */

// Configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const VECTOR_DIMENSION = 1536; // For OpenAI text-embedding-3-large

// In-memory vector store (for production use Pinecone/Qdrant/Weaviate)
interface VectorDocument {
  id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, unknown>;
}

class VectorStore {
  private documents: VectorDocument[] = [];
  private isReady = false;

  async initialize(): Promise<void> {
    // In production, connect to external vector database
    // For now, we'll use in-memory storage with pre-computed embeddings
    this.isReady = true;
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  addDocument(doc: VectorDocument): void {
    this.documents.push(doc);
  }

  async search(queryEmbedding: number[], topK: number = 5): Promise<Array<{ id: string; score: number; text: string; metadata: Record<string, unknown> }>> {
    const results = this.documents.map(doc => ({
      id: doc.id,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
      text: doc.text,
      metadata: doc.metadata,
    }));

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  clear(): void {
    this.documents = [];
  }
}

// Singleton instance
export const vectorStore = new VectorStore();

/**
 * Generate embedding for text using OpenAI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: EMBEDDING_MODEL,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Result normalized to [0, 1] range
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  
  // Normalize from [-1, 1] to [0, 1]
  return (similarity + 1) / 2;
}

/**
 * Simple hash-based embedding for fallback when API is unavailable
 * Creates a deterministic but simple vector representation
 */
export function generateSimpleEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const vector: number[] = new Array(VECTOR_DIMENSION).fill(0);
  
  // Simple character n-gram hashing
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash) + trigram.charCodeAt(j);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % VECTOR_DIMENSION;
    vector[index] += 1;
  }

  // Normalize vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return vector.map(v => v / magnitude);
  }
  
  return vector;
}

/**
 * EmbeddingModel abstraction
 */
export interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddingModel implements EmbeddingModel {
  async embed(text: string): Promise<number[]> {
    return generateEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // OpenAI supports batching in single request
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: texts,
          model: EMBEDDING_MODEL,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((d: { embedding: number[] }) => d.embedding);
    } catch (error) {
      console.error('[Embeddings] Batch error:', error);
      // Fallback to individual calls
      return Promise.all(texts.map(t => generateEmbedding(t)));
    }
  }
}

export class SimpleEmbeddingModel implements EmbeddingModel {
  async embed(text: string): Promise<number[]> {
    return generateSimpleEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => generateSimpleEmbedding(t));
  }
}

/**
 * Factory for embedding models
 */
export function createEmbeddingModel(): EmbeddingModel {
  if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
    return new OpenAIEmbeddingModel();
  }
  return new SimpleEmbeddingModel();
}

/**
 * SemanticSearcher - high-level interface for semantic search
 */
export interface SemanticSearchResult {
  id: string;
  text: string;
  score: number; // Normalized [0, 1]
  metadata: Record<string, unknown>;
}

export class SemanticSearcher {
  private model: EmbeddingModel;

  constructor(model?: EmbeddingModel) {
    this.model = model || createEmbeddingModel();
  }

  async search(query: string, documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>, topK: number = 5): Promise<SemanticSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.model.embed(query);

    // Generate document embeddings and calculate similarity
    const results: SemanticSearchResult[] = [];
    
    for (const doc of documents) {
      const docEmbedding = await this.model.embed(doc.text);
      const score = cosineSimilarity(queryEmbedding, docEmbedding);
      
      results.push({
        id: doc.id,
        text: doc.text,
        score,
        metadata: doc.metadata || {},
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async searchBatch(query: string, documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>, topK: number = 5): Promise<SemanticSearchResult[]> {
    // More efficient batch processing
    const queryEmbedding = await this.model.embed(query);
    const docTexts = documents.map(d => d.text);
    const docEmbeddings = await this.model.embedBatch(docTexts);

    const results: SemanticSearchResult[] = documents.map((doc, i) => ({
      id: doc.id,
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, docEmbeddings[i]),
      metadata: doc.metadata || {},
    }));

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// Export singleton
export const semanticSearcher = new SemanticSearcher();
