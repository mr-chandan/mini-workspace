import { NextRequest, NextResponse } from 'next/server';
import { getIndex } from '@/lib/pinecone';
import { getEmbedding } from '@/lib/embeddings';
import { generateAnswer } from '@/lib/llm';
import { getClientIP, checkRateLimit, rateLimitResponse, askRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request);
  const { allowed, resetIn } = checkRateLimit(ip, askRateLimit);
  if (!allowed) {
    return rateLimitResponse(resetIn);
  }

  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return NextResponse.json({ error: 'Question cannot be empty' }, { status: 400 });
    }

    if (trimmedQuestion.length > 1000) {
      return NextResponse.json({ error: 'Question is too long (max 1000 characters)' }, { status: 400 });
    }

    // Get embedding for the question
    const questionEmbedding = await getEmbedding(trimmedQuestion, 'query');

    // Query Pinecone for relevant chunks (namespaced by IP)
    const index = getIndex(ip);
    const queryResult = await index.query({
      vector: questionEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    if (!queryResult.matches || queryResult.matches.length === 0) {
      return NextResponse.json({
        answer: 'No documents found. Please upload some documents first.',
        sources: [],
      });
    }

    // Prepare sources for the LLM
    const sources = queryResult.matches
      .filter(match => match.metadata)
      .map(match => ({
        documentName: match.metadata!.documentName as string,
        chunk: match.metadata!.chunk as string,
        score: match.score || 0,
      }));

    // Generate answer using Gemini
    const answer = await generateAnswer(trimmedQuestion, sources);

    return NextResponse.json({
      answer,
      sources: sources.map(s => ({
        documentName: s.documentName,
        chunk: s.chunk,
        relevanceScore: Math.round(s.score * 100),
      })),
    });
  } catch (error) {
    console.error('Ask error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process question' },
      { status: 500 }
    );
  }
}
