/**
 * URL Rewrite Simulator
 * 
 * Downloads a URL and its assets to a temporary directory,
 * then shows all regex replacements for debugging purposes.
 * 
 * Usage: deno task simulate <url>
 * Example: deno task simulate https://www.example.com
 */

import * as path from "jsr:@std/path@1";
import {
  rewriteHTML,
  formatReport,
  type RewriteResult,
  type RewriteMatch,
} from "./lib/url-rewriter.ts";

// ============================================================================
// COLOR OUTPUT
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// ============================================================================
// DOMAIN EXTRACTION
// ============================================================================

/**
 * Extract all domains referenced in HTML content
 */
function extractDomains(html: string, baseUrl: string): string[] {
  const domains = new Set<string>();
  const baseHostname = new URL(baseUrl).hostname;
  
  // Add base domain
  domains.add(`https://${baseHostname}`);
  domains.add(`https://www.${baseHostname}`);
  
  // Find all URLs in the HTML
  const urlPattern = /https?:\/\/([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/gi;
  const matches = html.match(urlPattern) || [];
  
  for (const match of matches) {
    try {
      const url = new URL(match);
      // Include CDN domains that likely serve assets
      if (
        url.hostname.includes("cdn") ||
        url.hostname.includes("static") ||
        url.hostname === baseHostname ||
        url.hostname === `www.${baseHostname}`
      ) {
        domains.add(`https://${url.hostname}`);
      }
    } catch {
      // Ignore malformed URLs
    }
  }
  
  return Array.from(domains);
}

/**
 * Extract asset URLs from HTML for downloading
 */
function extractAssetUrls(html: string, baseUrl: string): { css: string[]; js: string[] } {
  const css: string[] = [];
  const js: string[] = [];
  
  // Extract CSS URLs
  const cssPattern = /href=["']([^"']+\.css(?:\?[^"']*)?)/gi;
  let match;
  while ((match = cssPattern.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url) css.push(url);
  }
  
  // Extract JS URLs
  const jsPattern = /src=["']([^"']+\.(?:js|mjs|cjs)(?:\?[^"']*)?)/gi;
  while ((match = jsPattern.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url) js.push(url);
  }
  
  return { css: [...new Set(css)], js: [...new Set(js)] };
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    const base = new URL(baseUrl);
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

// ============================================================================
// FILE DOWNLOAD
// ============================================================================

/**
 * Download content from URL with retry
 */
async function downloadContent(url: string): Promise<string | null> {
  const maxRetries = 3;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
      
      if (!response.ok) {
        log(colors.yellow, "⚠", `HTTP ${response.status} for ${url}`);
        return null;
      }
      
      return await response.text();
    } catch (error) {
      if (i === maxRetries - 1) {
        log(colors.red, "✗", `Failed to download ${url}: ${(error as Error).message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  
  return null;
}

// ============================================================================
// MAIN SIMULATION
// ============================================================================

async function simulate(targetUrl: string) {
  console.log("\n" + colors.bright + "═".repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + "  URL REWRITE SIMULATOR" + colors.reset);
  console.log(colors.bright + "═".repeat(80) + colors.reset);
  console.log();
  
  log(colors.blue, "🌐", `Target URL: ${targetUrl}`);
  
  // Create temporary directory
  const tempDir = await Deno.makeTempDir({ prefix: "extractinator_" });
  log(colors.dim, "📁", `Temp directory: ${tempDir}`);
  
  try {
    // Download HTML
    log(colors.blue, "📥", "Downloading HTML...");
    const html = await downloadContent(targetUrl);
    
    if (!html) {
      log(colors.red, "✗", "Failed to download HTML");
      Deno.exit(1);
    }
    
    log(colors.green, "✓", `Downloaded ${html.length.toLocaleString()} bytes`);
    
    // Save original HTML
    const originalHtmlPath = path.join(tempDir, "original.html");
    await Deno.writeTextFile(originalHtmlPath, html);
    
    // Extract domains from HTML
    log(colors.blue, "🔍", "Extracting domains...");
    const domains = extractDomains(html, targetUrl);
    console.log();
    log(colors.cyan, "🌐", "Domains found:");
    domains.forEach((d) => console.log(`     ${d}`));
    console.log();
    
    // Extract asset URLs
    const assetUrls = extractAssetUrls(html, targetUrl);
    log(colors.cyan, "📦", `Found ${assetUrls.css.length} CSS files, ${assetUrls.js.length} JS files`);
    
    // Download CSS files
    if (assetUrls.css.length > 0) {
      log(colors.blue, "📥", "Downloading CSS files...");
      const cssDir = path.join(tempDir, "css");
      await Deno.mkdir(cssDir, { recursive: true });
      
      for (const cssUrl of assetUrls.css.slice(0, 10)) {
        const filename = path.basename(new URL(cssUrl).pathname) || "style.css";
        const content = await downloadContent(cssUrl);
        if (content) {
          await Deno.writeTextFile(path.join(cssDir, filename), content);
          log(colors.dim, "  ✓", filename);
        }
      }
    }
    
    // Download JS files
    if (assetUrls.js.length > 0) {
      log(colors.blue, "📥", "Downloading JS files (first 10)...");
      const jsDir = path.join(tempDir, "js");
      await Deno.mkdir(jsDir, { recursive: true });
      
      for (const jsUrl of assetUrls.js.slice(0, 10)) {
        const filename = path.basename(new URL(jsUrl).pathname) || "script.js";
        const content = await downloadContent(jsUrl);
        if (content) {
          await Deno.writeTextFile(path.join(jsDir, filename), content);
          log(colors.dim, "  ✓", filename);
        }
      }
    }
    
    console.log();
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log(colors.bright + colors.magenta + "  APPLYING URL REWRITES (using lib/url-rewriter.ts)" + colors.reset);
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log();
    
    // Apply URL rewriting using the shared module
    const result: RewriteResult = rewriteHTML(html, domains);
    
    // Save processed HTML
    const processedHtmlPath = path.join(tempDir, "processed.html");
    await Deno.writeTextFile(processedHtmlPath, result.html);
    
    // Print the report
    console.log(formatReport(result));
    
    // Print match table
    if (result.matches.length > 0) {
      console.log();
      console.log(colors.bright + "─".repeat(80) + colors.reset);
      console.log(colors.bright + colors.yellow + "  DETAILED REPLACEMENTS" + colors.reset);
      console.log(colors.bright + "─".repeat(80) + colors.reset);
      console.log();
      
      // Group by pattern
      const byPattern = new Map<string, RewriteMatch[]>();
      for (const match of result.matches) {
        const existing = byPattern.get(match.pattern) || [];
        existing.push(match);
        byPattern.set(match.pattern, existing);
      }
      
      for (const [pattern, matches] of byPattern.entries()) {
        console.log(colors.cyan + `\n📋 ${pattern} (${matches.length} replacements)` + colors.reset);
        console.log("─".repeat(60));
        
        for (const match of matches.slice(0, 5)) {
          console.log(colors.red + "  - " + match.original.substring(0, 70) + colors.reset);
          console.log(colors.green + "  + " + match.rewritten.substring(0, 70) + colors.reset);
          console.log();
        }
        
        if (matches.length > 5) {
          console.log(colors.dim + `  ... and ${matches.length - 5} more` + colors.reset);
        }
      }
    }
    
    // Validation comparison
    console.log();
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log(colors.bright + colors.green + "  VALIDATION COMPARISON" + colors.reset);
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log();
    
    const beforeErrors = result.validationBefore.errors.length;
    const afterErrors = result.validationAfter.errors.length;
    const newErrors = afterErrors - beforeErrors;
    
    console.log(`  ${colors.cyan}Errors Before:${colors.reset}  ${beforeErrors}`);
    console.log(`  ${colors.cyan}Errors After:${colors.reset}   ${afterErrors}`);
    
    if (newErrors > 0) {
      console.log(`  ${colors.bgRed}${colors.white} NEW ERRORS: ${newErrors} ${colors.reset}`);
    } else if (newErrors < 0) {
      console.log(`  ${colors.bgGreen}${colors.white} FIXED: ${Math.abs(newErrors)} ${colors.reset}`);
    } else {
      console.log(`  ${colors.green}✓ No new errors introduced${colors.reset}`);
    }
    
    if (result.validationAfter.errors.length > 0) {
      console.log();
      console.log(colors.yellow + "  Validation errors:" + colors.reset);
      result.validationAfter.errors.forEach((err) => {
        console.log(colors.dim + `    • ${err}` + colors.reset);
      });
    }
    
    // Tag count comparison table
    console.log();
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log(colors.bright + colors.blue + "  TAG COUNT COMPARISON" + colors.reset);
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log();
    
    const importantTags = ["html", "head", "body", "div", "span", "img", "script", "link", "style", "meta", "a", "p", "video", "audio", "source", "picture", "svg", "form", "input"];
    
    console.log("  ┌─────────────┬─────────┬─────────┬─────────┐");
    console.log("  │    Tag      │ Before  │  After  │  Diff   │");
    console.log("  ├─────────────┼─────────┼─────────┼─────────┤");
    
    for (const tag of importantTags) {
      const before = result.tagCountBefore[tag] || 0;
      const after = result.tagCountAfter[tag] || 0;
      if (before > 0 || after > 0) {
        const diff = after - before;
        const diffStr = diff === 0 ? "  ✓  " : diff > 0 ? ` +${diff}  `.padStart(6) : ` ${diff}  `.padStart(6);
        const diffColor = diff === 0 ? colors.green : diff > 0 ? colors.yellow : colors.red;
        console.log(`  │ ${tag.padEnd(11)} │ ${String(before).padStart(7)} │ ${String(after).padStart(7)} │${diffColor}${diffStr}${colors.reset}│`);
      }
    }
    
    console.log("  └─────────────┴─────────┴─────────┴─────────┘");
    
    // Summary table of matches vs replacements
    console.log();
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log(colors.bright + colors.magenta + "  MATCHES vs REPLACEMENTS" + colors.reset);
    console.log(colors.bright + "─".repeat(80) + colors.reset);
    console.log();
    
    console.log("  ┌─────────────────────────────────┬──────────┬──────────────┬─────────┐");
    console.log("  │           Pattern               │ Matches  │ Replacements │ Success │");
    console.log("  ├─────────────────────────────────┼──────────┼──────────────┼─────────┤");
    
    for (const [name, stats] of Object.entries(result.summary.byPattern)) {
      if (stats.matches > 0) {
        const success = stats.matches > 0 ? ((stats.replacements / stats.matches) * 100).toFixed(0) + "%" : "N/A";
        const successColor = stats.replacements === stats.matches ? colors.green : colors.yellow;
        console.log(`  │ ${name.padEnd(31)} │ ${String(stats.matches).padStart(8)} │ ${String(stats.replacements).padStart(12)} │${successColor}${success.padStart(8)}${colors.reset} │`);
      }
    }
    
    console.log("  ├─────────────────────────────────┼──────────┼──────────────┼─────────┤");
    const totalSuccess = result.summary.totalMatches > 0 
      ? ((result.summary.totalReplacements / result.summary.totalMatches) * 100).toFixed(0) + "%"
      : "N/A";
    console.log(`  │ ${colors.bright}TOTAL${colors.reset}                           │ ${String(result.summary.totalMatches).padStart(8)} │ ${String(result.summary.totalReplacements).padStart(12)} │${colors.green}${totalSuccess.padStart(8)}${colors.reset} │`);
    console.log("  └─────────────────────────────────┴──────────┴──────────────┴─────────┘");
    
    // Final summary
    console.log();
    console.log(colors.bright + "═".repeat(80) + colors.reset);
    console.log();
    
    const passed = newErrors <= 0;
    if (passed) {
      log(colors.green, "✅", `SIMULATION PASSED - ${result.summary.totalReplacements}/${result.summary.totalMatches} URLs rewritten`);
    } else {
      log(colors.red, "❌", `SIMULATION FAILED - ${newErrors} new errors introduced`);
    }
    
    console.log();
    log(colors.dim, "📁", `Files saved to: ${tempDir}`);
    log(colors.dim, "  ", `original.html - Original HTML`);
    log(colors.dim, "  ", `processed.html - Rewritten HTML`);
    console.log();
    
    return {
      passed,
      tempDir,
      result,
    };
    
  } catch (error) {
    log(colors.red, "✗", `Error: ${(error as Error).message}`);
    console.error(error);
    Deno.exit(1);
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (import.meta.main) {
  const url = Deno.args[0];
  
  if (!url) {
    console.log(`
${colors.cyan}URL Rewrite Simulator${colors.reset}

Crawls a URL, downloads it to a temporary directory, and shows all
regex replacements for debugging URL rewriting patterns.

Uses the same patterns as lib/url-rewriter.ts (21 context-specific patterns).

${colors.bright}Usage:${colors.reset}
  deno task simulate <url>

${colors.bright}Examples:${colors.reset}
  deno task simulate https://www.example.com
  deno task simulate https://www.designroofservicesllc.com

${colors.bright}Output:${colors.reset}
  - Downloads HTML, CSS, and JS files to a temp directory
  - Shows all regex pattern matches and replacements
  - Displays before/after tag counts
  - Shows validation errors (before/after)
  - Provides a summary table of matches vs replacements
`);
    Deno.exit(0);
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    log(colors.red, "✗", `Invalid URL: ${url}`);
    Deno.exit(1);
  }
  
  await simulate(url);
}

export { simulate };
