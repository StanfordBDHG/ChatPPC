# ChatPPC

This is a tool to help staff at [Gardner Packard Children's Health Center](https://med.stanford.edu/ppc.html) navigate patient care resources, built with [Next.js](https://nextjs.org/), [Vercel AI SDK](https://sdk.vercel.ai/), and [LangChain](https://js.langchain.com/). This project also uses [Supabase](https://supabase.com/) as a vector database for retrieval augmented generation (RAG).

## Local Development

### Prerequisites

- Node.js 18+ 
- OpenAI API key
- [Supabase](https://supabase.com/) project

### Installation

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
   
5. Run the development server:
```bash
yarn run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to view the application.


## Document Ingestion

The project includes an ingestion script (`ingest.mjs`) that processes markdown files and stores them in your Supabase vector database for AI retrieval.

### Setup for Ingestion

Ensure that your supabase database has been set up and that the `pgvector` extension is enabled as described in the [Local Development](#local-development) section.

### Running the Ingestion Script

To ingest documents, use the following command:
```bash
node ingest.mjs <path_to_markdown_directory>
```

For example:
```bash
node ingest.mjs ./docs
```

The script will:
- Scan the specified directory for markdown (`.md`) files
- Split the content into chunks with appropriate overlap
- Generate embeddings using OpenAI
- Store the embeddings in your Supabase vector database