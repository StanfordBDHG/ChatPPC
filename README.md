# ChatPPC

![ChatPPC Screenshot](./public/images/ChatPPC-screenshot-light.png#gh-light-mode-only)
![ChatPPC Screenshot](./public/images/ChatPPC-screenshot-dark.png#gh-dark-mode-only)

ChatPPC is a tool to help staff at [Gardner Packard Children's Health Center](https://med.stanford.edu/ppc.html) navigate patient care resources, built with [Next.js](https://nextjs.org/), [Vercel AI SDK](https://sdk.vercel.ai/), and [LangChain](https://js.langchain.com/). This project also uses [Supabase](https://supabase.com/) as a vector database for retrieval augmented generation (RAG).

## Local Development

### Prerequisites

- Node.js 22+ 
- OpenAI API key
- [Supabase](https://supabase.com/) project

### Setup for Development

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <project-directory>
```

2. Install dependencies:
```bash
yarn install
```

3. Set up your Supabase database by following [these instructions](https://js.langchain.com/docs/integrations/vectorstores/supabase) to:
   - Enable the `pgvector` extension
   - Create the necessary tables and functions

4. Create a `.env.local` file in the root directory based on the `.env.example` file in the project root. Ensure your `.env.local` file includes these variables:

```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_PRIVATE_KEY=your_supabase_private_key
```

> [!TIP]
> If you are running the application for the first time, follow the instructions in the [Document Ingestion](#document-ingestion) section below to ingest documents into your Supabase vector database.

5. Run the development server:
```bash
yarn run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to view the application.

## Document Ingestion

The project includes an ingestion script (`ingest.mjs`) that processes markdown files and stores them in your Supabase vector database for AI retrieval.

### Setup for Ingestion

Ensure that you have followed the instructions in [Local Development](#local-development) section above to set up your project first.

### Preparing Documents for Ingestion

Documents should be stored in a directory (e.g. `docs`) within the project root. Each document should be a properly formatted markdown file.

### Running the Ingestion Script

To ingest documents, use the following command:
```bash
yarn ingest <path_to_markdown_directory>
```

For example:
```bash
yarn ingest docs              # documents to ingest are in the 'docs' directory
```

The script will:
- Scan the specified directory for markdown (`.md`) files
- Split the content into chunks with appropriate overlap
- Generate embeddings using OpenAI
- Store the embeddings in your Supabase vector database