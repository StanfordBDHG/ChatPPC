#!/usr/bin/env node
// Audit the documents table for rows that look like they came from the old
// ingest.mjs (markdown-chunk) pipeline vs the current crawl-ppc.mjs pipeline.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);

async function main() {
  const { data: all, error } = await client.from('documents').select('id, content, metadata');
  if (error) { console.error(error); process.exit(1); }

  const crawler = [];      // ppc-resource:* sources, full crawler metadata
  const ingestish = [];    // likely from ingest.mjs: local file path source + only {hash,source}
  const unknown = [];

  const crawlerKeys = new Set(['section', 'page_url', 'section_path', 'link_text', 'page_title', 'resource_url', 'resource_type', 'crawled_at']);

  for (const row of all || []) {
    const md = row.metadata || {};
    const source = md.source || '';
    const keys = new Set(Object.keys(md));
    const hasCrawlerKeys = [...crawlerKeys].some(k => keys.has(k));
    const looksLikeFilePath = /\.(md|markdown)$/i.test(source) || source.startsWith('./') || source.startsWith('/') || /^[a-zA-Z]:[\\\/]/.test(source);
    const isResourceSource = source.startsWith('ppc-resource:');

    if (isResourceSource && hasCrawlerKeys) crawler.push(row);
    else if (looksLikeFilePath && !hasCrawlerKeys) ingestish.push(row);
    else unknown.push(row);
  }

  console.log(`Total rows: ${all.length}`);
  console.log(`  crawler (crawl-ppc.mjs):     ${crawler.length}`);
  console.log(`  ingest-like (ingest.mjs):    ${ingestish.length}`);
  console.log(`  unclassified:                ${unknown.length}`);

  if (ingestish.length) {
    console.log('\n--- Sample ingest.mjs residue ---');
    ingestish.slice(0, 3).forEach(r => {
      console.log(`id=${r.id} source=${r.metadata?.source}`);
      console.log(`  content: ${JSON.stringify(r.content.slice(0, 200))}`);
    });
  }

  if (unknown.length) {
    console.log('\n--- Unclassified samples ---');
    unknown.slice(0, 3).forEach(r => {
      console.log(`id=${r.id} metadata keys: ${Object.keys(r.metadata || {}).join(',')}`);
      console.log(`  source=${r.metadata?.source}`);
      console.log(`  content: ${JSON.stringify(r.content.slice(0, 200))}`);
    });
  }

  // Also count metadata-key distributions
  const keyCounts = {};
  for (const row of all || []) {
    for (const k of Object.keys(row.metadata || {})) {
      keyCounts[k] = (keyCounts[k] || 0) + 1;
    }
  }
  console.log('\n--- Metadata key frequency ---');
  Object.entries(keyCounts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`  ${n.toString().padStart(4)}  ${k}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
