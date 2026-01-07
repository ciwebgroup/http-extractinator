// Content extraction and Markdown conversion
import { Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type {
  ParsedPage,
  ExtractedContent,
  ContentMetadata,
  ImageReference,
  LinkReference,
} from "./types.ts";

export class ContentExtractor {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Extract main content from a page
   */
  extractContent(page: ParsedPage, mainContentElement?: Element | null): ExtractedContent {
    this.log(`Extracting content from ${page.url}`);

    // Use provided content element or find it
    const contentElement = mainContentElement || this.findMainContentElement(page.body);

    if (!contentElement) {
      this.log("Warning: Could not find main content element");
      return this.createEmptyContent(page);
    }

    // Extract title
    const title = this.extractTitle(page, contentElement);

    // Extract metadata
    const metadata = this.extractContentMetadata(page, contentElement);

    // Extract images
    const images = this.extractImages(contentElement);

    // Extract links
    const links = this.extractLinks(contentElement);

    // Get HTML body
    const body = contentElement.innerHTML;

    // Convert to Markdown
    const bodyMarkdown = this.htmlToMarkdown(contentElement);

    return {
      title,
      body,
      bodyMarkdown,
      metadata,
      images,
      links,
    };
  }

  /**
   * Find the main content element in the page
   */
  private findMainContentElement(body: Element): Element | null {
    // Try semantic HTML5 elements first
    const candidates = [
      body.querySelector("main"),
      body.querySelector("article"),
      body.querySelector("[role='main']"),
      body.querySelector(".content"),
      body.querySelector(".main-content"),
      body.querySelector(".post-content"),
      body.querySelector(".entry-content"),
      body.querySelector("#content"),
      body.querySelector("#main"),
    ];

    for (const candidate of candidates) {
      if (candidate instanceof Element) {
        return candidate;
      }
    }

    // Fall back to heuristics
    return this.findContentByHeuristics(body);
  }

  /**
   * Find content using heuristics (text density, paragraph count, etc.)
   */
  private findContentByHeuristics(body: Element): Element | null {
    const candidates: Array<{ element: Element; score: number }> = [];

    // Look at all divs, sections, and articles
    const elements = body.querySelectorAll("div, section, article");

    for (const element of elements) {
      if (!(element instanceof Element)) continue;

      const score = this.scoreContentElement(element);
      if (score > 10) {
        candidates.push({ element, score });
      }
    }

    // Sort by score and return the best
    candidates.sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0].element : null;
  }

  /**
   * Score an element as potential main content
   */
  private scoreContentElement(element: Element): number {
    let score = 0;

    // Text length
    const text = element.textContent || "";
    const textLength = text.trim().length;
    score += Math.min(textLength / 100, 30);

    // Paragraph count
    const paragraphs = element.querySelectorAll("p");
    score += Math.min(paragraphs.length * 3, 30);

    // Heading count
    const headings = element.querySelectorAll("h1, h2, h3, h4, h5, h6");
    score += Math.min(headings.length * 2, 20);

    // Links (too many links = navigation, not content)
    const links = element.querySelectorAll("a");
    if (links.length > 20) {
      score -= 10;
    }

    // Images
    const images = element.querySelectorAll("img");
    score += Math.min(images.length * 2, 10);

    // Text to HTML ratio
    const htmlLength = element.innerHTML.length;
    if (htmlLength > 0) {
      const ratio = textLength / htmlLength;
      score += ratio * 10;
    }

    return score;
  }

  /**
   * Extract title from page and content
   */
  private extractTitle(page: ParsedPage, contentElement: Element): string {
    // Try h1 in content
    const h1 = contentElement.querySelector("h1");
    if (h1 && h1.textContent?.trim()) {
      return h1.textContent.trim();
    }

    // Try page title
    if (page.title && page.title !== "Untitled") {
      return page.title;
    }

    // Try metadata title
    if (page.metadata.title) {
      return page.metadata.title;
    }

    return "Untitled";
  }

  /**
   * Extract content metadata
   */
  private extractContentMetadata(page: ParsedPage, contentElement: Element): ContentMetadata {
    const metadata: ContentMetadata = {};

    // Extract from page metadata
    if (page.metadata.date) {
      metadata.date = page.metadata.date;
    }

    if (page.metadata.author) {
      metadata.author = page.metadata.author;
    }

    if (page.metadata.description) {
      metadata.excerpt = page.metadata.description;
    }

    if (page.metadata.keywords) {
      metadata.tags = page.metadata.keywords;
    }

    // Try to extract from content
    const timeElement = contentElement.querySelector("time");
    if (timeElement) {
      const datetime = timeElement.getAttribute("datetime");
      if (datetime && !metadata.date) {
        metadata.date = datetime;
      }
    }

    // Look for author in content
    const authorElement = contentElement.querySelector(".author, .post-author, [rel='author']");
    if (authorElement && !metadata.author) {
      metadata.author = authorElement.textContent?.trim() || "";
    }

    // Look for categories/tags
    const categoryElements = contentElement.querySelectorAll(".category, .tag, [rel='tag']");
    if (categoryElements.length > 0 && !metadata.tags) {
      metadata.tags = Array.from(categoryElements)
        .map((el) => el.textContent?.trim() || "")
        .filter((t) => t.length > 0);
    }

    return metadata;
  }

  /**
   * Extract images from content
   */
  private extractImages(contentElement: Element): ImageReference[] {
    const images: ImageReference[] = [];
    const imgElements = contentElement.querySelectorAll("img");

    imgElements.forEach((img, index) => {
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "";
      const title = img.getAttribute("title") || "";

      // Determine if it's a featured image (usually the first large image)
      const position = index === 0 ? "featured" : "inline";

      images.push({
        src,
        alt,
        title,
        position,
      });
    });

    return images;
  }

  /**
   * Extract links from content
   */
  private extractLinks(contentElement: Element): LinkReference[] {
    const links: LinkReference[] = [];
    const linkElements = contentElement.querySelectorAll("a");

    linkElements.forEach((link) => {
      const href = link.getAttribute("href") || "";
      const text = link.textContent?.trim() || "";

      // Determine if link is external (starts with http/https or //)
      const external = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//");

      links.push({
        href,
        text,
        external,
      });
    });

    return links;
  }

  /**
   * Convert HTML to Markdown
   */
  private htmlToMarkdown(element: Element): string {
    // Clone to avoid modifying original
    const clone = element.cloneNode(true) as Element;

    // Remove unwanted elements
    this.removeUnwantedElements(clone);

    // Convert to Markdown
    return this.convertToMarkdown(clone);
  }

  /**
   * Remove elements that shouldn't be in the content
   */
  private removeUnwantedElements(element: Element): void {
    const unwantedSelectors = [
      "script",
      "style",
      "iframe",
      ".advertisement",
      ".ads",
      ".social-share",
      ".comments",
    ];

    unwantedSelectors.forEach((selector) => {
      const elements = element.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    });
  }

  /**
   * Convert element to Markdown (simple implementation)
   */
  private convertToMarkdown(element: Element, level = 0): string {
    let markdown = "";

    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 3) {
        // Text node
        const text = (node.textContent || "").trim();
        if (text) {
          markdown += text + " ";
        }
      } else if (node.nodeType === 1) {
        // Element node
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        switch (tag) {
          case "h1":
            markdown += `\n\n# ${el.textContent?.trim()}\n\n`;
            break;
          case "h2":
            markdown += `\n\n## ${el.textContent?.trim()}\n\n`;
            break;
          case "h3":
            markdown += `\n\n### ${el.textContent?.trim()}\n\n`;
            break;
          case "h4":
            markdown += `\n\n#### ${el.textContent?.trim()}\n\n`;
            break;
          case "h5":
            markdown += `\n\n##### ${el.textContent?.trim()}\n\n`;
            break;
          case "h6":
            markdown += `\n\n###### ${el.textContent?.trim()}\n\n`;
            break;
          case "p":
            markdown += `\n\n${this.convertToMarkdown(el, level + 1).trim()}\n\n`;
            break;
          case "strong":
          case "b":
            markdown += `**${el.textContent?.trim()}**`;
            break;
          case "em":
          case "i":
            markdown += `*${el.textContent?.trim()}*`;
            break;
          case "a":
            const href = el.getAttribute("href") || "";
            const text = el.textContent?.trim() || "";
            markdown += `[${text}](${href})`;
            break;
          case "img":
            const src = el.getAttribute("src") || "";
            const alt = el.getAttribute("alt") || "";
            markdown += `\n\n![${alt}](${src})\n\n`;
            break;
          case "ul":
            markdown += "\n" + this.convertList(el, false) + "\n";
            break;
          case "ol":
            markdown += "\n" + this.convertList(el, true) + "\n";
            break;
          case "blockquote":
            const quoteText = el.textContent?.trim() || "";
            markdown += `\n\n> ${quoteText}\n\n`;
            break;
          case "code":
            markdown += `\`${el.textContent}\``;
            break;
          case "pre":
            const codeEl = el.querySelector("code");
            const code = (codeEl || el).textContent || "";
            markdown += `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
            break;
          case "br":
            markdown += "\n";
            break;
          default:
            // Recursively process children
            markdown += this.convertToMarkdown(el, level + 1);
        }
      }
    }

    return markdown;
  }

  /**
   * Convert list to Markdown
   */
  private convertList(listElement: Element, ordered: boolean): string {
    // Get direct li children only (avoid querySelectorAll issues with numeric IDs)
    const items = Array.from(listElement.children).filter(
      (child) => child.tagName.toLowerCase() === "li"
    );
    let markdown = "";

    items.forEach((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : "- ";
      const text = this.convertToMarkdown(item as Element).trim();
      markdown += `${prefix}${text}\n`;
    });

    return markdown;
  }

  /**
   * Create empty content object
   */
  private createEmptyContent(page: ParsedPage): ExtractedContent {
    return {
      title: page.title,
      body: "",
      bodyMarkdown: "",
      metadata: {},
      images: [],
      links: [],
    };
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[ContentExtractor] ${message}`);
    }
  }
}

