#!/usr/bin/env node

import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: join(process.cwd(), '.env.local') });

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_PRIVATE_KEY',
  'OPENAI_API_KEY'
];

// Verify all required environment variables are present
function checkEnvironmentVariables() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

// Get all markdown files from a directory
async function getMarkdownFiles(dirPath) {
  try {
    const files = await readdir(dirPath);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => join(dirPath, file));
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    process.exit(1);
  }
}

// Read content of a markdown file
async function readMarkdownFile(filePath) {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

// Process a single markdown file
async function processFile(filePath, vectorStore, splitter) {
  try {
    console.log(`Processing ${filePath}...`);
    const content = await readMarkdownFile(filePath);
    const splitDocuments = await splitter.createDocuments([content], [{ source: filePath }]);
    
    await vectorStore.addDocuments(splitDocuments);
    console.log(`Successfully processed ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    throw error;
  }
}

async function main() {
  // Check if directory path is provided
  if (process.argv.length < 3) {
    console.error('Please provide a directory path');
    console.error('Usage: node ingest.mjs <directory_path>');
    process.exit(1);
  }

  // Verify environment variables
  checkEnvironmentVariables();

  const dirPath = process.argv[2];
  
  try {
    // Initialize Supabase client
    const client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PRIVATE_KEY
    );

    // Initialize text splitter
    const splitter = new MarkdownTextSplitter({
      chunkSize: 4000,
      chunkOverlap: 200
    });

    // Initialize vector store
    const vectorStore = new SupabaseVectorStore(
      new OpenAIEmbeddings(),
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      }
    );

    // Get all markdown files
    const files = await getMarkdownFiles(dirPath);
    
    if (files.length === 0) {
      console.log('No markdown files found in the specified directory');
      process.exit(0);
    }

    console.log(`Found ${files.length} markdown files`);

    // Process each file
    for (const file of files) {
      try {
        await processFile(file, vectorStore, splitter);
      } catch (error) {
        console.error(`Failed to process ${file}. Continuing with next file...`);
      }
    }

    console.log('All files processed successfully');
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);