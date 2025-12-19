/**
 * Regex Testing Suite for URL Rewriting
 * Tests all regex patterns against testme.html to ensure proper URL rewriting
 */

import * as path from "jsr:@std/path@1";

interface TestResult {
  pattern: string;
  description: string;
  found: number;
  fixed: number;
  failed: string[];
  examples: string[];
}

// Read the test HTML file
const testFile = await Deno.readTextFile("./test/testme.html");

// Define all domains to test
const allDomains = [
  "https://www.designroofservicesllc.com/",
  "https://irp.cdn-website.com",
  "https://lirp.cdn-website.com",
  "https://static.cdn-website.com",
];

const results: TestResult[] = [];

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  return filename.replace(/ /g, "+").replace(/%20/g, "+");
}

console.log("\n🧪 Starting Regex URL Rewriting Tests\n");
console.log("=" .repeat(80));

// Start with the test file content
let html = testFile;

// Test each domain's URL rewriting patterns
for (const domainUrl of allDomains) {
  const domain = new URL(domainUrl).hostname;
  console.log(`\n📍 Testing domain: ${domain}\n`);

  // Test 1: Image src attributes
  {
    const pattern = `src=["'](https?:\\/\\/(?:www\\.)?${domain}\\/[^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))["']`;
    const regex = new RegExp(pattern, "gi");
    const matches = testFile.match(regex) || [];
    
    html = html.replace(
      regex,
      (_, url) => `src="/assets/images/${sanitizeFilename(path.basename(url))}"`
    );

    results.push({
      pattern: "Image src attributes",
      description: `src="https://${domain}/path/image.jpg"`,
      found: matches.length,
      fixed: matches.length,
      failed: [],
      examples: matches.slice(0, 3),
    });
  }

  // Test 2: Image srcset attributes
  {
    const pattern = `srcset=["']((https?:\\/\\/(?:www\\.)?${domain}\\/[^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\\s\\d+w)?,?\\s*)+)["']`;
    const regex = new RegExp(pattern, "gi");
    const matches = testFile.match(regex) || [];
    
    html = html.replace(regex, (_, srcset) => {
      const updatedSrcset = srcset
        .split(",")
        .map((entry: string) => {
          const [url, size] = entry.trim().split(/\s+/);
          const filename = sanitizeFilename(path.basename(url));
          return `/assets/images/${filename} ${size || ""}`.trim();
        })
        .join(", ");
      return `srcset="${updatedSrcset}"`;
    });

    results.push({
      pattern: "Image srcset attributes",
      description: `srcset="https://${domain}/path/img.jpg 640w, ..."`,
      found: matches.length,
      fixed: matches.length,
      failed: [],
      examples: matches.slice(0, 2),
    });
  }

  // Test 3: General images in any context (catches more cases)
  {
    const pattern = `https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))(?=['"\\s>)?#])`;
    const regex = new RegExp(pattern, "g");
    const beforeMatches = html.match(regex) || [];
    
    html = html.replace(
      regex,
      (_, filename) => `/assets/images/${sanitizeFilename(filename)}`
    );

    const afterMatches = html.match(regex) || [];

    results.push({
      pattern: "Images (general context)",
      description: `Any https://${domain}/.../image.jpg reference`,
      found: beforeMatches.length,
      fixed: beforeMatches.length - afterMatches.length,
      failed: afterMatches,
      examples: beforeMatches.slice(0, 3),
    });
  }

  // Test 4: JavaScript files
  {
    const pattern = `https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(js))(?=['"\\s>)?#])`;
    const regex = new RegExp(pattern, "g");
    const beforeMatches = html.match(regex) || [];
    
    html = html.replace(
      regex,
      (_, filename) => `/assets/scripts/${sanitizeFilename(filename)}`
    );

    const afterMatches = html.match(regex) || [];

    results.push({
      pattern: "JavaScript files",
      description: `https://${domain}/.../script.js`,
      found: beforeMatches.length,
      fixed: beforeMatches.length - afterMatches.length,
      failed: afterMatches,
      examples: beforeMatches.slice(0, 3),
    });
  }

  // Test 5: CSS files
  {
    const pattern = `https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(css))(?=['"\\s>)?#])`;
    const regex = new RegExp(pattern, "g");
    const beforeMatches = html.match(regex) || [];
    
    html = html.replace(
      regex,
      (_, filename) => `/assets/styles/${sanitizeFilename(filename)}`
    );

    const afterMatches = html.match(regex) || [];

    results.push({
      pattern: "CSS files",
      description: `https://${domain}/.../style.css`,
      found: beforeMatches.length,
      fixed: beforeMatches.length - afterMatches.length,
      failed: afterMatches,
      examples: beforeMatches.slice(0, 3),
    });
  }

  // Test 6: Font files
  {
    const pattern = `https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(woff|woff2|ttf|otf|eot))(?=['"\\s>)?#])`;
    const regex = new RegExp(pattern, "g");
    const beforeMatches = html.match(regex) || [];
    
    html = html.replace(
      regex,
      (_, filename) => `/assets/fonts/${sanitizeFilename(filename)}`
    );

    const afterMatches = html.match(regex) || [];

    results.push({
      pattern: "Font files",
      description: `https://${domain}/.../font.woff`,
      found: beforeMatches.length,
      fixed: beforeMatches.length - afterMatches.length,
      failed: afterMatches,
      examples: beforeMatches.slice(0, 3),
    });
  }

  // Test 7: Icon files
  {
    const pattern = `https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(ico))(?=['"\\s>)?#])`;
    const regex = new RegExp(pattern, "g");
    const beforeMatches = html.match(regex) || [];
    
    html = html.replace(
      regex,
      (_, filename) => `/assets/icons/${sanitizeFilename(filename)}`
    );

    const afterMatches = html.match(regex) || [];

    results.push({
      pattern: "Icon files",
      description: `https://${domain}/.../favicon.ico`,
      found: beforeMatches.length,
      fixed: beforeMatches.length - afterMatches.length,
      failed: afterMatches,
      examples: beforeMatches.slice(0, 3),
    });
  }
}

// Print results
console.log("\n" + "=".repeat(80));
console.log("\n📊 TEST RESULTS SUMMARY\n");

let totalFound = 0;
let totalFixed = 0;
let totalFailed = 0;

for (const result of results) {
  totalFound += result.found;
  totalFixed += result.fixed;
  totalFailed += result.failed.length;

  const status = result.failed.length === 0 ? "✅ PASS" : "❌ FAIL";
  const percentage = result.found > 0 
    ? ((result.fixed / result.found) * 100).toFixed(1) 
    : "0.0";

  console.log(`${status} ${result.pattern}`);
  console.log(`   Description: ${result.description}`);
  console.log(`   Found: ${result.found} | Fixed: ${result.fixed} | Failed: ${result.failed.length} (${percentage}% success)`);
  
  if (result.examples.length > 0) {
    console.log(`   Examples:`);
    result.examples.forEach((ex, i) => {
      console.log(`     ${i + 1}. ${ex.substring(0, 80)}${ex.length > 80 ? "..." : ""}`);
    });
  }
  
  if (result.failed.length > 0) {
    console.log(`   ⚠️  Still remaining (not fixed):`);
    result.failed.slice(0, 5).forEach((fail, i) => {
      console.log(`     ${i + 1}. ${fail}`);
    });
    if (result.failed.length > 5) {
      console.log(`     ... and ${result.failed.length - 5} more`);
    }
  }
  
  console.log("");
}

console.log("=".repeat(80));
console.log(`\n🎯 FINAL SCORE: ${totalFixed}/${totalFound} URLs rewritten successfully`);
console.log(`   Success Rate: ${totalFound > 0 ? ((totalFixed / totalFound) * 100).toFixed(1) : 0}%`);
console.log(`   Remaining Issues: ${totalFailed}\n`);

// Check for any remaining CDN URLs in the processed HTML
const remainingCDNUrls: string[] = [];
for (const domainUrl of allDomains) {
  const domain = new URL(domainUrl).hostname.replace(/\./g, "\\.");
  const cdnPattern = new RegExp(`https?:\\/\\/(?:www\\.)?${domain}`, "g");
  const matches = html.match(cdnPattern) || [];
  remainingCDNUrls.push(...matches);
}

if (remainingCDNUrls.length > 0) {
  console.log("⚠️  WARNING: Found remaining CDN URLs that were not rewritten:");
  console.log(`   Total: ${remainingCDNUrls.length} unrewritten URLs\n`);
  
  const uniqueUrls = [...new Set(remainingCDNUrls)];
  uniqueUrls.slice(0, 10).forEach((url, i) => {
    // Find context around the URL
    const index = html.indexOf(url);
    const context = html.substring(Math.max(0, index - 30), Math.min(html.length, index + url.length + 30));
    console.log(`   ${i + 1}. ...${context}...`);
  });
  
  if (uniqueUrls.length > 10) {
    console.log(`   ... and ${uniqueUrls.length - 10} more unique URLs\n`);
  }
}

// Save the processed HTML for inspection
await Deno.writeTextFile("./test/testme-processed.html", html);
console.log("💾 Processed HTML saved to: test/testme-processed.html\n");

// Exit with error code if there are failures
if (totalFailed > 0 || remainingCDNUrls.length > 0) {
  console.log("❌ Tests failed. Please review the regex patterns in copy.ts\n");
  Deno.exit(1);
} else {
  console.log("✅ All tests passed!\n");
  Deno.exit(0);
}

