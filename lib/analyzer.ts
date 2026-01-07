// Pattern detection and analysis engine
import { Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type { ParsedPage, ComponentMatch } from "./types.ts";
import { ComponentType, ComponentPosition } from "./types.ts";
import {
  generateFingerprint,
  generateSemanticFingerprint,
  generateSimpleFingerprint,
  calculateFingerprintSimilarity,
  elementToTreeNode,
  calculateTreeSimilarity,
  hashFingerprint,
} from "./fingerprint.ts";

export class PatternAnalyzer {
  private threshold: number;
  private verbose: boolean;

  constructor(threshold = 0.8, verbose = false) {
    this.threshold = threshold;
    this.verbose = verbose;
  }

  /**
   * Analyze all pages and generate fingerprints
   */
  analyzePages(pages: ParsedPage[]): void {
    this.log(`Analyzing ${pages.length} pages...`);

    for (const page of pages) {
      page.fingerprint = generateSimpleFingerprint(page.body, 4);
      page.structuralSignature = generateFingerprint(page.body);
    }

    this.log("Fingerprinting complete");
  }

  /**
   * Find repeated components across all pages
   */
  findRepeatedComponents(pages: ParsedPage[]): ComponentMatch[] {
    this.log("Detecting repeated components...");

    const componentMap = new Map<string, {
      fingerprint: string;
      elements: Element[];
      pageIndexes: number[];
    }>();

    // Extract top-level sections from each page
    pages.forEach((page, pageIndex) => {
      const sections = this.extractSections(page.body);

      sections.forEach((section) => {
        const fingerprint = generateFingerprint(section);
        const hash = hashFingerprint(fingerprint);

        if (!componentMap.has(hash)) {
          componentMap.set(hash, {
            fingerprint,
            elements: [],
            pageIndexes: [],
          });
        }

        const component = componentMap.get(hash)!;
        component.elements.push(section);
        if (!component.pageIndexes.includes(pageIndex)) {
          component.pageIndexes.push(pageIndex);
        }
      });
    });

    // Filter for components that appear frequently
    const frequentComponents: ComponentMatch[] = [];
    const totalPages = pages.length;

    for (const [hash, component] of componentMap.entries()) {
      const frequency = component.pageIndexes.length / totalPages;

      // Only include components that appear in at least threshold% of pages
      if (frequency >= this.threshold) {
        const element = component.elements[0];
        const type = this.classifyComponentType(element);
        const position = this.determinePosition(element);
        const name = this.generateComponentName(type, position);

        frequentComponents.push({
          fingerprint: component.fingerprint,
          element,
          frequency,
          pageIndexes: component.pageIndexes,
          type,
          name,
          position,
        });
      }
    }

    this.log(`Found ${frequentComponents.length} repeated components`);
    return frequentComponents;
  }

  /**
   * Extract major sections from a page body
   */
  private extractSections(body: Element): Element[] {
    const sections: Element[] = [];

    // Look for semantic HTML5 elements
    const semanticSelectors = [
      "header",
      "footer",
      "nav",
      "aside",
      "main",
      "article",
      "section[class*='hero']",
      "section[class*='banner']",
      "div[class*='header']",
      "div[class*='footer']",
      "div[class*='nav']",
      "div[class*='sidebar']",
    ];

    for (const selector of semanticSelectors) {
      const elements = body.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el instanceof Element && !this.isNestedIn(el, sections)) {
          sections.push(el);
        }
      });
    }

    // If no semantic elements found, use direct children
    if (sections.length === 0) {
      Array.from(body.children).forEach((child) => {
        if (child instanceof Element) {
          sections.push(child);
        }
      });
    }

    return sections;
  }

  /**
   * Check if element is nested within any of the given elements
   */
  private isNestedIn(element: Element, parents: Element[]): boolean {
    for (const parent of parents) {
      if (parent.contains(element) && parent !== element) {
        return true;
      }
    }
    return false;
  }

  /**
   * Classify component type based on element characteristics
   */
  private classifyComponentType(element: Element): ComponentType {
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).join(" ").toLowerCase();
    const role = element.getAttribute("role")?.toLowerCase() || "";
    const id = element.id.toLowerCase();

    // Check semantic tags first
    if (tag === "header" || classes.includes("header") || id.includes("header")) {
      return ComponentType.HEADER;
    }
    if (tag === "footer" || classes.includes("footer") || id.includes("footer")) {
      return ComponentType.FOOTER;
    }
    if (tag === "nav" || classes.includes("nav") || role === "navigation") {
      return ComponentType.NAVIGATION;
    }
    if (tag === "aside" || classes.includes("sidebar") || classes.includes("aside")) {
      return ComponentType.SIDEBAR;
    }
    if (classes.includes("hero") || classes.includes("banner") || classes.includes("jumbotron")) {
      return ComponentType.HERO;
    }
    if (tag === "main" || classes.includes("main") || classes.includes("content") || tag === "article") {
      return ComponentType.CONTENT;
    }

    return ComponentType.UNKNOWN;
  }

  /**
   * Determine component position on page
   */
  private determinePosition(element: Element): ComponentPosition {
    const parent = element.parentElement;
    if (!parent) return ComponentPosition.UNKNOWN;

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    const total = siblings.length;

    // Check if it's at the top
    if (index === 0 || index < total * 0.2) {
      return ComponentPosition.TOP;
    }

    // Check if it's at the bottom
    if (index === total - 1 || index > total * 0.8) {
      return ComponentPosition.BOTTOM;
    }

    // Check for side positioning via CSS classes
    const classes = Array.from(element.classList).join(" ").toLowerCase();
    if (classes.includes("side") || classes.includes("aside")) {
      return ComponentPosition.SIDE;
    }

    return ComponentPosition.MAIN;
  }

  /**
   * Generate a descriptive name for a component
   */
  private generateComponentName(type: ComponentType, position: ComponentPosition): string {
    const typeName = type.toString();
    
    if (type === ComponentType.UNKNOWN) {
      return `${position}-component`;
    }

    return typeName;
  }

  /**
   * Calculate page similarity matrix
   */
  calculatePageSimilarities(pages: ParsedPage[]): number[][] {
    this.log("Calculating page similarities...");

    const n = pages.length;
    const similarities: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      similarities[i][i] = 1.0;

      for (let j = i + 1; j < n; j++) {
        const sim = calculateFingerprintSimilarity(
          pages[i].fingerprint,
          pages[j].fingerprint
        );
        similarities[i][j] = sim;
        similarities[j][i] = sim;
      }
    }

    return similarities;
  }

  /**
   * Find the main content area in a page
   */
  findMainContent(page: ParsedPage, components: ComponentMatch[]): Element | null {
    // Exclude known repeated components from consideration
    const excludedElements = new Set(components.map((c) => c.element));

    // Look for main content candidates
    const candidates: { element: Element; score: number }[] = [];

    const possibleContainers = [
      ...Array.from(page.body.querySelectorAll("main")),
      ...Array.from(page.body.querySelectorAll("article")),
      ...Array.from(page.body.querySelectorAll("[role='main']")),
      ...Array.from(page.body.querySelectorAll(".content")),
      ...Array.from(page.body.querySelectorAll(".main")),
      ...Array.from(page.body.querySelectorAll(".post")),
      ...Array.from(page.body.querySelectorAll(".entry-content")),
    ];

    for (const container of possibleContainers) {
      if (!(container instanceof Element)) continue;
      if (excludedElements.has(container)) continue;

      const score = this.scoreContentArea(container);
      candidates.push({ element: container, score });
    }

    // Sort by score and return the best candidate
    candidates.sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0].element : null;
  }

  /**
   * Score a potential content area based on various heuristics
   */
  private scoreContentArea(element: Element): number {
    let score = 0;

    // Text content density
    const text = element.textContent || "";
    const textLength = text.trim().length;
    const htmlLength = element.innerHTML.length;

    if (htmlLength > 0) {
      const textRatio = textLength / htmlLength;
      score += textRatio * 50; // Up to 50 points for high text ratio
    }

    // Paragraph count
    const paragraphs = element.querySelectorAll("p");
    score += Math.min(paragraphs.length * 2, 20); // Up to 20 points

    // Heading count
    const headings = element.querySelectorAll("h1, h2, h3");
    score += Math.min(headings.length * 3, 15); // Up to 15 points

    // Text length
    score += Math.min(textLength / 100, 15); // Up to 15 points

    return score;
  }

  /**
   * Group similar elements within a page
   */
  findRepeatedPatterns(element: Element): Map<string, Element[]> {
    const patterns = new Map<string, Element[]>();

    const allElements = element.querySelectorAll("*");
    
    allElements.forEach((el) => {
      if (!(el instanceof Element)) return;

      const fingerprint = generateFingerprint(el);
      const hash = hashFingerprint(fingerprint);

      if (!patterns.has(hash)) {
        patterns.set(hash, []);
      }
      patterns.get(hash)!.push(el);
    });

    // Filter for patterns that repeat at least twice
    const repeatedPatterns = new Map<string, Element[]>();
    for (const [hash, elements] of patterns.entries()) {
      if (elements.length >= 2) {
        repeatedPatterns.set(hash, elements);
      }
    }

    return repeatedPatterns;
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[Analyzer] ${message}`);
    }
  }
}

