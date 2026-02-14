# AI Notes

## What AI Was Used For

- **Code Generation**: All code files generated with GitHub Copilot (Claude)
- **Architecture**: RAG pipeline design (chunk → embed → store → retrieve → generate)
- **Bug Fixing**: Rate limit handling, PDF parsing issues, module compatibility
- **UI Design**: Minimal black/white chat interface
- **Prompt Engineering**: LLM prompt to avoid inline source citations

## What I Checked Myself

- **API Keys**: Environment variable configuration
- **Pinecone Index**: Dimension must be 1024 (NVIDIA embedding output)
- **Error Messages**: User-friendly wording
- **PDF Parsing**: Tested with actual PDF files
- **Rate Limiting**: Verified retry logic works

## LLM & Provider Choices

### Embeddings
- **Provider**: NVIDIA
- **Model**: `nvidia/llama-3.2-nv-embedqa-1b-v2`
- **Dimensions**: 1024
- **Why**: Optimized for Q&A, supports query/passage types, fast API

### Answer Generation
- **Provider**: Google
- **Model**: `gemini-3-flash-preview`
- **Why**: Fast, good instruction following, cost-effective

### Vector Database
- **Provider**: Pinecone
- **Why**: Managed, fast search, namespaces for user isolation, free tier

### PDF Parsing
- **Library**: `unpdf`
- **Why**: Works with Next.js (no worker issues like pdf-parse)
