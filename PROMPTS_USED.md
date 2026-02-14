# Prompts Used for Development

## 1. Initial Setup
"Build a web app where I can add documents, see uploaded docs, ask questions, get answers with sources"

## 2. Rate Limiting Fix
→ Added retry with exponential backoff, sequential chunk processing

## 3. User Isolation
→ Added Pinecone namespaces partitioned by IP address

## 4. Markdown Chat UI
→ Added react-markdown, fixed PDF parsing with unpdf

## 5. PDF Parsing Fix
→ Switched from pdf-parse to unpdf (Next.js compatible)

## 6. Clean UI
→ Updated landing page and status page with minimal design

## 7. Remove Source Citations
→ Updated LLM prompt to not include citations, show as tags instead
