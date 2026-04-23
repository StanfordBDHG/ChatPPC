#!/usr/bin/env node
// Print full content + metadata for the given document ids.
// Usage: node scripts/show-rows.mjs 5570 5597 5798

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const ids = process.argv.slice(2).map(Number).filter(Boolean);
if (ids.length === 0) { console.error('Pass one or more row ids'); process.exit(1); }

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);
const { data, error } = await client.from('documents').select('id, content, metadata').in('id', ids);
if (error) { console.error(error); process.exit(1); }

for (const row of data) {
  console.log(`\n=== id=${row.id} ===`);
  console.log('link_text:    ', row.metadata?.link_text);
  console.log('section_path: ', row.metadata?.section_path);
  console.log('page_url:     ', row.metadata?.page_url);
  console.log('resource_url: ', row.metadata?.resource_url);
  console.log('\ncontent:');
  console.log(row.content);
}
