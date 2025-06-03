# Document Ingestion

The ChatPPC project includes an ingestion script that processes markdown files and stores them in your Supabase vector database for AI retrieval.

## Overview

The ingestion process:
- Scans the specified directory for markdown (`.md`) files
- Splits the content into chunks with appropriate overlap
- Generates embeddings using OpenAI
- Stores the embeddings in your Supabase vector database

## Preparing Documents

Add your markdown files to the `docs` directory. Each document should be a properly formatted markdown file (`.md`).

## Running the Ingestion Script

To ingest documents from the `docs` folder, use the following command:

```bash
yarn ingest docs
```

## Prerequisites

Before running the ingestion script, ensure that:

1. You have completed the development setup (see [DEVELOPMENT.md](./DEVELOPMENT.md))
2. Your Supabase emulator is running
3. Database migrations have been applied
4. Your `.env.local` file is configured with the required environment variables