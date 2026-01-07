// Structural fingerprinting algorithms for DOM trees
import { Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type { TreeNode } from "./types.ts";

/**
 * Generate a structural fingerprint for a DOM element
 * This fingerprint captures the structure but not the content
 */
export function generateFingerprint(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).sort().join(".");
  
  const childFingerprints = Array.from(element.children)
    .map((child) => {
      if (child instanceof Element) {
        return generateFingerprint(child);
      }
      return "";
    })
    .filter((fp) => fp.length > 0)
    .join("|");

  return `${tag}[${classes}]{${childFingerprints}}`;
}

/**
 * Generate a simplified fingerprint focusing on major structural elements
 */
export function generateSimpleFingerprint(element: Element, maxDepth = 3): string {
  return generateFingerprintWithDepth(element, 0, maxDepth);
}

function generateFingerprintWithDepth(
  element: Element,
  currentDepth: number,
  maxDepth: number
): string {
  if (currentDepth >= maxDepth) {
    return element.tagName.toLowerCase();
  }

  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).sort().join(".");
  
  const childFingerprints = Array.from(element.children)
    .slice(0, 10) // Limit to first 10 children
    .map((child) => {
      if (child instanceof Element) {
        return generateFingerprintWithDepth(child, currentDepth + 1, maxDepth);
      }
      return "";
    })
    .filter((fp) => fp.length > 0)
    .join("|");

  return `${tag}[${classes}]{${childFingerprints}}`;
}

/**
 * Generate a semantic fingerprint that includes role and semantic HTML
 */
export function generateSemanticFingerprint(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role") || "";
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((c) => {
      // Filter for semantic class names
      return (
        c.includes("header") ||
        c.includes("footer") ||
        c.includes("nav") ||
        c.includes("sidebar") ||
        c.includes("content") ||
        c.includes("main") ||
        c.includes("hero") ||
        c.includes("banner")
      );
    })
    .sort()
    .join(".");

  return `${tag}${id}[${classes}]{${role}}`;
}

/**
 * Convert DOM element to TreeNode structure for analysis
 */
export function elementToTreeNode(element: Element): TreeNode {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList);
  const attributes: Record<string, string> = {};

  // Extract key attributes
  for (const attr of Array.from(element.attributes)) {
    if (attr.name !== "class") {
      attributes[attr.name] = attr.value;
    }
  }

  const children: TreeNode[] = Array.from(element.children)
    .map((child) => {
      if (child instanceof Element) {
        return elementToTreeNode(child);
      }
      return null;
    })
    .filter((node): node is TreeNode => node !== null);

  // Get text content (direct children only)
  let textContent = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) { // Text node
      const text = (node.textContent || "").trim();
      if (text) {
        textContent += text + " ";
      }
    }
  }
  textContent = textContent.trim();

  const treeNode: TreeNode = {
    tag,
    classes,
    attributes,
    children,
  };

  if (textContent) {
    treeNode.textContent = textContent;
  }

  return treeNode;
}

/**
 * Calculate structural similarity between two fingerprints
 */
export function calculateFingerprintSimilarity(fp1: string, fp2: string): number {
  if (fp1 === fp2) return 1.0;

  // Use Levenshtein distance for similarity
  const distance = levenshteinDistance(fp1, fp2);
  const maxLength = Math.max(fp1.length, fp2.length);

  if (maxLength === 0) return 1.0;

  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

  // Fill the dp table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Calculate similarity between two TreeNode structures
 */
export function calculateTreeSimilarity(tree1: TreeNode, tree2: TreeNode): number {
  // If tags don't match, low similarity
  if (tree1.tag !== tree2.tag) {
    return 0.2;
  }

  let score = 0.3; // Base score for matching tags

  // Compare classes
  const classes1 = new Set(tree1.classes);
  const classes2 = new Set(tree2.classes);
  const commonClasses = new Set([...classes1].filter((c) => classes2.has(c)));
  const totalClasses = new Set([...classes1, ...classes2]);

  if (totalClasses.size > 0) {
    score += 0.3 * (commonClasses.size / totalClasses.size);
  } else {
    score += 0.3;
  }

  // Compare children count
  const childDiff = Math.abs(tree1.children.length - tree2.children.length);
  const maxChildren = Math.max(tree1.children.length, tree2.children.length);
  if (maxChildren > 0) {
    score += 0.2 * (1 - childDiff / maxChildren);
  } else {
    score += 0.2;
  }

  // Compare child structures recursively (sample)
  const childSimilarities: number[] = [];
  const minChildren = Math.min(tree1.children.length, tree2.children.length);
  for (let i = 0; i < Math.min(minChildren, 5); i++) {
    childSimilarities.push(
      calculateTreeSimilarity(tree1.children[i], tree2.children[i])
    );
  }

  if (childSimilarities.length > 0) {
    const avgChildSimilarity =
      childSimilarities.reduce((a, b) => a + b, 0) / childSimilarities.length;
    score += 0.2 * avgChildSimilarity;
  } else {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Hash a fingerprint for quick lookups
 */
export function hashFingerprint(fingerprint: string): string {
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}



