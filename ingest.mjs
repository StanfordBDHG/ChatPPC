#!/usr/bin/env node

import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';
import { createHash } from 'crypto';

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
      .map(file => join(dirPath, file))
      .map(path => path.replace(/\\/g, '/')); // Normalize path separators
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

// Get document hash from content
function getDocumentHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

// Check if document exists and get its hash
async function getExistingDocumentHash(client, filePath) {
  try {
    console.log(`Checking for existing document: ${filePath}`);
    const { data, error } = await client
      .from('documents')
      .select('metadata')
      .eq('metadata->>source', filePath)
      .maybeSingle();

    if (error) {
      console.error(`Error checking for existing document: ${error.message}`);
      return null;
    }

    if (!data) {
      console.log(`No existing document found for: ${filePath}`);
      return null;
    }

    const existingHash = data.metadata?.hash;
    if (existingHash) {
      console.log(`Found existing document with hash: ${existingHash.substring(0, 12)}...`);
    } else {
      console.log(`Existing document found but no hash stored for: ${filePath}`);
    }
    
    return existingHash;
  } catch (error) {
    console.error(`Error in getExistingDocumentHash: ${error.message}`);
    return null;
  }
}

// Process a single markdown file
async function processFile(filePath, vectorStore, splitter, client) {
  try {
    const normalizedPath = filePath.replace(/\\/g, '/');
    console.log(`\n--- Processing file: ${normalizedPath} ---`);
    
    const content = await readMarkdownFile(normalizedPath);
    const currentHash = getDocumentHash(content);
    console.log(`Generated hash for current content: ${currentHash.substring(0, 12)}...`);
    
    const existingHash = await getExistingDocumentHash(client, normalizedPath);
    
    if (existingHash === currentHash) {
      console.log(`✓ Hash match - skipping ${normalizedPath} (content unchanged)`);
      return;
    }

    if (existingHash && existingHash !== currentHash) {
      console.log(`✗ Hash mismatch - content has changed`);
      console.log(`  Old hash: ${existingHash.substring(0, 12)}...`);
      console.log(`  New hash: ${currentHash.substring(0, 12)}...`);
      console.log(`Deleting existing document entries...`);
      
      const { error } = await client
        .from('documents')
        .delete()
        .eq('metadata->>source', normalizedPath);
      
      if (error) {
        console.error(`Error deleting existing document: ${error.message}`);
        throw error;
      }
      console.log(`✓ Deleted existing document entries`);
    } else if (!existingHash) {
      console.log(`✓ New document - no existing hash found`);
    }

    console.log(`Splitting document into chunks...`);
    const splitDocuments = await splitter.createDocuments(
      [content], 
      [{ source: normalizedPath, hash: currentHash }]
    );
    console.log(`Created ${splitDocuments.length} document chunks`);
    
    console.log(`Storing document chunks with hash in database...`);
    await vectorStore.addDocuments(splitDocuments);
    console.log(`✓ Successfully processed and stored ${normalizedPath} with hash ${currentHash.substring(0, 12)}...`);
  } catch (error) {
    console.error(`Error processing ${normalizedPath}:`, error);
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
        await processFile(file, vectorStore, splitter, client);
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

// Export functions for testing
export { getDocumentHash, getExistingDocumentHash, processFile, getMarkdownFiles, readMarkdownFile };

// Run the script only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}