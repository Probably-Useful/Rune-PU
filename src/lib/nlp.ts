/**
 * Rune NLP Library
 * Client-side NLP for keyword extraction, TF-IDF, and cosine similarity.
 * Runs entirely in the browser after content is decrypted — server never sees plaintext.
 */

// ---- Types ----

export interface DocumentVector {
  id: string;
  title: string;
  keywords: string[];
  tfidfVector: Map<string, number>;
}

export interface SimilarityEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface GraphData {
  nodes: DocumentVector[];
  edges: SimilarityEdge[];
  clusters: Map<string, number>; // nodeId -> clusterIndex
}

// ---- Stop Words ----

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "that", "this", "was", "are",
  "be", "has", "had", "have", "will", "would", "could", "should", "may",
  "might", "can", "do", "did", "does", "been", "being", "am", "were",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very", "just",
  "about", "above", "after", "again", "all", "also", "any", "as", "because",
  "before", "between", "both", "each", "few", "get", "got", "here", "how",
  "into", "its", "like", "made", "make", "many", "more", "most", "much",
  "must", "my", "new", "now", "off", "old", "once", "one", "only", "other",
  "our", "out", "over", "own", "part", "per", "put", "said", "same", "she",
  "some", "still", "such", "take", "tell", "their", "them", "they", "thing",
  "through", "time", "under", "up", "us", "use", "used", "using", "way",
  "we", "well", "what", "when", "where", "which", "while", "who", "whom",
  "why", "work", "you", "your", "he", "her", "him", "his", "i", "me",
]);

// ---- Text Extraction from TipTap JSON ----

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Recursively extract plain text from TipTap JSON content
 */
export function extractTextFromTipTap(json: any): string {
  if (!json) return "";

  if (typeof json === "string") return json;

  let text = "";

  if (json.text) {
    text += json.text;
  }

  if (json.content && Array.isArray(json.content)) {
    for (const child of json.content) {
      text += extractTextFromTipTap(child) + " ";
    }
  }

  return text.trim();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---- Tokenization ----

/**
 * Tokenize text: lowercase, split, remove stop words, stem (basic)
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

// ---- TF-IDF ----

/**
 * Calculate term frequency for a document
 */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by document length
  const maxFreq = Math.max(...tf.values(), 1);
  for (const [term, freq] of tf) {
    tf.set(term, freq / maxFreq);
  }
  return tf;
}

/**
 * Calculate inverse document frequency across all documents
 */
function inverseDocumentFrequency(
  documents: string[][],
  vocabulary: Set<string>
): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;

  for (const term of vocabulary) {
    const docsContaining = documents.filter((doc) => doc.includes(term)).length;
    idf.set(term, Math.log((N + 1) / (docsContaining + 1)) + 1);
  }

  return idf;
}

/**
 * Build TF-IDF vectors for a set of documents
 */
export function buildTFIDFVectors(
  documents: { id: string; title: string; text: string }[]
): DocumentVector[] {
  // Tokenize all documents
  const tokenized = documents.map((doc) => tokenize(doc.text));

  // Build vocabulary
  const vocabulary = new Set<string>();
  for (const tokens of tokenized) {
    for (const token of tokens) {
      vocabulary.add(token);
    }
  }

  // Calculate IDF
  const idf = inverseDocumentFrequency(tokenized, vocabulary);

  // Build TF-IDF vectors
  return documents.map((doc, i) => {
    const tf = termFrequency(tokenized[i]);
    const tfidfVector = new Map<string, number>();

    for (const term of vocabulary) {
      const tfVal = tf.get(term) || 0;
      const idfVal = idf.get(term) || 0;
      if (tfVal > 0) {
        tfidfVector.set(term, tfVal * idfVal);
      }
    }

    // Extract top keywords
    const sortedTerms = [...tfidfVector.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      id: doc.id,
      title: doc.title,
      keywords: sortedTerms.map(([term]) => term),
      tfidfVector,
    };
  });
}

// ---- Cosine Similarity ----

/**
 * Calculate cosine similarity between two TF-IDF vectors
 */
export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Get all unique terms
  const allTerms = new Set([...vecA.keys(), ...vecB.keys()]);

  for (const term of allTerms) {
    const a = vecA.get(term) || 0;
    const b = vecB.get(term) || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Build a full similarity matrix and extract edges above threshold
 */
export function buildSimilarityGraph(
  vectors: DocumentVector[],
  threshold: number = 0.1
): GraphData {
  const edges: SimilarityEdge[] = [];

  // Calculate pairwise similarities
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = cosineSimilarity(
        vectors[i].tfidfVector,
        vectors[j].tfidfVector
      );
      if (sim >= threshold) {
        edges.push({
          source: vectors[i].id,
          target: vectors[j].id,
          similarity: sim,
        });
      }
    }
  }

  // Simple clustering based on connected components with high similarity
  const clusters = new Map<string, number>();
  let clusterIndex = 0;

  for (const node of vectors) {
    if (!clusters.has(node.id)) {
      // BFS to find connected component
      const queue = [node.id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (clusters.has(current)) continue;
        clusters.set(current, clusterIndex);

        // Find neighbors with high similarity
        for (const edge of edges) {
          if (edge.similarity >= 0.3) {
            if (edge.source === current && !clusters.has(edge.target)) {
              queue.push(edge.target);
            }
            if (edge.target === current && !clusters.has(edge.source)) {
              queue.push(edge.source);
            }
          }
        }
      }
      clusterIndex++;
    }
  }

  return { nodes: vectors, edges, clusters };
}
