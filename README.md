# ChatPPC

[![Build and Test](https://github.com/StanfordBDHG/ChatPPC/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/StanfordBDHG/ChatPPC/actions/workflows/build-and-test.yml) 
![Vercel Deploy](https://deploy-badge.vercel.app/vercel/chatppc)

![ChatPPC Screenshot](public/images/ChatPPC-screenshot-light.png#gh-light-mode-only)
![ChatPPC Screenshot](public/images/ChatPPC-screenshot-dark.png#gh-dark-mode-only)

ChatPPC is a tool to help staff at [Gardner Packard Children's Health Center](https://med.stanford.edu/ppc.html) navigate patient care resources, built with [Next.js](https://nextjs.org/), [Vercel AI SDK](https://sdk.vercel.ai/), and [LangChain](https://js.langchain.com/). This project also uses [Supabase](https://supabase.com/) as a vector database for retrieval augmented generation (RAG).

## Local Development

### Prerequisites

- Node.js 22+ 
- OpenAI API key
- [Supabase](https://supabase.com/) project

### Setup for Development

1. Install the Supabase CLI:
```bash
yarn global add supabase
```

2. Clone the repository:
```bash
git clone <your-repo-url>
cd <project-directory>
```

3. Install dependencies:
```bash
yarn install
```

4. Initialize Supabase in your project:
```bash
supabase init
```

5. Start the Supabase emulator:
```bash
supabase start
```

Note the API URL and service_role key that are printed out when the emulator starts, which you will use in the next step.

6. Create a `.env.local` file in the root directory with these variables:
```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL={API URL}
SUPABASE_PRIVATE_KEY={service_role key}
```

7. Apply database migrations:
```bash
supabase migration up
```

8. Run the development server:
```bash
yarn run dev
```

9. Open [http://localhost:3000](http://localhost:3000) to view the application.

### Supabase Emulator Details

The Supabase emulator provides the following services:
- API: http://localhost:54321
- Database: localhost:54322
- Studio: http://localhost:54323

You can access the Supabase Studio at http://localhost:54323 to view and manage your local database.

## Document Ingestion

The project includes an ingestion script that processes markdown files and stores them in your Supabase vector database for AI retrieval.

### Preparing Documents for Ingestion

Add your markdown files to the `docs` directory. Each document should be a properly formatted markdown file (`.md`).

### Running the Ingestion Script

To ingest documents from the `docs` folder, use the following command:
```bash
yarn ingest docs
```

The script will:
- Scan the specified directory for markdown (`.md`) files
- Split the content into chunks with appropriate overlap
- Generate embeddings using OpenAI
- Store the embeddings in your Supabase vector database
