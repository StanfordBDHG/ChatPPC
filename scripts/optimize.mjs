#!/usr/bin/env node

/**
 * Vector Search Optimization Script
 * Applies HNSW and GIN indexes to improve vector search performance
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message) {
  console.log(`[Vector Optimization] ${message}`);
}

function showSQLInstructions(sqlContent) {
  log('Please run this SQL in your Supabase SQL Editor:');
  console.log('\n' + '='.repeat(50));
  console.log(sqlContent);
  console.log('='.repeat(50) + '\n');
}

function main() {
  const skipVerification = process.argv.includes('--skip-verify');

  log('Starting vector search optimization...');

  // Read optimization SQL
  const sqlFile = path.join(__dirname, '../supabase/scripts/optimize-vector-search.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error(`SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Try local execution first
  try {
    const output = execSync('psql postgresql://postgres:postgres@localhost:54322/postgres', {
      input: sqlContent,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    log('Optimization completed successfully!');
    console.log('\nOutput:');
    console.log(output);

    // Run verification if not skipped
    if (!skipVerification) {
      const verifyFile = path.join(__dirname, '../supabase/scripts/verify-indexes.sql');
      if (fs.existsSync(verifyFile)) {
        const verifyContent = fs.readFileSync(verifyFile, 'utf8');
        const verifyOutput = execSync('psql postgresql://postgres:postgres@localhost:54322/postgres', {
          input: verifyContent,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });

        log('Verification completed!');
        console.log('\nVerification Results:');
        console.log(verifyOutput);
      }
    }
  } catch (error) {
    log('Local execution failed, providing manual instructions...');
    showSQLInstructions(sqlContent);
  }

  log('Done!');
}

if (import.meta.url === `file://${__filename}`) {
  main();
}

export { main };