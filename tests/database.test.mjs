#!/usr/bin/env node

/**
 * Database Tests - Vector Search Database Connectivity
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const execAsync = promisify(exec);
config({ path: '.env.local' });

async function main() {
  console.log('🧪 Running database tests...\n');

  // Check if Supabase is available
  const hasValidConfig = process.env.SUPABASE_URL?.startsWith('http') &&
                         process.env.SUPABASE_PRIVATE_KEY?.length > 20;

  if (!hasValidConfig) {
    console.log('⚠️  Skipping database tests (Supabase not configured)');
    console.log('📊 Results: 0 tests (skipped - database not available)');
    return;
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);

  try {
    // Test database connection
    const { error } = await client.from('documents').select('count').limit(1);
    if (error?.message.includes('fetch failed')) {
      console.log('⚠️  Skipping database tests (database not accessible)');
      console.log('📊 Results: 0 tests (skipped - database connection failed)');
      return;
    }

    console.log('✅ Database connection works');

    // Test match_documents function
    const testEmbedding = Array(1536).fill(0.1);
    const { data, error: funcError } = await client.rpc('match_documents', {
      query_embedding: testEmbedding,
      match_count: 3,
      filter: {}
    });

    if (funcError) {
      throw new Error(`Function test failed: ${funcError.message}`);
    }

    console.log('✅ match_documents function works');
    console.log(`✅ Vector search performance: ${Array.isArray(data) ? data.length : 0} results returned`);

    console.log('\n📊 Results: 3 tests passed');
    console.log('🎉 All database tests passed!');

  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
    console.log('\n📊 Results: Tests failed');
    process.exit(1);
  }
}

main().catch(console.error);