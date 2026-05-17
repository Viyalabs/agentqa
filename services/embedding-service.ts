/**
 * Embedding service — wraps OpenAI text-embedding-3-small.
 *
 * Optional: when OPENAI_API_KEY is absent every function returns null / empty
 * arrays and the rest of the pipeline continues without semantic features.
 *
 * Model: text-embedding-3-small  — 1536 dimensions, $0.02 / 1M tokens.
 * Used for: issue pattern semantic clustering, known-signature matching,
 *           cross-framework failure correlation.
 */

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL      = 'text-embedding-3-small'
const MAX_INPUT_CHARS      = 8_000  // ~2k tokens — well within the 8k token model limit
const MAX_BATCH_SIZE       = 100    // OpenAI allows up to 2048 inputs per request

export function embeddingsEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/**
 * Generate an embedding vector for a single text string.
 * Returns null if OPENAI_API_KEY is not set or the call fails.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null

  try {
    const res = await fetch(OPENAI_EMBEDDING_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_INPUT_CHARS),
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      console.warn(`[embedding-service] API error ${res.status}: ${await res.text().catch(() => '')}`)
      return null
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch (err) {
    console.warn('[embedding-service] generateEmbedding failed:', err)
    return null
  }
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Splits into batches of MAX_BATCH_SIZE automatically.
 * Returns null entries for any texts that failed.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!embeddingsEnabled() || texts.length === 0) return texts.map(() => null)

  const results: (number[] | null)[] = new Array(texts.length).fill(null)

  // Process in batches
  for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
    const batch  = texts.slice(offset, offset + MAX_BATCH_SIZE)
    const inputs = batch.map((t) => t.slice(0, MAX_INPUT_CHARS))

    try {
      const res = await fetch(OPENAI_EMBEDDING_URL, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        console.warn(`[embedding-service] batch error ${res.status} offset=${offset}`)
        continue
      }

      const data = await res.json() as { data: Array<{ index: number; embedding: number[] }> }
      for (const item of data.data) {
        results[offset + item.index] = item.embedding
      }
    } catch (err) {
      console.warn(`[embedding-service] batch failed offset=${offset}:`, err)
    }
  }

  return results
}

/**
 * Build the canonical text representation of an issue for embedding.
 * Deterministic so the same issue always produces the same embedding input.
 */
export function issueToEmbeddingText(issue: {
  type:        string
  title:       string
  description?: string | null
}): string {
  const parts = [issue.type, issue.title]
  if (issue.description) parts.push(issue.description)
  return parts.join(': ')
}
