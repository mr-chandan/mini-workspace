import { NextRequest, NextResponse } from 'next/server';
import { getIndex } from '@/lib/pinecone';
import { getEmbedding, getEmbeddingsBatch } from '@/lib/embeddings';
import { getClientIP, checkRateLimit, rateLimitResponse, uploadRateLimit } from '@/lib/rateLimit';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import mammoth from 'mammoth';

// Force Node.js runtime for PDF parsing compatibility
export const runtime = 'nodejs';

// Simple in-memory document store (in production, use a real database)
// We store document list in Pinecone metadata

// Extract text from PPTX (which is a ZIP file containing XML)
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const textParts: string[] = [];
  
  // Get all slide files and sort them
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });
  
  for (const slideFile of slideFiles) {
    const content = await zip.files[slideFile].async('text');
    // Extract text from XML tags (simplified regex for <a:t> tags which contain text)
    const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const slideText = textMatches
      .map(match => match.replace(/<\/?a:t>/g, ''))
      .filter(t => t.trim())
      .join(' ');
    if (slideText.trim()) {
      textParts.push(slideText);
    }
  }
  
  return textParts.join('\n\n');
}

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  
  // Handle PDF files
  if (fileName.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const parser = new PDFParse(uint8Array);
      const result = await parser.getText();
      
      // Clean up the extracted text - remove excessive whitespace
      const cleanedText = result.text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      if (!cleanedText) {
        throw new Error('PDF appears to be empty or contains only images');
      }
      
      return cleanedText;
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      throw new Error(`Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
    }
  }
  
  // Handle PowerPoint files (pptx)
  if (fileName.endsWith('.pptx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const text = await extractPptxText(buffer);
      
      const cleanedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      if (!cleanedText) {
        throw new Error('PowerPoint appears to be empty or contains only images');
      }
      
      return cleanedText;
    } catch (pptError) {
      console.error('PowerPoint parsing error:', pptError);
      throw new Error(`Failed to parse PowerPoint: ${pptError instanceof Error ? pptError.message : 'Unknown error'}`);
    }
  }
  
  // Handle Word documents (docx)
  if (fileName.endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      
      const cleanedText = result.value
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      if (!cleanedText) {
        throw new Error('Word document appears to be empty');
      }
      
      return cleanedText;
    } catch (docError) {
      console.error('Word document parsing error:', docError);
      throw new Error(`Failed to parse Word document: ${docError instanceof Error ? docError.message : 'Unknown error'}`);
    }
  }
  
  // Handle text-based files
  return await file.text();
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request);
  const { allowed, resetIn } = checkRateLimit(ip, uploadRateLimit);
  if (!allowed) {
    return rateLimitResponse(resetIn);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Try to read as text - will work for any text-based file
    let text: string;
    try {
      text = await extractTextFromFile(file);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Could not read file';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Split text into chunks (max ~2000 chars, safely under 8192 token limit)
    const chunks = chunkText(text, 2000);
    const index = getIndex(ip); // Namespace by IP to isolate user documents

    // Generate embeddings in parallel batches for faster processing
    const uploadTimestamp = Date.now();
    const BATCH_SIZE = 5; // Process 5 chunks in parallel to balance speed and rate limits
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await getEmbeddingsBatch(batch, 'passage');
      
      for (let j = 0; j < batch.length; j++) {
        vectors.push({
          id: `${file.name}-${uploadTimestamp}-${i + j}`,
          values: embeddings[j],
          metadata: {
            documentName: file.name,
            chunk: batch[j],
            chunkIndex: i + j,
            uploadedAt: new Date().toISOString(),
          },
        });
      }
    }

    await index.upsert({ records: vectors });

    return NextResponse.json({
      success: true,
      documentName: file.name,
      chunksCount: chunks.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request);
  const { allowed, resetIn } = checkRateLimit(ip);
  if (!allowed) {
    return rateLimitResponse(resetIn);
  }

  try {
    const index = getIndex(ip); // Namespace by IP to isolate user documents
    
    // Query with a dummy vector to get all documents
    // We'll use list with pagination to get unique document names
    const stats = await index.describeIndexStats();
    
    // Fetch some vectors to get document names
    // Note: This is a simplified approach - in production use a separate database
    const queryResult = await index.query({
      vector: new Array(1024).fill(0), // Dummy vector for NVIDIA model dimension
      topK: 100,
      includeMetadata: true,
    });

    const documents = new Map<string, { name: string; uploadedAt: string; chunks: number }>();
    
    for (const match of queryResult.matches || []) {
      const name = match.metadata?.documentName as string;
      if (name && !documents.has(name)) {
        documents.set(name, {
          name,
          uploadedAt: match.metadata?.uploadedAt as string || 'Unknown',
          chunks: 1,
        });
      } else if (name) {
        const doc = documents.get(name)!;
        doc.chunks++;
      }
    }

    return NextResponse.json({
      documents: Array.from(documents.values()),
      totalVectors: stats.totalRecordCount || 0,
    });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request);
  const { allowed, resetIn } = checkRateLimit(ip);
  if (!allowed) {
    return rateLimitResponse(resetIn);
  }

  try {
    const { documentName } = await request.json();
    
    if (!documentName) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 });
    }

    const index = getIndex(ip); // Namespace by IP to isolate user documents
    
    // Query to find all vectors with this document name
    const queryResult = await index.query({
      vector: new Array(1024).fill(0),
      topK: 1000,
      includeMetadata: true,
      filter: { documentName: { $eq: documentName } },
    });

    if (!queryResult.matches || queryResult.matches.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete all vectors for this document
    const idsToDelete = queryResult.matches.map(m => m.id);
    await index.deleteMany(idsToDelete);

    return NextResponse.json({
      success: true,
      deletedChunks: idsToDelete.length,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    );
  }
}

function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  
  // Helper to split text by character limit
  const splitByLength = (str: string, max: number): string[] => {
    const result: string[] = [];
    const words = str.split(/\s+/);
    let current = '';
    
    for (const word of words) {
      // If single word exceeds max, split it
      if (word.length > max) {
        if (current) {
          result.push(current.trim());
          current = '';
        }
        for (let i = 0; i < word.length; i += max) {
          result.push(word.slice(i, i + max));
        }
      } else if (current.length + word.length + 1 > max) {
        if (current) result.push(current.trim());
        current = word;
      } else {
        current += (current ? ' ' : '') + word;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result;
  };
  
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const para of paragraphs) {
    // If paragraph itself is too long, split it first
    if (para.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...splitByLength(para, maxLength));
    } else if (currentChunk.length + para.length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text.trim().slice(0, maxLength)];
}
