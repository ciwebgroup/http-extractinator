// Page archetype classification
import { Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type { ParsedPage, PageArchetype } from "./types.ts";
import { calculateFingerprintSimilarity } from "./fingerprint.ts";

export class ArchetypeClassifier {
  private threshold: number;
  private verbose: boolean;

  constructor(threshold = 0.75, verbose = false) {
    this.threshold = threshold;
    this.verbose = verbose;
  }

  /**
   * Classify pages into archetypes based on structural similarity
   */
  classifyPages(pages: ParsedPage[]): PageArchetype[] {
    this.log(`Classifying ${pages.length} pages into archetypes...`);

    // Calculate similarity matrix
    const similarities = this.calculateSimilarityMatrix(pages);

    // Perform clustering
    const clusters = this.clusterPages(pages, similarities);

    // Create archetypes from clusters
    const archetypes = this.createArchetypes(pages, clusters);

    this.log(`Identified ${archetypes.length} archetypes`);
    return archetypes;
  }

  /**
   * Calculate similarity matrix for all pages
   */
  private calculateSimilarityMatrix(pages: ParsedPage[]): number[][] {
    const n = pages.length;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;

      for (let j = i + 1; j < n; j++) {
        const sim = calculateFingerprintSimilarity(
          pages[i].fingerprint,
          pages[j].fingerprint
        );
        matrix[i][j] = sim;
        matrix[j][i] = sim;
      }
    }

    return matrix;
  }

  /**
   * Cluster pages based on similarity
   */
  private clusterPages(pages: ParsedPage[], similarities: number[][]): number[][] {
    const n = pages.length;
    const clusters: number[][] = [];
    const assigned = new Set<number>();

    // Greedy clustering: start with each unassigned page and find similar pages
    for (let i = 0; i < n; i++) {
      if (assigned.has(i)) continue;

      const cluster = [i];
      assigned.add(i);

      // Find all pages similar to this one
      for (let j = i + 1; j < n; j++) {
        if (assigned.has(j)) continue;

        // Check similarity with all pages in current cluster
        const avgSimilarity = this.averageSimilarity(cluster, j, similarities);

        if (avgSimilarity >= this.threshold) {
          cluster.push(j);
          assigned.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Calculate average similarity between a page and a cluster
   */
  private averageSimilarity(cluster: number[], pageIndex: number, similarities: number[][]): number {
    let sum = 0;
    for (const clusterIndex of cluster) {
      sum += similarities[clusterIndex][pageIndex];
    }
    return sum / cluster.length;
  }

  /**
   * Create archetypes from clusters
   */
  private createArchetypes(pages: ParsedPage[], clusters: number[][]): PageArchetype[] {
    const archetypes: PageArchetype[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const clusterPages = cluster.map((idx) => pages[idx]);

      // Determine archetype name based on URL patterns and page characteristics
      const name = this.determineArchetypeName(clusterPages, i);

      // Extract common structure
      const commonStructure = this.extractCommonStructure(clusterPages);

      // Find distinctive features
      const distinctiveFeatures = this.findDistinctiveFeatures(clusterPages);

      // Calculate confidence based on cluster cohesion
      const confidence = this.calculateClusterConfidence(clusterPages);

      archetypes.push({
        name,
        pages: cluster,
        commonStructure,
        distinctiveFeatures,
        templateName: this.generateTemplateName(name),
        confidence,
      });
    }

    // Sort by page count (largest clusters first)
    archetypes.sort((a, b) => b.pages.length - a.pages.length);

    return archetypes;
  }

  /**
   * Determine archetype name from page characteristics
   */
  private determineArchetypeName(pages: ParsedPage[], index: number): string {
    // Analyze URL patterns
    const urlPatterns = this.analyzeURLPatterns(pages);

    // Check for common page types
    if (urlPatterns.some((p) => p.includes("blog") || p.includes("post"))) {
      return "blog-post";
    }

    if (urlPatterns.some((p) => p.includes("product"))) {
      return "product";
    }

    if (urlPatterns.some((p) => p.includes("service"))) {
      return "service";
    }

    if (pages.some((p) => p.metadata.ogTags?.["og:type"] === "article")) {
      return "article";
    }

    // Check for homepage
    if (pages.some((p) => p.url.endsWith("/") || p.url.endsWith("/index.html"))) {
      return "homepage";
    }

    // Check page titles
    const titles = pages.map((p) => p.title.toLowerCase());
    if (titles.some((t) => t.includes("about"))) {
      return "about";
    }
    if (titles.some((t) => t.includes("contact"))) {
      return "contact";
    }
    if (titles.some((t) => t.includes("portfolio"))) {
      return "portfolio";
    }

    // Default to generic archetype name
    return pages.length > 1 ? `archetype-${index + 1}` : "single-page";
  }

  /**
   * Analyze URL patterns in pages
   */
  private analyzeURLPatterns(pages: ParsedPage[]): string[] {
    return pages.map((page) => {
      const url = page.url;
      // Extract path segments
      const match = url.match(/https?:\/\/[^\/]+\/(.+)/);
      if (match) {
        return match[1].split("/").filter((s) => s.length > 0).join("/");
      }
      return "";
    });
  }

  /**
   * Extract common structural elements across pages
   */
  private extractCommonStructure(pages: ParsedPage[]): string {
    if (pages.length === 0) return "";

    // Use the first page's fingerprint as representative
    return pages[0].fingerprint;
  }

  /**
   * Find distinctive features of this archetype
   */
  private findDistinctiveFeatures(pages: ParsedPage[]): string[] {
    const features: string[] = [];

    // Analyze common elements
    const commonTags = this.findCommonTags(pages);
    if (commonTags.length > 0) {
      features.push(`Common tags: ${commonTags.join(", ")}`);
    }

    // Check for specific content patterns
    if (pages.every((p) => this.hasElement(p, "article"))) {
      features.push("Contains article element");
    }

    if (pages.every((p) => this.hasElement(p, "time"))) {
      features.push("Contains time/date element");
    }

    if (pages.every((p) => this.hasElement(p, ".author, [rel='author']"))) {
      features.push("Contains author information");
    }

    // URL pattern
    const urlPatterns = this.analyzeURLPatterns(pages);
    const commonPattern = this.findCommonURLPattern(urlPatterns);
    if (commonPattern) {
      features.push(`URL pattern: ${commonPattern}`);
    }

    return features;
  }

  /**
   * Find common HTML tags across pages
   */
  private findCommonTags(pages: ParsedPage[]): string[] {
    if (pages.length === 0) return [];

    // Get tag sets for each page
    const tagSets = pages.map((page) => {
      const tags = new Set<string>();
      const elements = page.body.querySelectorAll("*");
      elements.forEach((el) => {
        if (el instanceof Element) {
          tags.add(el.tagName.toLowerCase());
        }
      });
      return tags;
    });

    // Find intersection of all tag sets
    const commonTags = tagSets.reduce((acc, set) => {
      return new Set([...acc].filter((tag) => set.has(tag)));
    });

    return Array.from(commonTags).sort();
  }

  /**
   * Check if page has a specific element
   */
  private hasElement(page: ParsedPage, selector: string): boolean {
    return page.body.querySelector(selector) !== null;
  }

  /**
   * Find common URL pattern
   */
  private findCommonURLPattern(patterns: string[]): string {
    if (patterns.length === 0) return "";

    // Find common prefix
    const sortedPatterns = patterns.slice().sort();
    const first = sortedPatterns[0];
    const last = sortedPatterns[sortedPatterns.length - 1];

    let i = 0;
    while (i < first.length && first[i] === last[i]) {
      i++;
    }

    const commonPrefix = first.substring(0, i);

    // Extract directory pattern
    const parts = commonPrefix.split("/");
    if (parts.length > 1) {
      return parts.slice(0, -1).join("/") + "/*";
    }

    return commonPrefix;
  }

  /**
   * Calculate cluster confidence based on internal similarity
   */
  private calculateClusterConfidence(pages: ParsedPage[]): number {
    if (pages.length === 1) return 0.5; // Single page = low confidence

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const sim = calculateFingerprintSimilarity(
          pages[i].fingerprint,
          pages[j].fingerprint
        );
        totalSimilarity += sim;
        count++;
      }
    }

    const avgSimilarity = count > 0 ? totalSimilarity / count : 0;

    // Adjust confidence based on cluster size
    const sizeFactor = Math.min(pages.length / 10, 1.0);

    return avgSimilarity * 0.7 + sizeFactor * 0.3;
  }

  /**
   * Generate template name from archetype name
   */
  private generateTemplateName(archetypeName: string): string {
    return archetypeName.toLowerCase().replace(/\s+/g, "-");
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[ArchetypeClassifier] ${message}`);
    }
  }
}

