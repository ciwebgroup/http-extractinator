// Component extraction and identification
import { Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type {
  ComponentMatch,
  ExtractedComponent,
  TemplateVariable,
  ParsedPage,
} from "./types.ts";
import { VariableType } from "./types.ts";

export class ComponentExtractor {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Extract components from component matches
   */
  extractComponents(
    components: ComponentMatch[],
    pages: ParsedPage[]
  ): ExtractedComponent[] {
    this.log(`Extracting ${components.length} components...`);

    const extractedComponents: ExtractedComponent[] = [];

    for (const component of components) {
      const extracted = this.extractComponent(component, pages);
      extractedComponents.push(extracted);
    }

    this.log("Component extraction complete");
    return extractedComponents;
  }

  /**
   * Extract a single component
   */
  private extractComponent(
    match: ComponentMatch,
    pages: ParsedPage[]
  ): ExtractedComponent {
    // Get all instances of this component across pages
    const instances: Element[] = [];
    
    for (const pageIndex of match.pageIndexes) {
      const page = pages[pageIndex];
      const instance = this.findComponentInPage(page, match);
      if (instance) {
        instances.push(instance);
      }
    }

    // Analyze variations to identify variables
    const variables = this.identifyVariables(instances);

    // Generate the component HTML with variable placeholders
    const html = this.generateComponentHTML(match.element, variables);

    return {
      name: match.name,
      type: match.type,
      html,
      variables,
      fingerprint: match.fingerprint,
      frequency: match.frequency,
    };
  }

  /**
   * Find component instance in a specific page
   */
  private findComponentInPage(page: ParsedPage, match: ComponentMatch): Element | null {
    // Try to find element with same fingerprint
    // This is a simplified approach - in production you'd want more robust matching
    return match.element;
  }

  /**
   * Identify variables by comparing multiple instances
   */
  private identifyVariables(instances: Element[]): TemplateVariable[] {
    if (instances.length === 0) return [];

    const variables: TemplateVariable[] = [];
    const baseInstance = instances[0];

    // Extract text nodes and identify varying content
    const textContents = instances.map((inst) => this.extractTextContent(inst));
    
    // Find texts that vary across instances
    const varyingTexts = this.findVaryingContent(textContents);

    // Create variables for varying content
    varyingTexts.forEach((text, index) => {
      const varType = this.inferVariableType(text.examples);
      variables.push({
        name: this.generateVariableName(text.context, index),
        type: varType,
        example: text.examples[0],
        required: true,
      });
    });

    // Extract image sources
    const images = baseInstance.querySelectorAll("img");
    if (images.length > 0) {
      const imageSrcs = instances.map((inst) => {
        return Array.from(inst.querySelectorAll("img")).map((img) =>
          img.getAttribute("src") || ""
        );
      });

      // Check if image sources vary
      if (this.contentVaries(imageSrcs)) {
        images.forEach((img, index) => {
          variables.push({
            name: `image_${index + 1}`,
            type: VariableType.IMAGE,
            example: img.getAttribute("src") || "",
            required: false,
          });

          const alt = img.getAttribute("alt");
          if (alt) {
            variables.push({
              name: `image_${index + 1}_alt`,
              type: VariableType.STRING,
              example: alt,
              required: false,
            });
          }
        });
      }
    }

    // Extract links
    const links = baseInstance.querySelectorAll("a");
    if (links.length > 0) {
      const linkHrefs = instances.map((inst) => {
        return Array.from(inst.querySelectorAll("a")).map((a) =>
          a.getAttribute("href") || ""
        );
      });

      if (this.contentVaries(linkHrefs)) {
        links.forEach((link, index) => {
          variables.push({
            name: `link_${index + 1}_url`,
            type: VariableType.URL,
            example: link.getAttribute("href") || "",
            required: false,
          });
          variables.push({
            name: `link_${index + 1}_text`,
            type: VariableType.STRING,
            example: link.textContent?.trim() || "",
            required: false,
          });
        });
      }
    }

    return variables;
  }

  /**
   * Extract text content with context
   */
  private extractTextContent(element: Element): Map<string, string> {
    const textMap = new Map<string, string>();
    this.collectTextNodes(element, textMap);
    return textMap;
  }

  /**
   * Recursively collect text nodes
   */
  private collectTextNodes(node: Node, textMap: Map<string, string>): void {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { // Text node
        const text = (child.textContent || "").trim();
        if (text.length > 0) {
          const parent = child.parentElement;
          const context = parent ? parent.tagName.toLowerCase() : "text";
          const key = `${context}_${textMap.size}`;
          textMap.set(key, text);
        }
      } else if (child.nodeType === 1) { // Element node
        this.collectTextNodes(child, textMap);
      }
    }
  }

  /**
   * Find content that varies across instances
   */
  private findVaryingContent(
    contentMaps: Map<string, string>[]
  ): Array<{ context: string; examples: string[] }> {
    if (contentMaps.length === 0) return [];

    const varying: Array<{ context: string; examples: string[] }> = [];
    const baseMap = contentMaps[0];

    for (const [key, value] of baseMap.entries()) {
      const allValues = contentMaps.map((map) => map.get(key) || "");
      const uniqueValues = new Set(allValues);

      // If values vary across instances, it's likely a variable
      if (uniqueValues.size > 1 || uniqueValues.size === 1 && allValues.length > 1) {
        varying.push({
          context: key,
          examples: Array.from(uniqueValues),
        });
      }
    }

    return varying;
  }

  /**
   * Check if content varies across instances
   */
  private contentVaries(contentArrays: string[][]): boolean {
    if (contentArrays.length < 2) return false;

    const first = contentArrays[0].join("|");
    return contentArrays.some((arr) => arr.join("|") !== first);
  }

  /**
   * Infer variable type from examples
   */
  private inferVariableType(examples: string[]): VariableType {
    if (examples.length === 0) return VariableType.STRING;

    const sample = examples[0];

    // Check for date patterns
    if (this.isDate(sample)) {
      return VariableType.DATE;
    }

    // Check for numbers
    if (/^\d+$/.test(sample)) {
      return VariableType.NUMBER;
    }

    // Check for URLs
    if (this.isURL(sample)) {
      return VariableType.URL;
    }

    // Check for HTML content
    if (/<[^>]+>/.test(sample)) {
      return VariableType.HTML;
    }

    return VariableType.STRING;
  }

  /**
   * Check if string is a date
   */
  private isDate(str: string): boolean {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    ];

    return datePatterns.some((pattern) => pattern.test(str));
  }

  /**
   * Check if string is a URL
   */
  private isURL(str: string): boolean {
    return /^(https?:\/\/|\/\/)/.test(str) || str.startsWith("/");
  }

  /**
   * Generate variable name from context
   */
  private generateVariableName(context: string, index: number): string {
    // Extract meaningful part from context
    const parts = context.split("_");
    const base = parts[0];

    // Map common tags to meaningful names
    const nameMap: Record<string, string> = {
      h1: "title",
      h2: "subtitle",
      h3: "heading",
      p: "text",
      span: "label",
      div: "content",
      a: "link",
      img: "image",
    };

    const baseName = nameMap[base] || base;

    return index === 0 ? baseName : `${baseName}_${index + 1}`;
  }

  /**
   * Generate component HTML with variable placeholders
   */
  private generateComponentHTML(element: Element, variables: TemplateVariable[]): string {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as Element;

    // Replace varying content with variable placeholders
    // This is a simplified version - in production you'd want more sophisticated replacement
    
    // For now, just return the outer HTML
    // The template generator will handle variable insertion
    return clone.outerHTML;
  }


  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[ComponentExtractor] ${message}`);
    }
  }
}

