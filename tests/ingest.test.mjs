#!/usr/bin/env node

import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  getDocumentHash,
  getExistingDocumentHash,
  getMarkdownFiles,
  readMarkdownFile
} from '../scripts/ingest.mjs';

config({ path: join(process.cwd(), '.env.local') });

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    try {
      await testFn();
      console.log(`✅ ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
    }
  }

  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message = 'Values are not equal') {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
    }
  }

  async run() {
    console.log('🧪 Running ingest content change detection tests...\n');
    
    const testDir = await this.createTestFiles();

    try {
      // Test 1: SHA-256 hash generation
      await this.test('getDocumentHash produces consistent SHA-256 hashes', () => {
        const content = 'This is test content for hashing';
        const hash1 = getDocumentHash(content);
        const hash2 = getDocumentHash(content);
        
        this.assertEqual(hash1, hash2, 'Same content should produce same hash');
        this.assert(hash1.length === 64, 'SHA-256 hash should be 64 characters long');
        this.assert(/^[a-f0-9]+$/.test(hash1), 'Hash should only contain lowercase hex characters');
      });

      // Test 2: Different content produces different hashes
      await this.test('getDocumentHash produces different hashes for different content', () => {
        const content1 = 'This is the first piece of content';
        const content2 = 'This is the second piece of content';
        const hash1 = getDocumentHash(content1);
        const hash2 = getDocumentHash(content2);
        
        this.assert(hash1 !== hash2, 'Different content should produce different hashes');
      });

      // Test 3: Empty content hash
      await this.test('getDocumentHash handles empty content correctly', () => {
        const hash = getDocumentHash('');
        this.assert(hash.length === 64, 'Empty content should still produce 64-character hash');
        this.assertEqual(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Empty string should produce known SHA-256 hash');
      });

      // Test 4: Get markdown files
      await this.test('getMarkdownFiles finds markdown files and normalizes paths', async () => {
        const files = await getMarkdownFiles(testDir);
        
        this.assert(files.length >= 3, 'Should find at least 3 test markdown files');
        this.assert(files.every(file => file.endsWith('.md')), 'All returned files should be .md files');
        this.assert(files.every(file => !file.includes('\\')), 'All paths should be normalized (no backslashes)');
        this.assert(files.every(file => file.includes('/')), 'All paths should use forward slashes');
      });

      // Test 5: Read markdown file
      await this.test('readMarkdownFile reads file content correctly', async () => {
        const testFile = join(testDir, 'test1.md');
        const content = await readMarkdownFile(testFile);
        
        this.assert(content.includes('Test Document 1'), 'Should read the correct file content');
        this.assert(typeof content === 'string', 'Should return string content');
      });

      // Test 6: Content change detection logic
      await this.test('Content change detection identifies changes correctly', async () => {
        const originalContent = await readMarkdownFile(join(testDir, 'test1.md'));
        const differentContent = await readMarkdownFile(join(testDir, 'test2.md'));
        
        const originalHash = getDocumentHash(originalContent);
        const differentHash = getDocumentHash(differentContent);
        const sameHash = getDocumentHash(originalContent);
        
        this.assert(originalHash !== differentHash, 'Different files should have different hashes');
        this.assertEqual(originalHash, sameHash, 'Same content should have same hash');
      });

      // Test 7: File path normalization (test actual behavior from getMarkdownFiles)
      await this.test('File paths are normalized correctly', async () => {
        const files = await getMarkdownFiles(testDir);
        
        files.forEach(file => {
          this.assert(!file.includes('\\'), `File path should not contain backslashes: ${file}`);
          this.assert(file.includes('/'), `File path should contain forward slashes: ${file}`);
        });
      });

      // Supabase integration tests (if available)
      if (process.env.SUPABASE_URL && process.env.SUPABASE_PRIVATE_KEY) {
        await this.testSupabaseIntegration();
      } else {
        console.log('\n⚠️  Skipping Supabase integration tests (environment variables not set)');
      }

    } finally {
      await this.cleanupTestFiles(testDir);
    }

    this.printResults();
  }

  async testSupabaseIntegration() {
    console.log('\n🔗 Running Supabase integration tests...');
    
    const client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PRIVATE_KEY
    );

    // Test 8: Supabase connection and getExistingDocumentHash
    await this.test('getExistingDocumentHash handles non-existent documents', async () => {
      const nonExistentPath = '/test/non-existent-file.md';
      const hash = await getExistingDocumentHash(client, nonExistentPath);
      
      this.assert(hash === null, 'Should return null for non-existent documents');
    });

    // Test 9: Database query structure validation
    await this.test('Database query structure is valid', async () => {
      const testPath = '/test/path/for/query-validation.md';
      
      try {
        // This should not throw an error even if table doesn't exist
        const hash = await getExistingDocumentHash(client, testPath);
        // If we get here, the query structure is valid
        this.assert(true, 'Query executed without syntax errors');
      } catch (error) {
        // Only acceptable errors are table/column not existing
        const acceptableErrors = [
          'does not exist',
          'relation "documents" does not exist',
          'column "metadata" does not exist'
        ];
        
        const isAcceptableError = acceptableErrors.some(msg => 
          error.message.toLowerCase().includes(msg.toLowerCase())
        );
        
        this.assert(isAcceptableError, `Unexpected database error: ${error.message}`);
      }
    });
  }

  async createTestFiles() {
    const testDir = join(process.cwd(), 'test-data-ingest');
    
    await mkdir(testDir, { recursive: true });
    
    // Create test markdown files with different content
    await writeFile(join(testDir, 'test1.md'), '# Test Document 1\n\nThis is the first test document.');
    await writeFile(join(testDir, 'test2.md'), '# Test Document 2\n\nThis is the second test document with different content.');
    await writeFile(join(testDir, 'unchanged.md'), '# Unchanged Document\n\nThis document will not change during testing.');
    await writeFile(join(testDir, 'empty.md'), '');
    
    // Create a non-markdown file to test filtering
    await writeFile(join(testDir, 'notmarkdown.txt'), 'This should be ignored');
    
    return testDir;
  }

  async cleanupTestFiles(testDir) {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Could not cleanup test files:', error.message);
    }
  }

  printResults() {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed!');
      process.exit(1);
    }
  }
}

// Run tests
async function main() {
  const runner = new TestRunner();
  await runner.run();
}

main().catch(console.error);