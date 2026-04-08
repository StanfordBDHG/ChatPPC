#!/usr/bin/env node

/**
 * PPC Website Crawler
 *
 * Crawls https://med.stanford.edu/ppc using Playwright to discover all pages,
 * expand accordions/dropdowns, extract content as markdown, and upsert into
 * the Supabase vector store (same pipeline as ingest.mjs).
 *
 * Usage:
 *   node scripts/crawl-ppc.mjs                  # crawl full site
 *   node scripts/crawl-ppc.mjs --dry-run        # crawl but don't write to DB
 *   node scripts/crawl-ppc.mjs --max-pages 10   # limit pages (for testing)
 */

import { chromium } from "playwright";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createHash } from "crypto";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://med.stanford.edu/ppc";
const ALLOWED_PREFIX = "https://med.stanford.edu/ppc";
const CONCURRENCY = 3; // parallel browser tabs
const PAGE_TIMEOUT = 30_000; // 30s per page
const NAV_WAIT = 2_000; // wait after navigation for JS to settle

// Parse CLI flags
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const maxPagesIdx = args.indexOf("--max-pages");
const MAX_PAGES = maxPagesIdx !== -1 ? parseInt(args[maxPagesIdx + 1], 10) : Infinity;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDocumentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

/** Normalize a URL: strip trailing slash, fragment, and query params */
function normalizeUrl(raw) {
  try {
    const url = new URL(raw);
    // Only keep pages under the PPC path
    if (!url.href.startsWith(ALLOWED_PREFIX)) return null;
    // Skip non-HTML resources
    const ext = url.pathname.split(".").pop();
    if (["pdf", "jpg", "jpeg", "png", "gif", "svg", "css", "js", "xml", "ico"].includes(ext)) {
      return null;
    }
    // Strip query and fragment, normalize trailing slash
    url.search = "";
    url.hash = "";
    let normalized = url.href;
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return null;
  }
}

/** Convert a page's rendered DOM into clean markdown-like text */
async function extractPageContent(page) {
  return page.evaluate(() => {
    const main =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("#content") ||
      document.querySelector(".content-area") ||
      document.body;

    // Remove nav, footer, scripts, styles, hidden elements
    const clone = main.cloneNode(true);
    clone
      .querySelectorAll(
        'nav, footer, script, style, noscript, iframe, [aria-hidden="true"], .visually-hidden'
      )
      .forEach((el) => el.remove());

    function nodeToMarkdown(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.replace(/\s+/g, " ");
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();

      // Skip invisible elements
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return "";

      let children = Array.from(node.childNodes)
        .map((c) => nodeToMarkdown(c, depth))
        .join("");

      switch (tag) {
        case "h1":
          return `\n# ${children.trim()}\n`;
        case "h2":
          return `\n## ${children.trim()}\n`;
        case "h3":
          return `\n### ${children.trim()}\n`;
        case "h4":
          return `\n#### ${children.trim()}\n`;
        case "h5":
        case "h6":
          return `\n##### ${children.trim()}\n`;
        case "p":
          return `\n${children.trim()}\n`;
        case "br":
          return "\n";
        case "a": {
          const href = node.getAttribute("href") || "";
          const text = children.trim();
          if (!text) return "";
          if (href.startsWith("http") || href.startsWith("/")) {
            const fullHref = href.startsWith("/")
              ? `https://med.stanford.edu${href}`
              : href;
            return `[${text}](${fullHref})`;
          }
          return text;
        }
        case "ul":
        case "ol":
          return `\n${children}\n`;
        case "li":
          return `- ${children.trim()}\n`;
        case "strong":
        case "b":
          return `**${children.trim()}**`;
        case "em":
        case "i":
          return `*${children.trim()}*`;
        case "table":
          return `\n${children}\n`;
        case "tr":
          return `| ${children} |\n`;
        case "th":
        case "td":
          return ` ${children.trim()} |`;
        default:
          return children;
      }
    }

    const raw = nodeToMarkdown(clone);
    // Clean up excessive whitespace
    return raw
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  });
}

/** Click all accordion/expandable elements on the page */
async function expandAccordions(page) {
  // Common patterns for accordions, collapsible panels, and expand buttons
  const selectors = [
    // aria-expanded buttons/elements
    '[aria-expanded="false"]',
    // Common accordion class patterns
    ".accordion-toggle",
    ".accordion-header",
    ".accordion__trigger",
    ".collapse-toggle",
    ".expand-toggle",
    // Details/summary elements
    "details:not([open]) summary",
    // Bootstrap-style
    '[data-toggle="collapse"]',
    '[data-bs-toggle="collapse"]',
    // Generic expand buttons
    'button[class*="expand"]',
    'button[class*="accordion"]',
    'button[class*="collapse"]',
    'button[class*="toggle"]',
    // Stanford-specific patterns (Drupal/WP sites often use these)
    ".field-group-accordion .accordion-header",
    ".panel-heading a.collapsed",
    ".su-accordion__button",
    ".su-faq__question",
    '[class*="collapsible"] > [class*="header"]',
    '[class*="collapsible"] > [class*="title"]',
    '[class*="expandable"] button',
  ];

  let totalExpanded = 0;

  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements) {
        try {
          await el.click({ timeout: 1000 });
          totalExpanded++;
          // Small pause between clicks to let content render
          await page.waitForTimeout(300);
        } catch {
          // Element may not be clickable or visible, skip
        }
      }
    } catch {
      // Selector not found, skip
    }
  }

  if (totalExpanded > 0) {
    // Wait for all expanded content to render
    await page.waitForTimeout(1000);
  }

  return totalExpanded;
}

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

async function crawl() {
  console.log("=== PPC Website Crawler ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Max pages: ${MAX_PAGES === Infinity ? "unlimited" : MAX_PAGES}`);
  console.log();

  // ---- Supabase + vector store setup (skip in dry-run) ----
  let client, vectorStore, splitter;

  if (!DRY_RUN) {
    const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_PRIVATE_KEY", "OPENAI_API_KEY"];
    const missing = requiredEnvVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      console.error("Missing required environment variables:", missing.join(", "));
      process.exit(1);
    }

    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);

    vectorStore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });
  }

  splitter = new MarkdownTextSplitter({
    chunkSize: 4000,
    chunkOverlap: 200,
  });

  // ---- Launch browser ----
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; ChatPPC-Crawler/1.0; +https://github.com/StanfordBDHG/ChatPPC)",
    viewport: { width: 1280, height: 720 },
  });

  const visited = new Set();
  const queue = [BASE_URL];
  const results = { crawled: 0, updated: 0, skipped: 0, errors: 0 };

  /** Process a single URL */
  async function processUrl(url) {
    if (visited.has(url)) return;
    if (visited.size >= MAX_PAGES) return;
    visited.add(url);

    const page = await context.newPage();
    try {
      console.log(`[${visited.size}] Crawling: ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
      await page.waitForTimeout(NAV_WAIT);

      // Expand all accordions and collapsible sections
      const expanded = await expandAccordions(page);
      if (expanded > 0) {
        console.log(`  Expanded ${expanded} accordion/collapsible elements`);
      }

      // Discover links on this page
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => a.href)
      );
      for (const link of links) {
        const normalized = normalizeUrl(link);
        if (normalized && !visited.has(normalized) && visited.size + queue.length < MAX_PAGES + visited.size) {
          if (!queue.includes(normalized)) {
            queue.push(normalized);
          }
        }
      }

      // Extract content
      const content = await extractPageContent(page);
      if (!content || content.length < 50) {
        console.log(`  Skipped (too little content: ${content?.length || 0} chars)`);
        results.skipped++;
        return;
      }

      // Get page title
      const title = await page.title();

      // Build the full document with URL header
      const document = `# ${title}\n\nSource: ${url}\n\n${content}`;
      const hash = getDocumentHash(document);
      // Use the URL as the source identifier
      const source = `ppc-crawl:${url}`;

      console.log(`  Title: ${title}`);
      console.log(`  Content length: ${document.length} chars`);
      console.log(`  Hash: ${hash.substring(0, 12)}...`);

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would upsert to database`);
        results.updated++;
        return;
      }

      // Check existing hash
      const { data: existing } = await client
        .from("documents")
        .select("metadata")
        .eq("metadata->>source", source)
        .maybeSingle();

      const existingHash = existing?.metadata?.hash;

      if (existingHash === hash) {
        console.log(`  No changes (hash match) - skipping`);
        results.skipped++;
        return;
      }

      // Delete old chunks if content changed
      if (existingHash) {
        console.log(`  Content changed - deleting old chunks`);
        await client.from("documents").delete().eq("metadata->>source", source);
      }

      // Split and embed
      const splitDocs = await splitter.createDocuments(
        [document],
        [{ source, hash, url, title, crawled_at: new Date().toISOString() }]
      );
      console.log(`  Split into ${splitDocs.length} chunks - embedding...`);

      await vectorStore.addDocuments(splitDocs);
      console.log(`  Stored successfully`);
      results.updated++;
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      results.errors++;
    } finally {
      await page.close();
    }
  }

  // ---- BFS crawl with concurrency ----
  while (queue.length > 0 && visited.size < MAX_PAGES) {
    // Take up to CONCURRENCY URLs from the queue
    const batch = [];
    while (batch.length < CONCURRENCY && queue.length > 0 && visited.size + batch.length < MAX_PAGES) {
      const url = queue.shift();
      if (!visited.has(url)) {
        batch.push(url);
      }
    }

    if (batch.length === 0) break;

    await Promise.all(batch.map((url) => processUrl(url)));
  }

  await browser.close();

  // ---- Summary ----
  console.log("\n=== Crawl Complete ===");
  console.log(`Pages visited:  ${visited.size}`);
  console.log(`Updated in DB:  ${results.updated}`);
  console.log(`Skipped (unchanged): ${results.skipped}`);
  console.log(`Errors:         ${results.errors}`);

  if (DRY_RUN) {
    console.log("\n(Dry run - no database changes were made)");
  }

  // Clean up pages that no longer exist on the site
  if (!DRY_RUN && visited.size > 0) {
    console.log("\n--- Cleaning up stale pages ---");
    const { data: allCrawled } = await client
      .from("documents")
      .select("metadata")
      .like("metadata->>source", "ppc-crawl:%");

    if (allCrawled) {
      const crawledSources = new Set(allCrawled.map((d) => d.metadata?.source));
      const activeSources = new Set(
        [...visited].map((url) => `ppc-crawl:${url}`)
      );

      let staleCount = 0;
      for (const source of crawledSources) {
        if (source && !activeSources.has(source)) {
          console.log(`  Removing stale: ${source}`);
          await client.from("documents").delete().eq("metadata->>source", source);
          staleCount++;
        }
      }
      console.log(`Removed ${staleCount} stale page(s)`);
    }
  }
}

crawl().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
