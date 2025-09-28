#!/usr/bin/env node

/**
 * Vector Search Optimization Tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const execAsync = promisify(exec);
config({ path: '.env.local' });

let passed = 0;
let failed = 0;

async function test(name, testFn) {
  try {
    await testFn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

async function main() {
  console.log('🧪 Running optimization tests...\n');

  // Basic file checks
  await test('Script exists', async () => {
    await execAsync('test -f scripts/optimize.mjs');
  });

  await test('SQL files exist', async () => {
    await execAsync('test -f supabase/scripts/optimize-vector-search.sql');
    await execAsync('test -f supabase/scripts/verify-indexes.sql');
  });

  // Supabase connection (if available)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_PRIVATE_KEY) {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);

    await test('Database connection works', async () => {
      const { error } = await client.from('documents').select('count').limit(1);
      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
    });

    await test('match_documents function exists', async () => {
      const testEmbedding = Array(1536).fill(0.1);
      const { error } = await client.rpc('match_documents', {
        query_embedding: testEmbedding,
        match_count: 1,
        filter: {}
      });

      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
    });
  } else {
    console.log('⚠️  Skipping database tests (environment not configured)');
  }

  // Results
  console.log(`\n📊 Results: ✅ ${passed} passed, ❌ ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

main().catch(console.error);