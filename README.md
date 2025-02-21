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

3. Follow [these instructions](https://js.langchain.com/docs/integrations/vectorstores/supabase/) to set up a Supabase database as a vector store and connect it to this project.

3. Create a `.env.local` file in the root directory based on the `.env.example` file in the project root. In this file you will need to add your OpenAI API key and Supabase key and database URL.
   
4. Run the development server:
```bash
yarn run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.