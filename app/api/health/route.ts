import { NextRequest, NextResponse } from 'next/server';
import { checkPineconeHealth } from '@/lib/pinecone';
import { checkEmbeddingHealth } from '@/lib/embeddings';
import { checkLLMHealth } from '@/lib/llm';
import { getClientIP, checkRateLimit, rateLimitResponse, healthRateLimit } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request);
  const { allowed, resetIn } = checkRateLimit(ip, healthRateLimit);
  if (!allowed) {
    return rateLimitResponse(resetIn);
  }

  const [pinecone, embeddings, llm] = await Promise.all([
    checkPineconeHealth(),
    checkEmbeddingHealth(),
    checkLLMHealth(),
  ]);

  const allHealthy = pinecone && embeddings && llm;

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: {
      backend: true,
      database: pinecone,
      embeddings: embeddings,
      llm: llm,
    },
    timestamp: new Date().toISOString(),
  }, { status: allHealthy ? 200 : 503 });
}
