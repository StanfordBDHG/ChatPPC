#!/usr/bin/env node
// End-to-end sanity test for the new retrieval path:
//  1. Generate paraphrases via the same prompt the route uses.
//  2. Call the Postgres `hybrid_search` RPC for each query.
//  3. Print the top results so we can eyeball whether the target doc surfaces.
//
// Usage: node scripts/test-retrieval.mjs "POCT hemoglobin pathway"

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const question = process.argv[2] || 'POCT hemoglobin pathway';

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);
const embeddings = new OpenAIEmbeddings();
const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.2 });

const PARAPHRASE_TEMPLATE = `You help search a medical clinic knowledge base. Rewrite the user's question in exactly 2 alternative ways that might match how the knowledge base describes the same topic. Expand ALL abbreviations and acronyms to their full spelled-out form (e.g. "POCT" -> "point of care testing", "GPCHC" -> "Gardner Packard Children's Health Center"). Vary the word choice. Keep each rewrite on a single line. Return ONLY the 2 rewrites, one per line — no numbering, no bullets, no commentary.

Question: ${question}`;

async function hybridSearch(query, k = 8) {
  const qe = await embeddings.embedQuery(query);
  const { data, error } = await client.rpc('hybrid_search', {
    query_embedding: qe,
    query_text: query,
    match_count: k,
  });
  if (error) { console.error('RPC error:', error); return []; }
  return data || [];
}

async function main() {
  console.log(`\n=== Question: "${question}" ===\n`);

  const raw = (await model.invoke(PARAPHRASE_TEMPLATE)).content;
  const paraphrases = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2);
  console.log('Paraphrases:');
  paraphrases.forEach(p => console.log('  -', p));
  console.log();

  const queries = [question, ...paraphrases];

  const bestById = new Map();
  for (const q of queries) {
    const docs = await hybridSearch(q, 8);
    console.log(`\n-- Query: "${q}" -- got ${docs.length} results`);
    docs.slice(0, 5).forEach((d, i) => {
      console.log(`  [${i}] id=${d.id} sim=${d.similarity.toFixed(3)} title=${d.metadata?.link_text || '(no title)'}`);
    });
    for (const d of docs) {
      const existing = bestById.get(d.id);
      if (!existing || existing.similarity < d.similarity) bestById.set(d.id, d);
    }
  }

  const merged = Array.from(bestById.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 15);

  console.log('\n=== MERGED top 15 (pre-rerank) ===');
  merged.forEach((d, i) => {
    console.log(`[${i}] id=${d.id} sim=${d.similarity.toFixed(3)} section=${d.metadata?.section_path}`);
    console.log(`    title: ${d.metadata?.link_text}`);
  });

  // ---- LLM reranker (mirrors rerankWithLLM in route.ts) ----
  const numbered = merged
    .map((d, i) => `[${i}] ${d.content.replace(/\n+/g, ' ').slice(0, 500)}`)
    .join('\n');
  const rerankPrompt = `You are scoring how relevant each retrieved resource is to a user's question. For each document, output a single line in the exact format "INDEX: SCORE" where SCORE is 0-10 (10 = directly answers the question, 0 = unrelated topic). Pay close attention to the "Section:" field — a resource from an unrelated clinical section should score low even if it shares keywords.

Question: ${question}

Documents:
${numbered}

Output the scores, one per line, nothing else:`;
  const rerankRaw = (await model.invoke(rerankPrompt)).content;
  const scores = new Map();
  for (const line of rerankRaw.split('\n')) {
    const m = line.match(/\[?(\d+)\]?\s*[:\-]?\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      const score = parseFloat(m[2]);
      if (idx >= 0 && idx < merged.length && !isNaN(score)) scores.set(idx, score);
    }
  }
  const reranked = merged
    .map((d, i) => ({ d, score: scores.get(i) ?? 0, idx: i }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  console.log('\n=== RERANKED top 8 ===');
  reranked.slice(0, 8).forEach(({ d, score }, i) => {
    console.log(`[${i}] score=${score} id=${d.id} sim=${d.similarity.toFixed(3)} section=${d.metadata?.section_path}`);
    console.log(`    title: ${d.metadata?.link_text}`);
  });

  // Target check: does the "low point of care hemoglobin" doc appear?
  const target = Array.from(bestById.values()).find(d =>
    (d.metadata?.link_text || '').toLowerCase().includes('point of care hemoglobin')
  );
  console.log('\n=== TARGET DOC PRESENT? ===');
  if (target) {
    const sorted = Array.from(bestById.values()).sort((a, b) => b.similarity - a.similarity);
    const rank = sorted.findIndex(d => d.id === target.id) + 1;
    console.log(`✓ YES — rank ${rank} of ${sorted.length}, similarity ${target.similarity.toFixed(3)}`);
    console.log(`  title: ${target.metadata?.link_text}`);
  } else {
    console.log('✗ NO — still missing after multi-query hybrid search');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
