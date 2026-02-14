import { GoogleGenAI } from '@google/genai';

let genaiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

interface Source {
  documentName: string;
  chunk: string;
}

export async function generateAnswer(question: string, sources: Source[]): Promise<string> {
  const ai = getGenAI();

  const contextText = sources
    .map((s) => `${s.chunk}`)
    .join('\n\n---\n\n');

  const prompt = `Answer the question based on the context below. Be concise and direct.

IMPORTANT: Do NOT mention sources, citations, document names, or references like "Source:", "[Source 1]", "according to the document", etc. Just answer naturally.

If the answer isn't in the context, say "I couldn't find that information in your documents."

Context:
${contextText}

Question: ${question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return response.text || 'No response generated';
}

export async function checkLLMHealth(): Promise<boolean> {
  try {
    const ai = getGenAI();
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }],
    });
    return true;
  } catch {
    return false;
  }
}
