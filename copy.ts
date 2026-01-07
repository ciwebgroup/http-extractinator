import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.181.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { rewriteHTMLSimple } from "./lib/url-rewriter.ts";

// Types for state management
interface SummaryState {
  version: string;
  startUrl: string;
  domains: string[];
  config: {
    throttle: number;
    concurrent: number;
    userAgent: string;
  };
  visitedPages: string[];
  crawlQueue: string[];
  assetQueue: string[];
  downloadedAssets: string[];
  failedDownloads: Array<{
    url: string;
    error: string;
    timestamp: string;
    type: "page" | "asset";
  }>;
  stats: {
    pagesProcessed: number;
    assetsDownloaded: number;
    assetsSkipped: number;
    totalFailures: number;
    startTime: string;
    lastSaveTime: string;
  };
  skippedDomains: string[];
}

// Parse arguments
const args = parse(Deno.args, {
  default: {
    throttle: 300,
    concurrent: 5,
    "max-pages": 0, // 0 = unlimited
    "skip-domains": "", // Comma-separated list of domains to skip
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
});

const startUrl = args._[1] as string;
if (!startUrl) {
  console.error("Please provide a URL to copy.");
  Deno.exit(1);
}

const allDomains: string[] = args._ as string[];
allDomains.shift();

// Parse skip domains
const skipDomains = new Set<string>();
if (args["skip-domains"]) {
  const skipList = (args["skip-domains"] as string).split(",").map((d) => d.trim().toLowerCase());
  skipList.forEach((d) => skipDomains.add(d));
}

const domain = new URL(startUrl).hostname;
const outputDir = `./sites/${domain}`;
const summaryPath = path.join(outputDir, ".summary.json");
const visitedPages = new Set<string>();
const downloadedAssets = new Set<string>();

await ensureDir(outputDir);
await ensureDir(path.join(outputDir, "assets/scripts"));
await ensureDir(path.join(outputDir, "assets/styles"));
await ensureDir(path.join(outputDir, "assets/images"));
await ensureDir(path.join(outputDir, "assets/fonts"));
await ensureDir(path.join(outputDir, "assets/icons"));

// State management
let summaryState: SummaryState;
const failedDownloads: SummaryState["failedDownloads"] = [];

// Save state to .summary.json
async function saveSummary() {
  summaryState.visitedPages = Array.from(visitedPages);
  summaryState.crawlQueue = crawlQueue.map((u) => u.href);
  summaryState.assetQueue = assetQueue.map((u) => u.href);
  summaryState.downloadedAssets = Array.from(downloadedAssets);
  summaryState.failedDownloads = failedDownloads;
  summaryState.stats.lastSaveTime = new Date().toISOString();
  
  await Deno.writeTextFile(summaryPath, JSON.stringify(summaryState, null, 2));
}

// Load state from .summary.json if it exists
async function loadSummary(): Promise<boolean> {
  try {
    const data = await Deno.readTextFile(summaryPath);
    const loaded: SummaryState = JSON.parse(data);
    
    // Verify it's the same configuration
    if (
      loaded.startUrl === startUrl &&
      JSON.stringify(loaded.domains.sort()) === JSON.stringify(allDomains.sort())
    ) {
      summaryState = loaded;
      
      // Restore state
      loaded.visitedPages.forEach((p) => visitedPages.add(p));
      loaded.downloadedAssets.forEach((a) => downloadedAssets.add(a));
      failedDownloads.push(...loaded.failedDownloads);
      
      console.log(`\x1b[36m📂 Resuming from previous session\x1b[0m`);
      console.log(`   Pages visited: ${loaded.visitedPages.length}`);
      console.log(`   Pages in queue: ${loaded.crawlQueue.length}`);
      console.log(`   Assets downloaded: ${loaded.downloadedAssets.length}`);
      console.log(`   Assets in queue: ${loaded.assetQueue.length}`);
      console.log(`   Failed downloads: ${loaded.failedDownloads.length}`);
      
      return true;
    }
  } catch {
    // File doesn't exist or is invalid, start fresh
  }
  
  return false;
}

// Initialize state
async function initializeSummary() {
  summaryState = {
    version: "1.0.0",
    startUrl,
    domains: allDomains,
    config: {
      throttle: args.throttle,
      concurrent: args.concurrent,
      userAgent: args["user-agent"],
    },
    visitedPages: [],
    crawlQueue: [startUrl],
    assetQueue: [],
    downloadedAssets: [],
    failedDownloads: [],
    stats: {
      pagesProcessed: 0,
      assetsDownloaded: 0,
      assetsSkipped: 0,
      totalFailures: 0,
      startTime: new Date().toISOString(),
      lastSaveTime: new Date().toISOString(),
    },
    skippedDomains: Array.from(skipDomains),
  };
}

// Check if a URL's domain should be skipped
function shouldSkipDomain(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  
  // Check exact match or subdomain match
  for (const skipDomain of skipDomains) {
    if (hostname === skipDomain || hostname.endsWith(`.${skipDomain}`)) {
      return true;
    }
  }
  
  return false;
}

// Log failed download
function logFailedDownload(url: string, error: string, type: "page" | "asset") {
  const failure = {
    url,
    error,
    timestamp: new Date().toISOString(),
    type,
  };
  failedDownloads.push(failure);
  summaryState.stats.totalFailures++;
  console.error(
    `\x1b[31m❌ Failed (${type})\x1b[0m: ${url}\n   Error: ${error}`
  );
}

// Sanitize filename function with double URL decoding
function sanitizeFilename(filename: string): string {
  // Decode double-encoded spaces and any other double-encoded characters
  return decodeURIComponent(filename)
    .toLowerCase()
    .replace(/%20|[\s]+/g, "-"); // Replace spaces with dashes
}

// Function to categorize assets by type based on extension
function getAssetType(url: URL): "scripts" | "styles" | "images" | "fonts" | "icons" | null {

  const extension = url.pathname.split(".").pop();

  if (extension) {
    if (["js"].includes(extension)) return "scripts";
    if (["css"].includes(extension)) return "styles";
    if (["avif", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(extension)) return "images";
    if (["woff", "woff2", "ttf", "otf", "eot"].includes(extension)) return "fonts";
    if (["ico"].includes(extension)) return "icons";
  }

  return null;
}

// Download and save an asset based on its type
async function downloadAsset(assetUrl: URL) {
  // Skip if domain is in the skip list
  if (shouldSkipDomain(assetUrl)) {
    summaryState.stats.assetsSkipped++;
    console.log(`\x1b[90m⊘ Skipped (domain)\x1b[0m: ${assetUrl.href}`);
    return;
  }

  // Skip if already downloaded
  if (downloadedAssets.has(assetUrl.href)) {
    return;
  }

  const assetType = getAssetType(assetUrl);
  if (!assetType) return;

  try {
    const response = await fetch(assetUrl.href, {
      headers: { "User-Agent": args["user-agent"] },
    });

    if (response.ok) {
      const data = new Uint8Array(await response.arrayBuffer());

      const savePath = path.join(
        outputDir,
        'assets',
        assetType,
        sanitizeFilename(path.basename(assetUrl.pathname))
      );

      await Deno.writeFile(savePath, data);
      downloadedAssets.add(assetUrl.href);
      summaryState.stats.assetsDownloaded++;

      console.log(`\x1b[32m✓ Downloaded\x1b[0m: ${assetUrl.href}`);

      if (assetType === "styles") {
        const cssText = new TextDecoder().decode(data);
        await discoverAssetsInCSS(cssText, assetUrl);
      }
    } else {
      logFailedDownload(
        assetUrl.href,
        `HTTP ${response.status}: ${response.statusText}`,
        "asset"
      );
    }
  } catch (error) {
    logFailedDownload(
      assetUrl.href,
      error instanceof Error ? error.message : String(error),
      "asset"
    );
  }
}

// Discover additional assets referenced in CSS files
async function discoverAssetsInCSS(cssText: string, baseUrl: URL) {
  const assetUrls = cssText.match(/url\(['"]?([^'")]+)['"]?\)/g) || [];
  for (const match of assetUrls) {
    try {
      const assetPath = match.replace(/url\(['"]?|['"]?\)/g, "");
      const assetUrl = new URL(assetPath, baseUrl);
      
      // Add to queue if not already downloaded or in queue
      if (!downloadedAssets.has(assetUrl.href) && !assetQueue.some((u) => u.href === assetUrl.href)) {
        assetQueue.push(assetUrl);
      }
    } catch (error) {
      // Invalid URL in CSS, skip it
      console.warn(`\x1b[33m⚠ Invalid URL in CSS\x1b[0m: ${match}`);
    }
  }
}

// Process a page, discover links and assets, enqueue them as needed
async function processPage(pageUrl: URL) {
  // Remove the fragment (if any) from the URL
  pageUrl.hash = "";

  if (visitedPages.has(pageUrl.href)) return; // Avoid duplicates

  visitedPages.add(pageUrl.href);

  try {
    const response = await fetch(pageUrl.href, {
      headers: { "User-Agent": args["user-agent"] },
    });

    if (!response.ok) {
      logFailedDownload(
        pageUrl.href,
        `HTTP ${response.status}: ${response.statusText}`,
        "page"
      );
      return;
    }

    let html = await response.text();

    await discoverLinksAndAssets(html, pageUrl);

  // Use url-rewriter module for comprehensive pattern-based URL rewriting
  // This handles all asset types: scripts, styles, images, fonts, icons, media
  // with 21 context-specific patterns that prevent cross-tag matching
  html = rewriteHTMLSimple(html, allDomains);
  
  // Normalize line endings
  html = html.replace(/\r\n|\r/g, "\n");

    // Determine save path, handling trailing slashes and no file extension
    let savePath: string;
    if (pageUrl.pathname.endsWith("/") || !path.extname(pageUrl.pathname)) {
      savePath = path.join(outputDir, pageUrl.pathname, "index.html");
    } else {
      savePath = path.join(outputDir, `${pageUrl.pathname}.html`);
    }

    await ensureDir(path.dirname(savePath));
    await Deno.writeTextFile(savePath, html);
    summaryState.stats.pagesProcessed++;
    
    console.log(`\x1b[32m✓ Saved page\x1b[0m: ${pageUrl.href}`);
  } catch (error) {
    logFailedDownload(
      pageUrl.href,
      error instanceof Error ? error.message : String(error),
      "page"
    );
  }
}

// Discover links and assets within HTML content
function discoverLinksAndAssets(html: string, baseUrl: URL) {
  const document = new DOMParser().parseFromString(html, "text/html");
  if (!document) return;

  // Enqueue linked pages
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      const absoluteUrl = new URL(href, baseUrl);
      if (
        absoluteUrl.hostname === domain &&
        !visitedPages.has(absoluteUrl.href)
      ) {
        crawlQueue.push(absoluteUrl);
      }
    }
  });

  // console.log('html', html);
  allDomains.forEach((url) => {
    
    const domain = new URL(url).hostname;

    // Updated to stop at query params and fragments, and include ) for CSS url()
    const allStaticAssetsRegExpString = `https?:\\/\\/(?:www\\.)?${domain}\\/[^\"'?#\\s>)]+\\.(css|png|avif|jpg|jpeg|gif|webp|svg|bmp|js|ico|woff2?|ttf|otf|eot)(?=['\"\\s>)?#])`;

    // console.log('allStaticAssetsRegExpString', allStaticAssetsRegExpString);

    const allStaticAssetsRegExp = new RegExp(allStaticAssetsRegExpString, "gi");        
    const allStaticAssets = html.match(allStaticAssetsRegExp) ?? [];

    // console.log('allStaticAssets', allStaticAssets);
   
    allStaticAssets.forEach((assetUrlString) => {
      try {
        const assetUrl = new URL(assetUrlString);
        
        // Skip if domain is in the skip list
        if (shouldSkipDomain(assetUrl)) {
          return;
        }
        
        if (!assetQueue.some((u) => u.href === assetUrl.href)) {
          assetQueue.push(assetUrl);
        }
      } catch (error) {
        // Invalid URL, skip it
        console.warn(`\x1b[33m⚠ Invalid URL\x1b[0m: ${assetUrlString}`);
      }
    });

  });


}

// Queues for pages to crawl and assets to download
let crawlQueue: URL[] = [];
let assetQueue: URL[] = [];

// Initialize or load state
const resumed = await loadSummary();
if (resumed) {
  // Restore queues from saved state
  crawlQueue = summaryState.crawlQueue.map((href) => new URL(href));
  assetQueue = summaryState.assetQueue.map((href) => new URL(href));
} else {
  // Start fresh
  await initializeSummary();
  crawlQueue = [new URL(startUrl)];
}

console.log(`\x1b[36m🚀 Starting extraction\x1b[0m`);
console.log(`   URL: ${startUrl}`);
console.log(`   Additional domains: ${allDomains.length}`);
if (skipDomains.size > 0) {
  console.log(`   Skip domains: ${Array.from(skipDomains).join(", ")}`);
}
console.log(`   Throttle: ${args.throttle}ms`);
console.log(`   Concurrent: ${args.concurrent}`);
console.log(`   Max pages: ${args["max-pages"] === 0 ? "unlimited" : args["max-pages"]}\n`);

// Process each page in the crawl queue
let saveCounter = 0;
const SAVE_INTERVAL = 10; // Save state every 10 operations
const maxPages = args["max-pages"] as number;

while (crawlQueue.length > 0) {
  // Check if we've reached the max pages limit
  if (maxPages > 0 && summaryState.stats.pagesProcessed >= maxPages) {
    console.log(`\n\x1b[33m⚠️  Reached max pages limit (${maxPages}). Stopping crawl.\x1b[0m\n`);
    break;
  }

  const pageUrl = crawlQueue.shift();
  if (pageUrl) {
    await processPage(pageUrl);
    
    // Save state periodically
    saveCounter++;
    if (saveCounter >= SAVE_INTERVAL) {
      await saveSummary();
      saveCounter = 0;
    }
  }
}

console.log(`\n\x1b[36m📦 Downloading ${assetQueue.length} assets...\x1b[0m\n`);

// Process each asset in the asset queue
while (assetQueue.length > 0) {
  const assetUrl = assetQueue.shift();
  if (assetUrl) {
    await downloadAsset(assetUrl);
    
    // Save state periodically
    saveCounter++;
    if (saveCounter >= SAVE_INTERVAL) {
      await saveSummary();
      saveCounter = 0;
    }
  }
}

// Final save
await saveSummary();

// Print summary
console.log(`\n\x1b[36m═══════════════════════════════════════════\x1b[0m`);
console.log(`\x1b[32m✅ Extraction Complete!\x1b[0m`);
console.log(`\x1b[36m═══════════════════════════════════════════\x1b[0m`);
console.log(`   Pages processed: ${summaryState.stats.pagesProcessed}`);
console.log(`   Assets downloaded: ${summaryState.stats.assetsDownloaded}`);
if (summaryState.stats.assetsSkipped > 0) {
  console.log(`   Assets skipped: ${summaryState.stats.assetsSkipped}`);
}
console.log(`   Total failures: ${summaryState.stats.totalFailures}`);
console.log(`   Output directory: ${outputDir}`);

if (failedDownloads.length > 0) {
  console.log(`\n\x1b[33m⚠ Failed Downloads (${failedDownloads.length}):\x1b[0m`);
  console.log(`   See ${summaryPath} for details`);
  
  // Show first 5 failures
  const showCount = Math.min(5, failedDownloads.length);
  for (let i = 0; i < showCount; i++) {
    const fail = failedDownloads[i];
    console.log(`   ${i + 1}. [${fail.type}] ${fail.url}`);
    console.log(`      ${fail.error}`);
  }
  if (failedDownloads.length > 5) {
    console.log(`   ... and ${failedDownloads.length - 5} more`);
  }
}

console.log(`\x1b[36m═══════════════════════════════════════════\x1b[0m\n`);

