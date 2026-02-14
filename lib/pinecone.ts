import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is not set');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

export function getIndex(namespace?: string) {
  const indexName = process.env.PINECONE_INDEX_NAME || 'quickstart';
  const index = getPinecone().index(indexName);
  // If namespace provided, return namespaced index for user isolation
  return namespace ? index.namespace(namespace) : index;
}

export async function checkPineconeHealth(): Promise<boolean> {
  try {
    const pc = getPinecone();
    await pc.listIndexes();
    return true;
  } catch {
    return false;
  }
}
