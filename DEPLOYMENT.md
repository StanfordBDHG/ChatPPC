# Deployment Guide

This guide explains how to deploy ChatPPC to Vercel with a Supabase backend.

> [!WARNING] 
> These instructions are *NOT* to be used for situations involving Protected Health Information (PHI) or requiring HIPAA compliance. Please contact your institution's IT department for further instructions.

## Prerequisites

- [Vercel account](https://vercel.com)
- [Supabase account](https://supabase.com)
- [GitHub account](https://github.com)
- Node.js 18 or higher

## 1. Supabase Setup

### Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project.
2. Note your project URL and anon key from the project settings.
3. Go to the SQL Editor in your Supabase dashboard.

### Run Database Migrations

Execute the migration files in order:

1. Copy and run the contents of `supabase/migrations/00000000000000_initial_schema.sql`
2. Copy and run the contents of `supabase/migrations/00000000000001_match_documents_function.sql`
3. Copy and run the contents of `supabase/migrations/00000000000002_seed_data.sql`

Alternatively, if you have the Supabase CLI installed, you can run the following script from the root directory:

```bash
supabase db push
```

## 2. Environment Variables

Create the following environment variables for your deployment:

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Optional: For enhanced security
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## 3. Vercel Deployment

### Option A: Deploy via GitHub (Recommended)

1. Fork or push the ChatPPC repository to your GitHub account
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project" and import your GitHub repository
4. Configure the following settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `.` (leave default)
   - **Build Command**: `yarn build`
   - **Output Directory**: `.next` (leave default)
   - **Install Command**: `yarn install`

5. Add your environment variables in the Vercel project settings
6. Deploy the project

### Option B: Deploy via CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. In your project directory:
   ```bash
   vercel
   ```

3. Follow the prompts and add environment variables when asked

## 4. Document Ingestion

After deployment, you'll need to ingest documents for the AI to use:

1. Set up your environment variables locally (create a `.env.local` file)
2. Place your documents in a folder (e.g., `docs/`)
3. Run the ingestion script:
   ```bash
   yarn ingest
   ```