#!/usr/bin/env node
// Inspect the shape and content of the `documents` table in Supabase.
// Usage: node scripts/inspect-docs.mjs [search-term]

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);
const searchTerm = process.argv[2];

async function main() {
  // 1. Overall row count
  const { count } = await client.from('documents').select('*', { count: 'exact', head: true });
  console.log(`\n=== documents table: ${count} rows ===\n`);

  // 2. Look at one sample row to see the schema and metadata shape
  const { data: sample } = await client.from('documents').select('id, content, metadata').limit(1);
  if (sample?.[0]) {
    const row = sample[0];
    console.log('--- Sample row ---');
    console.log('id:', row.id);
    console.log('content length:', row.content.length);
    console.log('content preview:', JSON.stringify(row.content.slice(0, 400)));
    console.log('metadata keys:', Object.keys(row.metadata || {}));
    console.log('metadata:', JSON.stringify(row.metadata, null, 2).slice(0, 800));
    console.log();
  }

  // 3. Distribution of chunk sizes
  const { data: all } = await client.from('documents').select('id, content');
  if (all) {
    const sizes = all.map(r => r.content.length).sort((a, b) => a - b);
    const sum = sizes.reduce((a, b) => a + b, 0);
    const p = (q) => sizes[Math.floor(sizes.length * q)];
    console.log('--- Chunk size distribution (chars) ---');
    console.log(`count: ${sizes.length}, total: ${sum}`);
    console.log(`min: ${sizes[0]}, max: ${sizes[sizes.length - 1]}`);
    console.log(`p10: ${p(0.1)}, p50: ${p(0.5)}, p90: ${p(0.9)}, p99: ${p(0.99)}`);
    console.log();
  }

  // 4. Sources — how many distinct source files, how many chunks each
  const { data: sources } = await client.from('documents').select('metadata');
  if (sources) {
    const bySource = {};
    for (const r of sources) {
      const s = r.metadata?.source || '(no source)';
      bySource[s] = (bySource[s] || 0) + 1;
    }
    const entries = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
    console.log(`--- Sources: ${entries.length} distinct files ---`);
    entries.slice(0, 10).forEach(([s, n]) => console.log(`  ${n.toString().padStart(4)}  ${s}`));
    if (entries.length > 10) console.log(`  ...and ${entries.length - 10} more`);
    console.log();
  }

  // 5. Keyword search for the user-supplied term
  if (searchTerm) {
    console.log(`--- Chunks containing "${searchTerm}" (ILIKE) ---`);
    const { data: hits } = await client
      .from('documents')
      .select('id, content, metadata')
      .ilike('content', `%${searchTerm}%`)
      .limit(10);
    console.log(`matches: ${hits?.length || 0}`);
    (hits || []).forEach((h, i) => {
      console.log(`\n[${i}] id=${h.id} source=${h.metadata?.source}`);
      // Show the bit around the match
      const idx = h.content.toLowerCase().indexOf(searchTerm.toLowerCase());
      const start = Math.max(0, idx - 150);
      const end = Math.min(h.content.length, idx + searchTerm.length + 300);
      console.log(`  ...${h.content.slice(start, end)}...`);
      console.log(`  (chunk length: ${h.content.length})`);
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
