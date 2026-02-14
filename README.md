# Knowledge Q&A

A RAG (Retrieval-Augmented Generation) web app. Upload documents, ask questions, get AI answers with sources.

## Features

- Upload text files, PDFs, PowerPoint (PPTX), and Word docs (DOCX)
- Document list with delete
- Ask questions in natural language
- AI answers with source tags
- User isolation (documents partitioned by IP)
- Rate limiting
- System health status page
- Clean minimal UI

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Vector DB**: Pinecone (with namespaces for user isolation)
- **Embeddings**: NVIDIA llama-3.2-nv-embedqa-1b-v2 (1024 dimensions)
- **LLM**: Google Gemini 3 Flash
- **Document Parsing**: unpdf (PDF), office-text-extractor (PPTX), mammoth (DOCX)

## How to Run

### Docker (One Command)

1. Create `.env.local` with your API keys:
   ```
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_INDEX_NAME=quickstart
   NVIDIA_API_KEY=your-nvidia-api-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

2. Run:
   ```bash
   docker compose up --build
   ```

3. Open [http://localhost:3000](http://localhost:3000)

### Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your API keys (same as above)

3. Ensure Pinecone index has 1024 dimensions.

4. Run:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Pages

- `/` - Landing page
- `/dashboard` - Upload docs & chat
- `/status` - Health check

## What is Done

- [x] Document upload (text, PDF, PPTX, DOCX)
- [x] Document delete
- [x] Document chunking
- [x] Vector storage in Pinecone
- [x] User isolation via namespaces
- [x] Semantic search
- [x] Answer generation with Gemini
- [x] Source tags (no inline citations)
- [x] Rate limiting with retry/backoff
- [x] Health status page
- [x] Input validation
- [x] Markdown rendering in chat
- [x] Minimal UI
- [x] Docker support (one command)

## What is Not Done

- [ ] Authentication (currently IP-based isolation)
- [ ] Conversation memory
- [ ] Real-time collaboration

## Project Structure

```
app/
  page.tsx              # Landing
  dashboard/page.tsx    # Chat & upload
  status/page.tsx       # Health
  api/
    documents/route.ts  # Upload, list, delete
    ask/route.ts        # Q&A
    health/route.ts     # Health check
lib/
  pinecone.ts           # Pinecone client
  embeddings.ts         # NVIDIA embeddings + retry
  llm.ts                # Gemini client
  rateLimit.ts          # Rate limiting
```
