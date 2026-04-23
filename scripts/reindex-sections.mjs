#!/usr/bin/env node
// Re-index every row in `documents` with the new section-first content
// format, WITHOUT re-crawling.
//
// Why: buildDocumentContent in crawl-ppc.mjs was updated to put Section
// first and repeat it in the Resource line, so clinical-area terms
// dominate the embedding. Existing rows were written with the old format;
// this script reformats their content string and re-embeds in place.
//
// Usage:
//   node scripts/reindex-sections.mjs              # reindex everything
//   node scripts/reindex-sections.mjs --dry-run    # show the before/after for a few rows without writing

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);
const embeddings = new OpenAIEmbeddings();

// Mirrors buildDocumentContent in crawl-ppc.mjs
function buildContent(md) {
  const lines = [];
  const sectionPath = md.section_path || md.section || '';
  if (sectionPath) lines.push(`Section: ${sectionPath}`);
  if (md.link_text) {
    lines.push(sectionPath
      ? `Resource: ${md.link_text} (${sectionPath})`
      : `Resource: ${md.link_text}`);
  }
  if (md.resource_url) lines.push(`URL: ${md.resource_url}`);
  if (md.page_title) lines.push(`Found on: ${md.page_title}`);
  if (md.page_url) lines.push(`Page: ${md.page_url}`);
  if (md.context) lines.push(`Context: ${md.context}`);
  return lines.join('\n');
}

async function main() {
  const { data: rows, error } = await client.from('documents').select('id, content, metadata');
  if (error) { console.error(error); process.exit(1); }
  console.log(`Fetched ${rows.length} rows`);

  // Try to preserve `context` by extracting it from the old content string,
  // since it isn't stored directly in metadata.
  for (const row of rows) {
    const m = row.content.match(/^Context:\s*([\s\S]*)$/m);
    if (m) row.metadata.context = m[1].trim();
  }

  const toUpdate = rows
    .map(r => ({ id: r.id, oldContent: r.content, newContent: buildContent(r.metadata), metadata: r.metadata }))
    .filter(r => r.oldContent !== r.newContent);

  console.log(`${toUpdate.length} rows need updating`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: showing 3 samples ---');
    toUpdate.slice(0, 3).forEach(r => {
      console.log(`\n=== id=${r.id} ===`);
      console.log('--- BEFORE ---');
      console.log(r.oldContent);
      console.log('--- AFTER ---');
      console.log(r.newContent);
    });
    return;
  }

  // Embed + update in batches
  let done = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const vectors = await embeddings.embedDocuments(batch.map(r => r.newContent));

    await Promise.all(batch.map((r, j) =>
      client.from('documents').update({
        content: r.newContent,
        embedding: vectors[j],
      }).eq('id', r.id)
    ));

    done += batch.length;
    console.log(`  ${done}/${toUpdate.length} rows updated`);
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
