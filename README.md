# ChatPPC

[![Build and Test](https://github.com/StanfordBDHG/ChatPPC/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/StanfordBDHG/ChatPPC/actions/workflows/build-and-test.yml) 
![Vercel Deploy](https://deploy-badge.vercel.app/vercel/chatppc)
[![DOI](https://zenodo.org/badge/930550250.svg)](https://doi.org/10.5281/zenodo.15291628)

![ChatPPC Screenshot](public/images/ChatPPC-screenshot-light.png#gh-light-mode-only)
![ChatPPC Screenshot](public/images/ChatPPC-screenshot-dark.png#gh-dark-mode-only)

ChatPPC is a tool to help staff at [Gardner Packard Children's Health Center](https://med.stanford.edu/ppc.html) navigate patient care resources, built with [Next.js](https://nextjs.org/), [Vercel AI SDK](https://sdk.vercel.ai/), and [LangChain](https://js.langchain.com/). This project also uses [Supabase](https://supabase.com/) as a vector database for retrieval augmented generation (RAG).

## Local Development

### Prerequisites

- Node.js 18+
- Docker Desktop (for local Supabase development)
- OpenAI API key (for document ingestion and embeddings)

### Setup for Development

1. Install the Supabase CLI:
```bash
yarn global add supabase
```

2. Clone the repository:
```bash
git clone https://github.com/StanfordBDHG/ChatPPC
cd ChatPPC
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

If this step succeeded, you should see a message that begins with

```
supabase local development setup is running.
```

Note the `API URL` and `service_role key` that are printed out below this message when the emulator starts, which you will use in the next step.

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

9. Open [http://localhost:3000](http://localhost:3000) to view the ChatPPC application. You can also access the Supabase Studio at [http://localhost:54323](http://localhost:54323) to view and manage your local database.

> [!TIP]
> At this point, you can follow the instructions below in the *Document Ingestion* and *Vector Search Optimization* sections to add documents and optimize search performance.

## Project Structure

```
├── scripts/                   # Executable Node.js scripts
│   ├── ingest.mjs             # Document ingestion script
│   └── optimize.mjs           # Vector search optimization script
├── tests/                     # All test files
│   ├── ingest.test.mjs        # Ingestion functionality tests
│   ├── optimize.test.mjs      # Optimization script tests
│   └── database.test.mjs      # Database connectivity tests
├── supabase/                  # Database-related files
│   ├── migrations/            # Database schema changes
│   ├── scripts/               # SQL utility scripts
│   │   ├── optimize-vector-search.sql
│   │   └── verify-indexes.sql
│   └── seed.sql              # Initial data seeding
├── app/                      # Next.js application pages
├── components/               # React components
└── docs/                     # Documentation files for ingestion
```

## Testing

The project includes a comprehensive test suite covering document ingestion, vector search optimization, and end-to-end workflows:

### Running Tests

```bash
# Run all tests (unit + database)
yarn test

# Run only unit tests (fast, no database required)
yarn test:unit

# Run database tests (requires Supabase setup)
yarn test:database

# Run complete test suite including app tests
yarn test:all
```

### Test Categories

#### Unit Tests
- **Ingestion Tests** (`yarn test:ingest`): Document processing, hash generation, file handling
- **Optimization Tests** (`yarn test:optimize`): Vector index setup, SQL validation, script functionality

#### Database Tests
- **Database Connectivity** (`yarn test:database`): Supabase connection and vector search functionality
- **Function Validation**: Tests the `match_documents` function with various parameters
- **Performance Testing**: Vector search speed and result accuracy

### Test Requirements

- **Unit tests**: No external dependencies (always runnable)
- **Database tests**: Require `SUPABASE_URL` and `SUPABASE_PRIVATE_KEY` environment variables
- **All tests**: Node.js 18+ and project dependencies installed

## Quick Start Workflow

Once you have the development environment set up, follow this workflow:

1. **Ingest Documents**: `yarn ingest docs` (add your `.md` files to the `docs` folder first)
2. **Optimize Search (optional)**: `yarn optimize` (creates database indexes for better performance with larger numbers of documents)
3. **Test Everything**: `yarn test` (runs comprehensive test suite)
4. **Start Development**: `yarn dev` (application ready at http://localhost:3000)

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

## Vector Search Optimization

> [!NOTE]
> This section describes *optional* optimization techniques that may be helpful if encountering slow queries when ingesting larger numbers of documents.

After running document ingestion, you can create vector indexes by running the following script:

```bash
yarn optimize
```

This script will create and verify:
- **HNSW index** on embeddings for fast vector similarity search
- **GIN index** on metadata for efficient filtering

## Admin Dashboard

To access the admin dashboard for viewing conversation analytics and managing documents:

1. Navigate to the Supabase dashboard and add a new user under `Authentication` with an email and password. Currently only admins have individual user accounts, whereas users access without an account, therefore *any user created in Supabase Authentication is automatically considered an admin*.
2. Navigate to `/admin` or click the 📄 icon in the top right of the navbar, then sign in with your admin credentials.
