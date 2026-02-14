const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/embeddings';
const EMBEDDING_MODEL = 'nvidia/llama-3.2-nv-embedqa-1b-v2';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getEmbedding(text: string, inputType: 'query' | 'passage' = 'query'): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not set');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: EMBEDDING_MODEL,
        input_type: inputType,
        encoding_format: 'float',
        truncate: 'NONE',
        dimensions: 1024,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data[0].embedding;
    }

    const errorText = await response.text();

    // Retry on rate limit (429) or server errors (5xx)
    if (response.status === 429 || response.status >= 500) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.log(`NVIDIA API rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
      lastError = new Error(`NVIDIA API error: ${errorText}`);
      continue;
    }

    // Non-retryable error
    throw new Error(`NVIDIA API error: ${errorText}`);
  }

  throw lastError || new Error('NVIDIA API error: max retries exceeded');
}

export async function checkEmbeddingHealth(): Promise<boolean> {
  try {
    await getEmbedding('test', 'query');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get embeddings for multiple texts in parallel for faster processing
 */
export async function getEmbeddingsBatch(
  texts: string[],
  inputType: 'query' | 'passage' = 'query'
): Promise<number[][]> {
  const embeddings = await Promise.all(
    texts.map(text => getEmbedding(text, inputType))
  );
  return embeddings;
}
