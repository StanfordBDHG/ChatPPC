#!/usr/bin/env node

/**
 * PPC Website Crawler — Resource-Level Extraction
 *
 * Crawls https://med.stanford.edu/ppc using Playwright, expands all
 * accordions/dropdowns, and extracts every individual link and piece of
 * information as its own row in the Supabase documents table.
 *
 * Each row contains:
 *   - A description of what the resource is and when to use it
 *   - The resource URL (if applicable)
 *   - Metadata: page_url, section, link_text, resource_type, crawled_at
 *
 * This produces small, focused documents that match well against user
 * queries via embedding similarity search.
 *
 * Usage:
 *   node scripts/crawl-ppc.mjs                  # crawl full site
 *   node scripts/crawl-ppc.mjs --dry-run        # crawl but don't write to DB
 *   node scripts/crawl-ppc.mjs --max-pages 10   # limit pages (for testing)
 */

import { chromium } from "playwright";
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
const CONCURRENCY = 3;
const PAGE_TIMEOUT = 30_000;
const NAV_WAIT = 2_000;

// Batch size for embedding API calls (avoid rate limits)
const EMBED_BATCH_SIZE = 20;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const maxPagesIdx = args.indexOf("--max-pages");
const MAX_PAGES =
  maxPagesIdx !== -1 ? parseInt(args[maxPagesIdx + 1], 10) : Infinity;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

/** Normalize a page URL for crawl queue (strip query, fragment, trailing slash) */
function normalizePageUrl(raw) {
  try {
    const url = new URL(raw);
    if (!url.href.startsWith(ALLOWED_PREFIX)) return null;
    const ext = url.pathname.split(".").pop();
    if (
      ["pdf", "jpg", "jpeg", "png", "gif", "svg", "css", "js", "xml", "ico"].includes(ext)
    )
      return null;
    url.search = "";
    url.hash = "";
    let normalized = url.href;
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return null;
  }
}

/** Resolve a potentially relative href into a full URL */
function resolveHref(href, pageUrl) {
  if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return null;
  }
}

/** Sleep utility */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Accordion Expansion (unchanged from v1)
// ---------------------------------------------------------------------------

async function expandAccordions(page) {
  const selectors = [
    '[aria-expanded="false"]',
    ".accordion-toggle",
    ".accordion-header",
    ".accordion__trigger",
    ".collapse-toggle",
    ".expand-toggle",
    "details:not([open]) summary",
    '[data-toggle="collapse"]',
    '[data-bs-toggle="collapse"]',
    'button[class*="expand"]',
    'button[class*="accordion"]',
    'button[class*="collapse"]',
    'button[class*="toggle"]',
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
          await page.waitForTimeout(300);
        } catch {}
      }
    } catch {}
  }
  if (totalExpanded > 0) await page.waitForTimeout(1000);
  return totalExpanded;
}

// ---------------------------------------------------------------------------
// Resource Extraction — the core new logic
// ---------------------------------------------------------------------------

/**
 * Extracts structured resources from a rendered page.
 *
 * Returns an array of objects:
 * {
 *   resource_url: string | null,
 *   link_text: string,
 *   section: string,          // nearest heading
 *   context: string,          // surrounding text (the paragraph / list item)
 *   resource_type: "link" | "contact" | "info"
 * }
 */
async function extractResources(page) {
  return page.evaluate(() => {
    const resources = [];
    const seen = new Set(); // deduplicate by url+section

    const main =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("#content") ||
      document.querySelector(".content-area") ||
      document.body;

    if (!main) return resources;

    // Remove nav, footer, scripts, styles
    const clone = main.cloneNode(true);
    clone
      .querySelectorAll(
        'nav, footer, script, style, noscript, iframe, [aria-hidden="true"], .visually-hidden'
      )
      .forEach((el) => el.remove());

    // --- Heading-like detection ---
    // Stanford sites use <strong>/<b> inside <p> as section labels
    // (e.g. "Vanderbilt Scales") instead of proper heading tags.
    function isHeadingLike(el) {
      if (/^H[1-6]$/.test(el.tagName)) return true;
      // Standalone <strong>/<b> that is the main child of a <p>/<div>
      if (el.tagName === "STRONG" || el.tagName === "B") {
        const parent = el.parentElement;
        if (parent && (parent.tagName === "P" || parent.tagName === "DIV")) {
          const boldText = el.textContent.trim();
          const parentText = parent.textContent.trim();
          if (boldText.length > 3 && boldText.length >= parentText.length * 0.6) return true;
        }
      }
      // A <p>/<div> whose only child is <strong>/<b>
      if (el.tagName === "P" || el.tagName === "DIV") {
        const ch = el.children;
        if (ch.length === 1 && (ch[0].tagName === "STRONG" || ch[0].tagName === "B")) {
          const t = ch[0].textContent.trim();
          if (t.length > 3 && t.length < 100) return true;
        }
      }
      return false;
    }

    function getHeadingText(el) {
      if (/^H[1-6]$/.test(el.tagName)) return el.textContent.trim();
      if (el.tagName === "STRONG" || el.tagName === "B") return el.textContent.trim();
      const bold = el.querySelector("strong, b");
      if (bold) return bold.textContent.trim();
      return el.textContent.trim();
    }

    function getHeadingLevel(el) {
      if (/^H[1-6]$/.test(el.tagName)) return parseInt(el.tagName[1], 10);
      return 7; // bold labels rank below all real headings
    }

    function findAllHeadingLike(container) {
      const results = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) {
        if (isHeadingLike(walker.currentNode)) results.push(walker.currentNode);
      }
      return results;
    }

    // --- Heading path & nearest heading ---

    function findHeadingPath(el) {
      const headings = [];
      let node = el;
      while (node && node !== clone) {
        let prev = node.previousElementSibling;
        while (prev) {
          if (isHeadingLike(prev)) {
            const level = getHeadingLevel(prev);
            const text = getHeadingText(prev);
            if (text && (headings.length === 0 || level < headings[0].level)) {
              headings.unshift({ level, text });
            }
          }
          const inner = findAllHeadingLike(prev);
          for (let i = inner.length - 1; i >= 0; i--) {
            const level = getHeadingLevel(inner[i]);
            const text = getHeadingText(inner[i]);
            if (text && (headings.length === 0 || level < headings[0].level)) {
              headings.unshift({ level, text });
            }
          }
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
      }
      return headings.map((h) => h.text).join(" > ");
    }

    function findNearestHeading(el) {
      let node = el;
      while (node && node !== clone) {
        let prev = node.previousElementSibling;
        while (prev) {
          if (isHeadingLike(prev)) return getHeadingText(prev);
          const inner = findAllHeadingLike(prev);
          if (inner.length > 0) return getHeadingText(inner[inner.length - 1]);
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
        if (node && isHeadingLike(node)) return getHeadingText(node);
      }
      return "";
    }

    // --- Context: captures BOTH section text AND immediate surrounding text ---

    // Get the immediate container text (paragraph, list item, etc.)
    function getImmediateContext(el) {
      const blockTags = new Set([
        "P", "LI", "DIV", "TD", "TH", "BLOCKQUOTE",
        "SECTION", "ARTICLE", "DD", "DT",
      ]);
      let container = el.parentElement;
      while (container && !blockTags.has(container.tagName)) {
        container = container.parentElement;
      }
      if (!container) container = el.parentElement;
      if (!container) return "";
      const text = container.textContent.replace(/\s+/g, " ").trim();
      return text.length > 400 ? text.substring(0, 400) + "..." : text;
    }

    // Get the broader section context (text between nearest heading and next)
    function getSectionContext(el) {
      // Find the nearest heading-like element before this element
      let headingEl = null;
      let node = el;
      outer: while (node && node !== clone) {
        let prev = node.previousElementSibling;
        while (prev) {
          if (isHeadingLike(prev)) {
            headingEl = prev;
            break outer;
          }
          const inner = findAllHeadingLike(prev);
          if (inner.length > 0) {
            headingEl = inner[inner.length - 1];
            break outer;
          }
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
      }

      // Get the immediate text around the link
      const immediateText = getImmediateContext(el);

      if (!headingEl) {
        return immediateText || (() => {
          const container = el.closest("p, li, div, td, section") || el.parentElement;
          const text = container ? container.textContent.replace(/\s+/g, " ").trim() : "";
          return text.length > 800 ? text.substring(0, 800) + "..." : text;
        })();
      }

      // Collect section text from the heading through subsequent siblings
      // until we hit another heading-like element of the same or higher level
      const headingLevel = getHeadingLevel(headingEl);
      const parts = [getHeadingText(headingEl)];
      let sibling = headingEl.nextElementSibling;
      let charCount = parts[0].length;

      while (sibling && charCount < 1200) {
        if (isHeadingLike(sibling)) {
          const sibLevel = getHeadingLevel(sibling);
          if (sibLevel <= headingLevel) break; // next section starts
        }
        const text = sibling.textContent.replace(/\s+/g, " ").trim();
        if (text) {
          parts.push(text);
          charCount += text.length;
        }
        sibling = sibling.nextElementSibling;
      }

      // Combine section context with immediate surrounding text
      let result = parts.join(" | ");
      if (immediateText && !result.includes(immediateText.substring(0, 50))) {
        result = result + " | Nearby text: " + immediateText;
      }
      return result.length > 1500 ? result.substring(0, 1500) + "..." : result;
    }

    // --- Extract links ---
    const anchors = clone.querySelectorAll("a[href]");
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = a.textContent.replace(/\s+/g, " ").trim();

      // Skip empty links, anchor-only links, and navigation-like links
      if (!text || text.length < 2) continue;
      if (href === "#" || href === "") continue;

      // Resolve full URL
      let fullUrl;
      if (href.startsWith("http")) {
        fullUrl = href;
      } else if (href.startsWith("/")) {
        fullUrl = "https://med.stanford.edu" + href;
      } else if (href.startsWith("mailto:") || href.startsWith("tel:")) {
        // Capture contact info
        const section = findNearestHeading(a);
        const sectionPath = findHeadingPath(a);
        const context = getSectionContext(a);
        const key = `contact:${href}:${section}`;
        if (!seen.has(key)) {
          seen.add(key);
          resources.push({
            resource_url: href,
            link_text: text,
            section,
            section_path: sectionPath,
            context,
            resource_type: "contact",
          });
        }
        continue;
      } else {
        continue;
      }

      const section = findNearestHeading(a);
      const sectionPath = findHeadingPath(a);
      const context = getSectionContext(a);
      const key = `${fullUrl}:${section}`;

      if (seen.has(key)) continue;
      seen.add(key);

      resources.push({
        resource_url: fullUrl,
        link_text: text,
        section,
        section_path: sectionPath,
        context,
        resource_type: "link",
      });
    }

    // --- Extract standalone phone numbers not in links ---
    const phoneRegex =
      /(?:(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/g;
    const textNodes = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (text && phoneRegex.test(text)) {
        // Only if not inside an <a> tag
        let inAnchor = false;
        let parent = node.parentElement;
        while (parent && parent !== clone) {
          if (parent.tagName === "A") {
            inAnchor = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!inAnchor) {
          const container = node.parentElement;
          const section = findNearestHeading(container);
          const sectionPath = findHeadingPath(container);
          const context = getSectionContext(container);
          const phones = text.match(phoneRegex);
          for (const phone of phones) {
            const key = `phone:${phone}:${section}`;
            if (!seen.has(key)) {
              seen.add(key);
              resources.push({
                resource_url: `tel:${phone.replace(/[^\d+]/g, "")}`,
                link_text: phone,
                section,
                section_path: sectionPath,
                context,
                resource_type: "contact",
              });
            }
          }
        }
      }
    }

    return resources;
  });
}

// ---------------------------------------------------------------------------
// Build document content for a single resource
// ---------------------------------------------------------------------------

/**
 * Turns a raw extracted resource into a document string suitable for
 * embedding. The format is designed so that semantic search matches
 * on *what the resource is for* and *when to use it*.
 */
function buildDocumentContent(resource, pageTitle, pageUrl) {
  const lines = [];

  // Title line
  if (resource.link_text) {
    lines.push(`Resource: ${resource.link_text}`);
  }

  // URL
  if (resource.resource_url) {
    lines.push(`URL: ${resource.resource_url}`);
  }

  // Full section path (e.g. "Health Supervision > Sports")
  if (resource.section_path) {
    lines.push(`Section: ${resource.section_path}`);
  } else if (resource.section) {
    lines.push(`Topic: ${resource.section}`);
  }

  // Page it was found on
  lines.push(`Found on: ${pageTitle}`);
  lines.push(`Page: ${pageUrl}`);

  // Section context — includes all sibling resources and explanatory text
  // in the same section, giving the embedding much richer signal
  if (resource.context) {
    lines.push(`Context: ${resource.context}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

async function crawl() {
  console.log("=== PPC Website Crawler (Resource-Level) ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Max pages: ${MAX_PAGES === Infinity ? "unlimited" : MAX_PAGES}`);
  console.log();

  // ---- Supabase + embeddings setup ----
  let client, vectorStore;

  if (!DRY_RUN) {
    const requiredEnvVars = [
      "SUPABASE_URL",
      "SUPABASE_PRIVATE_KEY",
      "OPENAI_API_KEY",
    ];
    const missing = requiredEnvVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      console.error(
        "Missing required environment variables:",
        missing.join(", ")
      );
      process.exit(1);
    }

    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PRIVATE_KEY
    );

    vectorStore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });
  }

  // ---- Launch browser ----
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; ChatPPC-Crawler/2.0; +https://github.com/StanfordBDHG/ChatPPC)",
    viewport: { width: 1280, height: 720 },
  });

  const visited = new Set();
  const queue = [BASE_URL];
  const allDocuments = []; // { content, metadata } for all resources across all pages
  const allSourceKeys = new Set(); // track all source keys for stale cleanup
  const results = { pages: 0, resources: 0, errors: 0 };

  // ---- Process a single page ----
  async function processPage(url) {
    if (visited.has(url)) return;
    if (visited.size >= MAX_PAGES) return;
    visited.add(url);

    const page = await context.newPage();
    try {
      console.log(`\n[${visited.size}] Crawling: ${url}`);

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT,
      });
      await page.waitForTimeout(NAV_WAIT);

      // Expand accordions
      const expanded = await expandAccordions(page);
      if (expanded > 0) {
        console.log(`  Expanded ${expanded} accordion/collapsible elements`);
      }

      // Discover more pages to crawl
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => a.href)
      );
      for (const link of links) {
        const normalized = normalizePageUrl(link);
        if (normalized && !visited.has(normalized) && !queue.includes(normalized)) {
          queue.push(normalized);
        }
      }

      // Get page metadata
      const pageTitle = await page.title();

      // Extract all resources from this page
      const resources = await extractResources(page);
      console.log(`  Found ${resources.length} resources on page`);
      console.log(`  Page title: ${pageTitle}`);

      // Build documents for each resource
      for (const resource of resources) {
        const content = buildDocumentContent(resource, pageTitle, url);

        // Create a unique, stable source key for this resource
        // Using resource_url + section to make it unique per context
        const sourceKey = `ppc-resource:${resource.resource_url || "info"}:${getHash(
          `${resource.resource_url}:${resource.section}:${url}`
        ).substring(0, 12)}`;

        const hash = getHash(content);

        allSourceKeys.add(sourceKey);

        allDocuments.push({
          content,
          metadata: {
            source: sourceKey,
            hash,
            resource_url: resource.resource_url || null,
            link_text: resource.link_text || "",
            section: resource.section || "",
            section_path: resource.section_path || "",
            page_url: url,
            page_title: pageTitle,
            resource_type: resource.resource_type,
            crawled_at: new Date().toISOString(),
          },
        });
      }

      results.pages++;
      results.resources += resources.length;
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      results.errors++;
    } finally {
      await page.close();
    }
  }

  // ---- BFS crawl with concurrency ----
  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const batch = [];
    while (
      batch.length < CONCURRENCY &&
      queue.length > 0 &&
      visited.size + batch.length < MAX_PAGES
    ) {
      const url = queue.shift();
      if (!visited.has(url)) {
        batch.push(url);
      }
    }
    if (batch.length === 0) break;
    await Promise.all(batch.map((url) => processPage(url)));
  }

  await browser.close();

  // ---- Deduplicate resources across pages ----
  // The same link may appear on multiple pages. Keep the one with the most
  // context, keyed by resource_url.
  console.log(`\n--- Deduplicating resources ---`);
  const byResourceUrl = new Map();
  for (const doc of allDocuments) {
    const key = doc.metadata.resource_url;
    if (!key) {
      // Non-link resources: keep all
      byResourceUrl.set(doc.metadata.source, doc);
      continue;
    }
    const existing = byResourceUrl.get(key);
    if (!existing || doc.content.length > existing.content.length) {
      byResourceUrl.set(key, doc);
    }
  }
  const dedupedDocuments = [...byResourceUrl.values()];
  console.log(
    `  ${allDocuments.length} total → ${dedupedDocuments.length} after dedup`
  );

  // ---- Upsert to database ----
  if (DRY_RUN) {
    console.log(`\n--- DRY RUN: Sample of extracted resources ---`);
    for (const doc of dedupedDocuments.slice(0, 15)) {
      console.log(`\n  [${doc.metadata.resource_type}] ${doc.metadata.link_text}`);
      console.log(`  URL: ${doc.metadata.resource_url}`);
      console.log(`  Section: ${doc.metadata.section}`);
      console.log(`  Page: ${doc.metadata.page_url}`);
      console.log(`  Content length: ${doc.content.length} chars`);
    }
    if (dedupedDocuments.length > 15) {
      console.log(`\n  ... and ${dedupedDocuments.length - 15} more resources`);
    }
  } else {
    console.log(`\n--- Upserting ${dedupedDocuments.length} resources to Supabase ---`);

    // First, delete all old ppc-resource: entries in one go.
    // This is simpler and safer than per-resource change detection when the
    // source key scheme itself might have changed.
    console.log(`  Deleting old crawled resources...`);
    const { error: deleteError } = await client
      .from("documents")
      .delete()
      .like("metadata->>source", "ppc-resource:%");
    if (deleteError) {
      console.error(`  Warning: delete failed: ${deleteError.message}`);
    }

    // Also clean up any old ppc-crawl: entries from the previous crawler version
    await client
      .from("documents")
      .delete()
      .like("metadata->>source", "ppc-crawl:%");

    // Insert in batches
    let inserted = 0;
    for (let i = 0; i < dedupedDocuments.length; i += EMBED_BATCH_SIZE) {
      const batch = dedupedDocuments.slice(i, i + EMBED_BATCH_SIZE);

      const langchainDocs = batch.map((doc) => ({
        pageContent: doc.content,
        metadata: doc.metadata,
      }));

      try {
        await vectorStore.addDocuments(langchainDocs);
        inserted += batch.length;
        console.log(
          `  Embedded and stored batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1}/${Math.ceil(dedupedDocuments.length / EMBED_BATCH_SIZE)} (${inserted}/${dedupedDocuments.length})`
        );
      } catch (err) {
        console.error(
          `  Error on batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1}: ${err.message}`
        );
        // Retry one by one
        for (const doc of batch) {
          try {
            await vectorStore.addDocuments([
              { pageContent: doc.content, metadata: doc.metadata },
            ]);
            inserted++;
          } catch (e2) {
            console.error(`  Failed single doc: ${e2.message}`);
          }
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + EMBED_BATCH_SIZE < dedupedDocuments.length) {
        await sleep(500);
      }
    }

    console.log(`  Successfully stored ${inserted} resources`);
  }

  // ---- Summary ----
  console.log("\n=== Crawl Complete ===");
  console.log(`Pages visited:     ${results.pages}`);
  console.log(`Resources found:   ${results.resources}`);
  console.log(`After dedup:       ${dedupedDocuments.length}`);
  console.log(`Errors:            ${results.errors}`);

  if (DRY_RUN) {
    console.log("\n(Dry run — no database changes were made)");
  }
}

crawl().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
