# Development Setup

This guide will help you set up ChatPPC for local development.

## Prerequisites

- Node.js 22+ 
- OpenAI API key

## Setup Instructions

### 1. Install the Supabase CLI

```bash
yarn global add supabase
```

### 2. Clone the Repository

```bash
git clone https://github.com/StanfordBDHG/ChatPPC
cd ChatPPC
```

### 3. Install Dependencies

```bash
yarn install
```

### 4. Initialize Supabase

```bash
supabase init
```

### 5. Start the Supabase Emulator

```bash
supabase start
```

If this step succeeded, you should see a message that begins with:

```
supabase local development setup is running.
```

Note the `API URL` and `service_role key` that are printed out below this message when the emulator starts, which you will use in the next step.

### 6. Configure Environment Variables

Create a `.env.local` file in the root directory with these variables:

```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL={API URL}
SUPABASE_PRIVATE_KEY={service_role key}
```

### 7. Apply Database Migrations

```bash
supabase migration up
```

> [!TIP]
> At this step, you can follow the instructions in [INGESTION.md](./INGESTION.md) if you wish to add documents to test with.

### 8. Start the Development Server

```bash
yarn run dev
```

### 9. Access the Application

- **ChatPPC Application**: [http://localhost:3000](http://localhost:3000)
- **Supabase Studio**: [http://localhost:54323](http://localhost:54323) - View and manage your local database