/**
 * URL Rewriter - Comprehensive regex patterns for safe asset URL rewriting
 * 
 * Each pattern is context-specific and bounded to prevent cross-tag matching.
 * Supports all asset types: scripts, styles, images, fonts, icons, media, documents
 * 
 * Based on SPECIFICATION-STATIC-ASSET-REMAPPING-USING-REGEX.md
 */

import * as path from "https://deno.land/std@0.181.0/path/mod.ts";

// ============================================================================
// TYPES
// ============================================================================

export type AssetType = "images" | "scripts" | "styles" | "fonts" | "icons" | "media" | "documents";

export interface RewritePattern {
  name: string;
  description: string;
  pattern: RegExp;
  replacement: (match: string, ...groups: string[]) => string;
  assetType: AssetType;
}

export interface RewriteMatch {
  pattern: string;
  original: string;
  rewritten: string;
  context: string;
}

export interface TagCount {
  [tag: string]: number;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  tagCount: TagCount;
}

export interface RewriteResult {
  html: string;
  matches: RewriteMatch[];
  tagCountBefore: TagCount;
  tagCountAfter: TagCount;
  validationBefore: ValidationResult;
  validationAfter: ValidationResult;
  summary: RewriteSummary;
}

export interface RewriteSummary {
  totalMatches: number;
  totalReplacements: number;
  byPattern: { [pattern: string]: { matches: number; replacements: number } };
  byDomain: { [domain: string]: number };
  byAssetType: { [type: string]: number };
}

// ============================================================================
// EXTENSION DEFINITIONS
// ============================================================================

const EXTENSIONS = {
  scripts: ["js", "mjs", "cjs"],
  styles: ["css"],
  images: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "tiff", "heic"],
  fonts: ["woff", "woff2", "ttf", "otf", "eot"],
  icons: ["ico"],
  media: ["mp4", "webm", "ogg", "mp3", "wav", "flac", "aac", "m4a", "m4v", "mov", "avi"],
  documents: ["pdf", "zip", "json", "xml", "txt", "map"],
};

// Build extension regex groups
const imageExts = EXTENSIONS.images.join("|");
const scriptExts = EXTENSIONS.scripts.join("|");
const styleExts = EXTENSIONS.styles.join("|");
const fontExts = EXTENSIONS.fonts.join("|");
const iconExts = EXTENSIONS.icons.join("|");
const mediaExts = EXTENSIONS.media.join("|");
const allAssetExts = [...EXTENSIONS.images, ...EXTENSIONS.fonts].join("|");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize filename for safe filesystem usage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/ /g, "+")
    .replace(/%20/g, "+")
    .replace(/[<>:"|?*]/g, "_");
}

/**
 * Extract filename from URL, removing query params and fragments
 */
export function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname);
    return sanitizeFilename(filename);
  } catch {
    // Fallback for malformed URLs
    const cleanUrl = url.split("?")[0].split("#")[0];
    const filename = cleanUrl.split("/").pop() || "unknown";
    return sanitizeFilename(filename);
  }
}

/**
 * Determine asset type based on file extension
 */
export function getAssetType(filename: string): AssetType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  
  if (EXTENSIONS.scripts.includes(ext)) return "scripts";
  if (EXTENSIONS.styles.includes(ext)) return "styles";
  if (EXTENSIONS.images.includes(ext)) return "images";
  if (EXTENSIONS.fonts.includes(ext)) return "fonts";
  if (EXTENSIONS.icons.includes(ext)) return "icons";
  if (EXTENSIONS.media.includes(ext)) return "media";
  if (EXTENSIONS.documents.includes(ext)) return "documents";
  
  return "images"; // Default fallback
}

/**
 * Count HTML tags in content
 */
export function countTags(html: string): TagCount {
  const tagCount: TagCount = {};
  
  // Count opening tags (including self-closing)
  const tagPattern = /<([a-z][a-z0-9]*)\b[^>]*\/?>/gi;
  let match;
  
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    tagCount[tag] = (tagCount[tag] || 0) + 1;
  }
  
  return tagCount;
}

/**
 * Validate HTML structure
 */
export function validateHTML(html: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tagCount = countTags(html);
  
  // Self-closing tags that don't need closing
  const selfClosing = new Set([
    "img", "br", "hr", "input", "meta", "link", "area", "base",
    "col", "embed", "param", "source", "track", "wbr"
  ]);
  
  // Count opening and closing tags
  const openTags: { [key: string]: number } = {};
  const closeTags: { [key: string]: number } = {};
  
  const openPattern = /<([a-z][a-z0-9]*)\b[^>]*(?<!\/)\s*>/gi;
  const closePattern = /<\/([a-z][a-z0-9]*)\s*>/gi;
  
  let match;
  while ((match = openPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (!selfClosing.has(tag)) {
      openTags[tag] = (openTags[tag] || 0) + 1;
    }
  }
  
  while ((match = closePattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    closeTags[tag] = (closeTags[tag] || 0) + 1;
  }
  
  // Compare open and close tags
  const allTags = new Set([...Object.keys(openTags), ...Object.keys(closeTags)]);
  for (const tag of allTags) {
    const open = openTags[tag] || 0;
    const close = closeTags[tag] || 0;
    if (open !== close) {
      errors.push(`Tag mismatch: <${tag}> opened ${open} times, closed ${close} times`);
    }
  }
  
  // Check for broken attributes (unclosed quotes)
  const brokenAttrPattern = /\s+\w+=["'][^"']*$/gm;
  let brokenCount = 0;
  while (brokenAttrPattern.exec(html)) brokenCount++;
  if (brokenCount > 0) {
    errors.push(`Found ${brokenCount} potentially unclosed attribute quotes`);
  }
  
  // Check for double protocols
  const doubleProtocol = (html.match(/https?:\/\/[^"'\s]*https?:\/\//g) || []).length;
  if (doubleProtocol > 0) {
    errors.push(`Found ${doubleProtocol} URLs with double protocols`);
  }
  
  // Check for asset paths with domain remnants
  const domainRemnants = (html.match(/\/assets\/[a-z]+\/\/[a-z.-]+\.com/g) || []).length;
  if (domainRemnants > 0) {
    errors.push(`Found ${domainRemnants} asset paths with domain remnants`);
  }
  
  return { errors, warnings, tagCount };
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

/**
 * Create all rewrite patterns for a specific domain
 */
export function createRewritePatterns(domain: string): RewritePattern[] {
  // Escape dots in domain for regex
  const d = domain.replace(/\./g, "\\.");
  
  const patterns: RewritePattern[] = [];

  // ---------------------------------------------------------------------------
  // PATTERN 1: Script src attribute
  // <script src="https://domain.com/path/file.js"></script>
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "script-src",
    description: '<script src="URL">',
    pattern: new RegExp(
      `(<script[^>]*?\\ssrc=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${scriptExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/scripts/${filename}${suffix}`;
    },
    assetType: "scripts"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 2: Link stylesheet (rel before href)
  // <link rel="stylesheet" href="https://domain.com/path/file.css">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "link-stylesheet-standard",
    description: '<link rel="stylesheet" href="URL">',
    pattern: new RegExp(
      `(<link[^>]*?\\srel=["']stylesheet["'][^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.css)(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/styles/${filename}${suffix}`;
    },
    assetType: "styles"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 3: Link stylesheet (href before rel)
  // <link href="https://domain.com/path/file.css" rel="stylesheet">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "link-stylesheet-reversed",
    description: '<link href="URL" rel="stylesheet">',
    pattern: new RegExp(
      `(<link[^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.css)(?:\\?[^"']*)?(?:#[^"']*)?(["'][^>]*?\\srel=["']stylesheet["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/styles/${filename}${suffix}`;
    },
    assetType: "styles"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 4: Link preload font
  // <link rel="preload" href="https://domain.com/path/font.woff" as="font">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "link-preload-font",
    description: '<link rel="preload" href="URL" as="font">',
    pattern: new RegExp(
      `(<link[^>]*?\\srel=["']preload["'][^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${fontExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'][^>]*?\\sas=["']font["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/fonts/${filename}${suffix}`;
    },
    assetType: "fonts"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 5: Image src attribute
  // <img src="https://domain.com/path/image.jpg">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "img-src",
    description: '<img src="URL">',
    pattern: new RegExp(
      `(<img[^>]*?\\ssrc=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 6: Image srcset attribute
  // <img srcset="https://domain.com/img.jpg 640w, https://domain.com/img2.jpg 1920w">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "img-srcset",
    description: '<img srcset="URL1 W1, URL2 W2">',
    pattern: new RegExp(
      `(srcset=["'])([^"']*https?:\\/\\/(?:www\\.)?${d}\\/[^"']+)(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, srcsetContent, suffix) => {
      const srcsetPattern = new RegExp(
        `(https?:\\/\\/(?:www\\.)?${d}\\/[^\\s,]+\\.(${imageExts}))(?:\\?[^\\s,]*)?(?:#[^\\s,]*)?(\\s+\\d+[wx])?`,
        "gi"
      );
      const updated = srcsetContent.replace(srcsetPattern, (m: string, url: string, _ext: string, descriptor: string) => {
        const filename = extractFilename(url);
        return `/assets/images/${filename}${descriptor || ""}`;
      });
      return `${prefix}${updated}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 7: Source srcset attribute (picture element)
  // <source srcset="https://domain.com/img.jpg 640w">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "source-srcset",
    description: '<source srcset="URL">',
    pattern: new RegExp(
      `(<source[^>]*?\\ssrcset=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(\\s+\\d+[wx])?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, descriptor, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${descriptor || ""}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 8: Meta og:image
  // <meta property="og:image" content="https://domain.com/path/image.jpg">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "meta-og-image",
    description: '<meta property="og:image" content="URL">',
    pattern: new RegExp(
      `(<meta[^>]*?\\sproperty=["']og:image["'][^>]*?\\scontent=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 9: Meta twitter:image
  // <meta name="twitter:image" content="https://domain.com/path/image.jpg">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "meta-twitter-image",
    description: '<meta name="twitter:image" content="URL">',
    pattern: new RegExp(
      `(<meta[^>]*?\\sname=["']twitter:image["'][^>]*?\\scontent=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 10: Link icon
  // <link rel="icon" href="https://domain.com/path/favicon.ico">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "link-icon",
    description: '<link rel="icon" href="URL">',
    pattern: new RegExp(
      `(<link[^>]*?\\srel=["'](?:shortcut\\s+)?icon["'][^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.ico)(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/icons/${filename}${suffix}`;
    },
    assetType: "icons"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 11: Link apple-touch-icon
  // <link rel="apple-touch-icon" href="https://domain.com/path/icon.png">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "link-apple-touch-icon",
    description: '<link rel="apple-touch-icon" href="URL">',
    pattern: new RegExp(
      `(<link[^>]*?\\srel=["']apple-touch-icon["'][^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 12: Inline style background-image
  // style="background-image: url('https://domain.com/path/image.jpg');"
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "inline-style-bg",
    description: 'style="...url(URL)..."',
    pattern: new RegExp(
      `(style=["'][^"']*?url\\(["']?)(https?:\\/\\/(?:www\\.)?${d}\\/[^"')\\s]+\\.(${imageExts}))(?:\\?[^"')]*)?(?:#[^"')]*)?(['"]?\\))`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 13: CSS url() function (for images)
  // url(https://domain.com/path/image.jpg) or url("...")
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "css-url-image",
    description: 'url(URL) for images',
    pattern: new RegExp(
      `(url\\(["']?)(https?:\\/\\/(?:www\\.)?${d}\\/[^"')\\s]+\\.(${imageExts}))(?:\\?[^"')]*)?(?:#[^"')]*)?(['"]?\\))`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 14: CSS url() function (for fonts)
  // url(https://domain.com/path/font.woff) or url("...")
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "css-url-font",
    description: 'url(URL) for fonts',
    pattern: new RegExp(
      `(url\\(["']?)(https?:\\/\\/(?:www\\.)?${d}\\/[^"')\\s]+\\.(${fontExts}))(?:\\?[^"')]*)?(?:#[^"')]*)?(['"]?\\))`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/fonts/${filename}${suffix}`;
    },
    assetType: "fonts"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 15: Data attributes (data-src, data-bg, data-image-url)
  // data-src="https://domain.com/path/image.jpg"
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "data-attributes",
    description: 'data-{src|bg|image-url}="URL"',
    pattern: new RegExp(
      `(data-(?:image-url|src|bg|background|lazy-src)=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 16: Source src (media - video/audio)
  // <source src="https://domain.com/path/video.mp4">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "source-src-media",
    description: '<source src="URL"> for media',
    pattern: new RegExp(
      `(<source[^>]*?\\ssrc=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${mediaExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/media/${filename}${suffix}`;
    },
    assetType: "media"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 17: Video poster
  // <video poster="https://domain.com/path/poster.jpg">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "video-poster",
    description: '<video poster="URL">',
    pattern: new RegExp(
      `(<video[^>]*?\\sposter=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 18: Input type=image src
  // <input type="image" src="https://domain.com/path/button.png">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "input-image-src",
    description: '<input type="image" src="URL">',
    pattern: new RegExp(
      `(<input[^>]*?\\stype=["']image["'][^>]*?\\ssrc=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 19: SVG image href
  // <image href="https://domain.com/path/image.png">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "svg-image-href",
    description: '<image href="URL">',
    pattern: new RegExp(
      `(<image[^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 20: SVG image xlink:href (legacy)
  // <image xlink:href="https://domain.com/path/image.jpg">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "svg-image-xlink",
    description: '<image xlink:href="URL">',
    pattern: new RegExp(
      `(<image[^>]*?\\sxlink:href=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${imageExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/images/${filename}${suffix}`;
    },
    assetType: "images"
  });

  // ---------------------------------------------------------------------------
  // PATTERN 21: Link href for fonts (direct)
  // <link href="https://domain.com/fonts/font.woff2">
  // ---------------------------------------------------------------------------
  patterns.push({
    name: "link-font-direct",
    description: '<link href="URL"> for fonts',
    pattern: new RegExp(
      `(<link[^>]*?\\shref=["'])(https?:\\/\\/(?:www\\.)?${d}\\/[^"']+\\.(${fontExts}))(?:\\?[^"']*)?(?:#[^"']*)?(["'])`,
      "gi"
    ),
    replacement: (_match, prefix, url, _ext, suffix) => {
      const filename = extractFilename(url);
      return `${prefix}/assets/fonts/${filename}${suffix}`;
    },
    assetType: "fonts"
  });

  return patterns;
}

// ============================================================================
// MAIN REWRITE FUNCTION
// ============================================================================

/**
 * Apply all rewrite patterns to HTML with comprehensive tracking
 */
export function rewriteHTML(html: string, domains: string[]): RewriteResult {
  const matches: RewriteMatch[] = [];
  const summary: RewriteSummary = {
    totalMatches: 0,
    totalReplacements: 0,
    byPattern: {},
    byDomain: {},
    byAssetType: {}
  };
  
  // Capture before state
  const tagCountBefore = countTags(html);
  const validationBefore = validateHTML(html);
  
  let result = html;
  
  for (const domainUrl of domains) {
    let domain: string;
    try {
      domain = new URL(domainUrl).hostname;
    } catch {
      domain = domainUrl.replace(/^https?:\/\//, "").split("/")[0];
    }
    
    const patterns = createRewritePatterns(domain);
    
    for (const pattern of patterns) {
      // Initialize tracking for this pattern
      if (!summary.byPattern[pattern.name]) {
        summary.byPattern[pattern.name] = { matches: 0, replacements: 0 };
      }
      
      // Find all matches first
      const patternMatches = result.match(pattern.pattern) || [];
      summary.byPattern[pattern.name].matches += patternMatches.length;
      summary.totalMatches += patternMatches.length;
      
      // Track by domain
      if (!summary.byDomain[domain]) {
        summary.byDomain[domain] = 0;
      }
      summary.byDomain[domain] += patternMatches.length;
      
      // Track by asset type
      if (!summary.byAssetType[pattern.assetType]) {
        summary.byAssetType[pattern.assetType] = 0;
      }
      summary.byAssetType[pattern.assetType] += patternMatches.length;
      
      // Apply replacements and track each one
      result = result.replace(pattern.pattern, (...args) => {
        const fullMatch = args[0];
        const replacement = pattern.replacement(...args);
        
        // Track individual match
        matches.push({
          pattern: pattern.name,
          original: fullMatch.substring(0, 200) + (fullMatch.length > 200 ? "..." : ""),
          rewritten: replacement.substring(0, 200) + (replacement.length > 200 ? "..." : ""),
          context: pattern.description
        });
        
        summary.byPattern[pattern.name].replacements++;
        summary.totalReplacements++;
        
        return replacement;
      });
    }
  }
  
  // Capture after state
  const tagCountAfter = countTags(result);
  const validationAfter = validateHTML(result);
  
  return {
    html: result,
    matches,
    tagCountBefore,
    tagCountAfter,
    validationBefore,
    validationAfter,
    summary
  };
}

/**
 * Simple rewrite without tracking (for production use)
 */
export function rewriteHTMLSimple(html: string, domains: string[]): string {
  let result = html;
  
  for (const domainUrl of domains) {
    let domain: string;
    try {
      domain = new URL(domainUrl).hostname;
    } catch {
      domain = domainUrl.replace(/^https?:\/\//, "").split("/")[0];
    }
    
    const patterns = createRewritePatterns(domain);
    
    for (const pattern of patterns) {
      result = result.replace(pattern.pattern, pattern.replacement);
    }
  }
  
  return result;
}

/**
 * Test patterns against HTML and return detailed results
 */
export function testPatterns(html: string, domains: string[]): Array<{
  domain: string;
  pattern: string;
  description: string;
  matches: number;
  examples: string[];
}> {
  const results = [];
  
  for (const domainUrl of domains) {
    let domain: string;
    try {
      domain = new URL(domainUrl).hostname;
    } catch {
      domain = domainUrl.replace(/^https?:\/\//, "").split("/")[0];
    }
    
    const patterns = createRewritePatterns(domain);
    
    for (const pattern of patterns) {
      const patternMatches = html.match(pattern.pattern) || [];
      results.push({
        domain,
        pattern: pattern.name,
        description: pattern.description,
        matches: patternMatches.length,
        examples: patternMatches.slice(0, 3).map(m => m.substring(0, 100))
      });
    }
  }
  
  return results;
}

/**
 * Format rewrite result as a console report
 */
export function formatReport(result: RewriteResult): string {
  const lines: string[] = [];
  
  lines.push("═".repeat(80));
  lines.push("  URL REWRITER REPORT");
  lines.push("═".repeat(80));
  
  // Summary
  lines.push("\n📊 SUMMARY");
  lines.push("─".repeat(40));
  lines.push(`Total Matches:      ${result.summary.totalMatches}`);
  lines.push(`Total Replacements: ${result.summary.totalReplacements}`);
  
  // By Asset Type
  lines.push("\n📁 BY ASSET TYPE");
  lines.push("─".repeat(40));
  for (const [type, count] of Object.entries(result.summary.byAssetType)) {
    lines.push(`  ${type.padEnd(15)} ${count}`);
  }
  
  // By Domain
  lines.push("\n🌐 BY DOMAIN");
  lines.push("─".repeat(40));
  for (const [domain, count] of Object.entries(result.summary.byDomain)) {
    lines.push(`  ${domain.padEnd(35)} ${count}`);
  }
  
  // By Pattern
  lines.push("\n🔧 BY PATTERN");
  lines.push("─".repeat(60));
  lines.push("  Pattern                          Matches  Replacements");
  lines.push("  " + "─".repeat(56));
  for (const [name, stats] of Object.entries(result.summary.byPattern)) {
    if (stats.matches > 0) {
      lines.push(`  ${name.padEnd(32)} ${String(stats.matches).padStart(7)}  ${String(stats.replacements).padStart(12)}`);
    }
  }
  
  // Tag Count Comparison
  lines.push("\n🏷️  TAG COUNT (BEFORE → AFTER)");
  lines.push("─".repeat(40));
  const allTags = new Set([
    ...Object.keys(result.tagCountBefore),
    ...Object.keys(result.tagCountAfter)
  ]);
  const importantTags = ["div", "img", "script", "link", "style", "meta", "a", "video", "audio", "source"];
  for (const tag of importantTags) {
    if (allTags.has(tag)) {
      const before = result.tagCountBefore[tag] || 0;
      const after = result.tagCountAfter[tag] || 0;
      const diff = after - before;
      const diffStr = diff === 0 ? "  ✓" : diff > 0 ? ` +${diff}` : ` ${diff}`;
      lines.push(`  <${tag.padEnd(10)}> ${String(before).padStart(5)} → ${String(after).padStart(5)} ${diffStr}`);
    }
  }
  
  // Validation
  lines.push("\n✅ VALIDATION");
  lines.push("─".repeat(40));
  lines.push(`  Errors Before:  ${result.validationBefore.errors.length}`);
  lines.push(`  Errors After:   ${result.validationAfter.errors.length}`);
  const newErrors = result.validationAfter.errors.length - result.validationBefore.errors.length;
  if (newErrors > 0) {
    lines.push(`  ❌ NEW ERRORS:  ${newErrors}`);
  } else if (newErrors < 0) {
    lines.push(`  ✓ FIXED:        ${Math.abs(newErrors)}`);
  } else {
    lines.push(`  ✓ No new errors introduced`);
  }
  
  lines.push("\n" + "═".repeat(80));
  
  return lines.join("\n");
}

/**
 * Format match table for debugging
 */
export function formatMatchTable(matches: RewriteMatch[]): string {
  if (matches.length === 0) {
    return "No matches found.";
  }
  
  const lines: string[] = [];
  lines.push("┌" + "─".repeat(78) + "┐");
  lines.push("│  # │ Pattern                     │ Asset Type                               │");
  lines.push("├" + "─".repeat(78) + "┤");
  
  matches.forEach((match, i) => {
    const num = String(i + 1).padStart(3);
    const pattern = match.pattern.substring(0, 26).padEnd(26);
    const context = match.context.substring(0, 40).padEnd(40);
    lines.push(`│${num} │ ${pattern} │ ${context} │`);
  });
  
  lines.push("└" + "─".repeat(78) + "┘");
  
  return lines.join("\n");
}

