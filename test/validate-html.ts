/**
 * HTML Validation Test
 * Downloads a live page, applies regex replacements, and validates that no NEW HTML errors are introduced
 */

import * as path from "jsr:@std/path@1";

// Get URL from command line args, default to designroofservicesllc.com
const testUrl = Deno.args[0] || "https://www.designroofservicesllc.com";

console.log("\n🧪 HTML Validation Test - Before/After Regex Application\n");
console.log("=" .repeat(80));
console.log(`\n📥 Downloading: ${testUrl}\n`);

// Download the page using fetch (Deno's built-in, no need for wget)
let originalHtml: string;
try {
  const response = await fetch(testUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    }
  });
  
  if (!response.ok) {
    console.error(`❌ Failed to download: HTTP ${response.status}`);
    Deno.exit(1);
  }
  
  originalHtml = await response.text();
  console.log(`✅ Downloaded ${originalHtml.length} bytes\n`);
} catch (error) {
  console.error(`❌ Download error: ${error.message}`);
  Deno.exit(1);
}

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  return filename.replace(/ /g, "+").replace(/%20/g, "+");
}

// Get the domain from the URL
const urlObj = new URL(testUrl);
const mainDomain = urlObj.hostname;

// Define all domains to process (you can extend this list)
const allDomains = [
  `https://${mainDomain}`,
  "https://irp.cdn-website.com",
  "https://lirp.cdn-website.com",
  "https://static.cdn-website.com",
  "https://irt-cdn.multiscreensite.com",
  "https://dd-cdn.multiscreensite.com",
];

console.log("🔄 Applying regex replacements...\n");

// Apply the same regex patterns as copy.ts
let processedHtml = originalHtml;

allDomains.forEach((domainUrl) => {
  const domain = new URL(domainUrl).hostname.replace(/\./g, "\\.");

  // Replace image src attributes
  processedHtml = processedHtml.replace(
    new RegExp(`src=["'](https?:\\/\\/(?:www\\.)?${domain}\\/[^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))["']`, "gi"),
    (_, url) => `src="/assets/images/${sanitizeFilename(path.basename(url))}"`
  );

  // Replace image srcset attributes
  processedHtml = processedHtml.replace(
    new RegExp(`srcset=["']((https?:\\/\\/(?:www\\.)?${domain}\\/[^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\\s\\d+w)?,?\\s*)+)["']`, "gi"),
    (_, srcset) => {
      const updatedSrcset = srcset
        .split(",")
        .map((entry: string) => {
          const [url, size] = entry.trim().split(/\s+/);
          const filename = sanitizeFilename(path.basename(url));
          return `/assets/images/${filename} ${size || ""}`.trim();
        })
        .join(", ");
      return `srcset="${updatedSrcset}"`;
    }
  );

  // Replace general image URLs
  processedHtml = processedHtml.replace(
    new RegExp(`https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))(?=['"\\s>)?#])`, "g"),
    (_, filename) => `/assets/images/${sanitizeFilename(filename)}`
  );

  // Replace JavaScript files
  processedHtml = processedHtml.replace(
    new RegExp(`https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(js))(?=['"\\s>)?#])`, "g"),
    (_, filename) => `/assets/scripts/${sanitizeFilename(filename)}`
  );

  // Replace CSS files
  processedHtml = processedHtml.replace(
    new RegExp(`https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(css))(?=['"\\s>)?#])`, "g"),
    (_, filename) => `/assets/styles/${sanitizeFilename(filename)}`
  );

  // Replace Font files
  processedHtml = processedHtml.replace(
    new RegExp(`https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(woff|woff2|ttf|otf|eot))(?=['"\\s>)?#])`, "g"),
    (_, filename) => `/assets/fonts/${sanitizeFilename(filename)}`
  );

  // Replace Icon files
  processedHtml = processedHtml.replace(
    new RegExp(`https?:\\/\\/(?:www\\.)?${domain}\\/(?:[^\\/]+\\/)*([^"'?#\\s>)/]+\\.(ico))(?=['"\\s>)?#])`, "g"),
    (_, filename) => `/assets/icons/${sanitizeFilename(filename)}`
  );
});

console.log(`✅ Regex replacements applied\n`);

// Save both versions for inspection
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const originalFile = `./test/validation-original-${timestamp}.html`;
const processedFile = `./test/validation-processed-${timestamp}.html`;

await Deno.writeTextFile(originalFile, originalHtml);
await Deno.writeTextFile(processedFile, processedHtml);

console.log(`💾 Saved files for inspection:`);
console.log(`   Original:  ${originalFile}`);
console.log(`   Processed: ${processedFile}\n`);

// Validate HTML structure
console.log("🔍 Validating HTML structure...\n");

function validateHTML(html: string, label: string): { errors: string[], warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for unclosed tags
  const tagPattern = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
  const closingTagPattern = /<\/([a-z][a-z0-9]*)\s*>/gi;
  
  const openTags: { [key: string]: number } = {};
  const closeTags: { [key: string]: number } = {};
  
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    // Skip self-closing tags
    if (match[0].endsWith("/>") || ["img", "br", "hr", "input", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"].includes(tag)) {
      continue;
    }
    openTags[tag] = (openTags[tag] || 0) + 1;
  }
  
  while ((match = closingTagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    closeTags[tag] = (closeTags[tag] || 0) + 1;
  }
  
  // Compare open and close tags
  const allTags = new Set([...Object.keys(openTags), ...Object.keys(closeTags)]);
  for (const tag of allTags) {
    const open = openTags[tag] || 0;
    const close = closeTags[tag] || 0;
    if (open !== close) {
      errors.push(`Tag mismatch: <${tag}> opened ${open} times, closed ${close} times (diff: ${open - close})`);
    }
  }
  
  // Check for broken attributes (quotes not closed)
  const brokenAttrPattern = /\s+\w+=(["'])[^"']*$/gm;
  let brokenAttrs = 0;
  while (brokenAttrPattern.exec(html) !== null) {
    brokenAttrs++;
  }
  if (brokenAttrs > 0) {
    errors.push(`Found ${brokenAttrs} potentially unclosed attribute quotes`);
  }
  
  // Check for orphaned closing tags in attributes
  const orphanedQuotes = (html.match(/src=["'][^"']*["']\s+["']/g) || []).length;
  if (orphanedQuotes > 0) {
    warnings.push(`Found ${orphanedQuotes} potential orphaned quotes after attributes`);
  }
  
  // Check for malformed URLs (multiple protocols)
  const doubleProtocol = (html.match(/https?:\/\/[^"'\s]*https?:\/\//g) || []).length;
  if (doubleProtocol > 0) {
    errors.push(`Found ${doubleProtocol} URLs with double protocols (nested URLs)`);
  }
  
  // Check for asset paths with domain still in them (double slash issue)
  const doubleSlashAssets = (html.match(/\/assets\/[a-z]+\/\/[a-z.-]+\.com/g) || []).length;
  if (doubleSlashAssets > 0) {
    errors.push(`Found ${doubleSlashAssets} asset paths with domain remnants (/assets/type//domain.com/...)`);
  }
  
  // Check for broken script/style tags
  const unclosedScripts = (html.match(/<script[^>]*>[^<]*$/gm) || []).length;
  if (unclosedScripts > 0) {
    errors.push(`Found ${unclosedScripts} potentially unclosed <script> tags`);
  }
  
  return { errors, warnings };
}

// Validate both versions
console.log("=" .repeat(80));
console.log("\n📊 VALIDATION RESULTS\n");

const originalValidation = validateHTML(originalHtml, "Original");
const processedValidation = validateHTML(processedHtml, "Processed");

console.log("🔵 ORIGINAL HTML:");
if (originalValidation.errors.length === 0) {
  console.log("   ✅ No errors detected");
} else {
  console.log(`   ⚠️  Found ${originalValidation.errors.length} errors:`);
  originalValidation.errors.forEach((err, i) => {
    console.log(`   ${i + 1}. ${err}`);
  });
}
if (originalValidation.warnings.length > 0) {
  console.log(`   ⚠️  Found ${originalValidation.warnings.length} warnings:`);
  originalValidation.warnings.forEach((warn, i) => {
    console.log(`   ${i + 1}. ${warn}`);
  });
}

console.log("\n🟢 PROCESSED HTML:");
if (processedValidation.errors.length === 0) {
  console.log("   ✅ No errors detected");
} else {
  console.log(`   ⚠️  Found ${processedValidation.errors.length} errors:`);
  processedValidation.errors.forEach((err, i) => {
    console.log(`   ${i + 1}. ${err}`);
  });
}
if (processedValidation.warnings.length > 0) {
  console.log(`   ⚠️  Found ${processedValidation.warnings.length} warnings:`);
  processedValidation.warnings.forEach((warn, i) => {
    console.log(`   ${i + 1}. ${warn}`);
  });
}

// Compare results
console.log("\n" + "=" .repeat(80));
console.log("\n🎯 COMPARISON\n");

const newErrors = processedValidation.errors.length - originalValidation.errors.length;
const newWarnings = processedValidation.warnings.length - originalValidation.warnings.length;

if (newErrors > 0) {
  console.log(`❌ FAILED: Introduced ${newErrors} NEW HTML errors!`);
  console.log("\n🔍 New errors introduced by regex:");
  const newErrorsList = processedValidation.errors.slice(originalValidation.errors.length);
  newErrorsList.forEach((err, i) => {
    console.log(`   ${i + 1}. ${err}`);
  });
  Deno.exit(1);
} else if (newErrors < 0) {
  console.log(`✅ IMPROVED: Fixed ${Math.abs(newErrors)} HTML errors!`);
} else {
  console.log(`✅ PASSED: No new HTML errors introduced`);
}

if (newWarnings !== 0) {
  console.log(`   (Warnings: ${newWarnings > 0 ? '+' : ''}${newWarnings})`);
}

console.log("\n📈 Summary:");
console.log(`   Original errors: ${originalValidation.errors.length}`);
console.log(`   Processed errors: ${processedValidation.errors.length}`);
console.log(`   Difference: ${newErrors >= 0 ? '+' : ''}${newErrors}`);

if (newErrors <= 0) {
  console.log("\n✅ HTML validation test passed!\n");
  Deno.exit(0);
} else {
  console.log("\n❌ HTML validation test failed!\n");
  Deno.exit(1);
}

