// HTML parsing and normalization utilities
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type { ParsedPage, PageMetadata } from "./types.ts";

export class HTMLParser {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  /**
   * Parse an HTML file and return a structured ParsedPage object
   */
  async parseFile(filePath: string): Promise<ParsedPage> {
    const html = await Deno.readTextFile(filePath);
    const dom = this.parser.parseFromString(html, "text/html");

    if (!dom) {
      throw new Error(`Failed to parse HTML from ${filePath}`);
    }

    const body = dom.body;
    if (!body) {
      throw new Error(`No body element found in ${filePath}`);
    }

    const metadata = this.extractMetadata(dom);
    const url = this.inferURL(filePath);
    const title = this.extractTitle(dom);

    // Normalize the HTML
    this.normalizeDOM(body);

    return {
      filePath,
      url,
      title,
      dom,
      body,
      metadata,
      fingerprint: "", // Will be set by analyzer
      structuralSignature: "", // Will be set by analyzer
    };
  }

  /**
   * Extract metadata from HTML document
   */
  private extractMetadata(dom: Document): PageMetadata {
    const metadata: PageMetadata = {
      customMeta: {},
      ogTags: {},
    };

    // Extract title
    const titleEl = dom.querySelector("title");
    if (titleEl) {
      metadata.title = titleEl.textContent.trim();
    }

    // Extract meta tags
    const metaTags = dom.querySelectorAll("meta");
    metaTags.forEach((meta) => {
      const name = meta.getAttribute("name") || meta.getAttribute("property");
      const content = meta.getAttribute("content");

      if (!name || !content) return;

      // Standard meta tags
      if (name === "description") {
        metadata.description = content;
      } else if (name === "author") {
        metadata.author = content;
      } else if (name === "keywords") {
        metadata.keywords = content.split(",").map((k) => k.trim());
      } else if (name === "date" || name === "published_time") {
        metadata.date = content;
      }
      // Open Graph tags
      else if (name.startsWith("og:")) {
        metadata.ogTags![name] = content;
      }
      // Other meta tags
      else {
        metadata.customMeta![name] = content;
      }
    });

    return metadata;
  }

  /**
   * Extract title from document (try multiple sources)
   */
  private extractTitle(dom: Document): string {
    // Try <title> tag
    const titleEl = dom.querySelector("title");
    if (titleEl && titleEl.textContent.trim()) {
      return titleEl.textContent.trim();
    }

    // Try <h1> tag
    const h1El = dom.querySelector("h1");
    if (h1El && h1El.textContent.trim()) {
      return h1El.textContent.trim();
    }

    // Try og:title meta tag
    const ogTitle = dom.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const content = ogTitle.getAttribute("content");
      if (content) return content;
    }

    return "Untitled";
  }

  /**
   * Infer URL from file path
   */
  private inferURL(filePath: string): string {
    // Extract path after 'sites/'
    const match = filePath.match(/sites\/([^\/]+)\/(.*)$/);
    if (match) {
      const domain = match[1];
      const path = match[2].replace(/index\.html$/, "");
      return `https://${domain}/${path}`;
    }
    return filePath;
  }

  /**
   * Normalize DOM tree by cleaning up whitespace, comments, etc.
   */
  private normalizeDOM(element: Element): void {
    // Remove comments and normalize text nodes
    this.traverseAndClean(element);

    // Remove script and style tags (they don't contribute to visual structure)
    const scriptsAndStyles = element.querySelectorAll("script, style");
    scriptsAndStyles.forEach((el) => el.remove());

    // Normalize attributes (sort them for consistent comparison)
    this.normalizeAttributes(element);
  }

  /**
   * Traverse DOM tree and clean up nodes
   */
  private traverseAndClean(node: Node): void {
    const nodesToRemove: Node[] = [];
    
    // Collect child nodes to process
    const children = Array.from(node.childNodes);
    
    for (const child of children) {
      if (child.nodeType === 8) { // Comment node
        nodesToRemove.push(child);
      } else if (child.nodeType === 1) { // Element node
        // Recursively process element children
        this.traverseAndClean(child);
      }
      // Note: We skip text normalization as deno-dom text nodes are read-only
    }

    // Remove comment nodes
    nodesToRemove.forEach((n) => n.remove());
  }

  /**
   * Normalize element attributes (sort for consistency)
   */
  private normalizeAttributes(element: Element): void {
    const children = Array.from(element.children);
    children.forEach((child) => {
      if (child instanceof Element) {
        // Sort class names
        const classes = child.getAttribute("class");
        if (classes) {
          const sortedClasses = classes
            .split(/\s+/)
            .filter((c) => c.length > 0)
            .sort()
            .join(" ");
          child.setAttribute("class", sortedClasses);
        }

        // Recursively normalize children
        this.normalizeAttributes(child);
      }
    });
  }


  /**
   * Get all HTML files in a directory recursively
   */
  async findHTMLFiles(dirPath: string): Promise<string[]> {
    const htmlFiles: string[] = [];

    async function walk(path: string) {
      try {
        for await (const entry of Deno.readDir(path)) {
          const fullPath = `${path}/${entry.name}`;

          if (entry.isDirectory) {
            // Skip assets directory
            if (entry.name !== "assets") {
              await walk(fullPath);
            }
          } else if (entry.isFile && entry.name.endsWith(".html")) {
            htmlFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${path}:`, error);
      }
    }

    await walk(dirPath);
    return htmlFiles.sort();
  }

  /**
   * Parse multiple HTML files in parallel
   */
  async parseFiles(filePaths: string[], maxConcurrent = 10): Promise<ParsedPage[]> {
    const results: ParsedPage[] = [];
    
    for (let i = 0; i < filePaths.length; i += maxConcurrent) {
      const batch = filePaths.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((path) => this.parseFile(path))
      );
      results.push(...batchResults);
    }

    return results;
  }
}

