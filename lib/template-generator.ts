// Blade template generation
import { Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import type {
  ExtractedComponent,
  PageArchetype,
  ParsedPage,
  BladeTemplate,
  TemplateVariable,
  ExtractedContent,
} from "./types.ts";
import { TemplateFileType, ComponentType, VariableType } from "./types.ts";

export class TemplateGenerator {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Generate master layout template
   */
  generateMasterLayout(
    components: ExtractedComponent[],
    samplePage: ParsedPage
  ): BladeTemplate {
    this.log("Generating master layout...");

    // Extract head content
    const head = this.extractHead(samplePage.dom);

    // Build layout structure
    let content = `<!DOCTYPE html>\n<html lang="{{ $lang ?? 'en' }}">\n<head>\n`;
    content += this.indentLines(head, 1);
    content += `    <title>{{ $title ?? config('app.name') }}</title>\n`;
    content += `</head>\n<body>\n`;

    // Add header component if exists
    const header = components.find((c) => c.type === ComponentType.HEADER);
    if (header) {
      content += `    @include('components.${this.sanitizeComponentName(header.name)}')\n\n`;
    }

    // Add main content section
    content += `    @yield('content')\n\n`;

    // Add footer component if exists
    const footer = components.find((c) => c.type === ComponentType.FOOTER);
    if (footer) {
      content += `    @include('components.${this.sanitizeComponentName(footer.name)}')\n`;
    }

    content += `</body>\n</html>`;

    return {
      name: "master",
      type: TemplateFileType.LAYOUT,
      content,
      includes: this.extractIncludes(content),
      sections: [],
      variables: this.extractVariables(content),
    };
  }

  /**
   * Generate component template
   */
  generateComponentTemplate(component: ExtractedComponent): BladeTemplate {
    this.log(`Generating component template: ${component.name}`);

    // Convert HTML to Blade syntax
    let content = component.html;

    // Replace variables in the HTML
    content = this.insertBladeVariables(content, component.variables);

    // Clean up the HTML
    content = this.cleanHTML(content);

    return {
      name: component.name,
      type: TemplateFileType.COMPONENT,
      content,
      includes: [],
      sections: [],
      variables: component.variables,
    };
  }

  /**
   * Generate page template for an archetype
   */
  generatePageTemplate(
    archetype: PageArchetype,
    pages: ParsedPage[],
    components: ExtractedComponent[],
    contentSample?: ExtractedContent
  ): BladeTemplate {
    this.log(`Generating page template: ${archetype.templateName}`);

    // Get a sample page from this archetype
    const samplePage = pages[archetype.pages[0]];

    // Start with extends directive
    let content = `@extends('layouts.master')\n\n`;

    // Add content section
    content += `@section('content')\n`;

    // Generate content structure
    if (contentSample) {
      content += this.generateContentStructure(contentSample);
    } else {
      content += `<main class="content">\n`;
      content += `    <h1>{{ $title }}</h1>\n\n`;
      content += `    <div class="body">\n`;
      content += `        {!! $content !!}\n`;
      content += `    </div>\n`;
      content += `</main>\n`;
    }

    content += `@endsection\n`;

    // Extract variables used
    const variables = this.extractVariables(content);

    return {
      name: archetype.templateName,
      type: TemplateFileType.PAGE,
      content,
      extends: "layouts.master",
      includes: this.extractIncludes(content),
      sections: ["content"],
      variables,
    };
  }

  /**
   * Generate content structure from extracted content
   */
  private generateContentStructure(content: ExtractedContent): string {
    let html = `<article class="article">\n`;

    // Add title
    html += `    <header class="article-header">\n`;
    html += `        <h1>{{ $title }}</h1>\n`;

    // Add metadata if exists
    if (content.metadata.date || content.metadata.author) {
      html += `        <div class="article-meta">\n`;
      if (content.metadata.date) {
        html += `            <time datetime="{{ $date }}">{{ $date }}</time>\n`;
      }
      if (content.metadata.author) {
        html += `            <span class="author">{{ $author }}</span>\n`;
      }
      html += `        </div>\n`;
    }

    html += `    </header>\n\n`;

    // Add featured image if exists
    if (content.images.some((img) => img.position === "featured")) {
      html += `    @if(isset($featured_image))\n`;
      html += `    <figure class="featured-image">\n`;
      html += `        <img src="{{ $featured_image }}" alt="{{ $featured_image_alt ?? $title }}">\n`;
      html += `    </figure>\n`;
      html += `    @endif\n\n`;
    }

    // Add body content
    html += `    <div class="article-body">\n`;
    html += `        {!! $content !!}\n`;
    html += `    </div>\n`;

    html += `</article>\n`;

    return html;
  }

  /**
   * Extract head content from document
   */
  private extractHead(dom: Document): string {
    const head = dom.querySelector("head");
    if (!head) return "";

    let headContent = "";

    // Extract meta tags
    const metaTags = head.querySelectorAll("meta");
    metaTags.forEach((meta) => {
      const name = meta.getAttribute("name") || meta.getAttribute("property");
      const content = meta.getAttribute("content");

      if (name === "description") {
        headContent += `<meta name="description" content="{{ $description ?? '' }}">\n`;
      } else if (name && content && !name.includes("og:")) {
        headContent += `<meta name="${name}" content="${content}">\n`;
      }
    });

    // Extract stylesheets
    const stylesheets = head.querySelectorAll('link[rel="stylesheet"]');
    stylesheets.forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        headContent += `<link rel="stylesheet" href="{{ asset('${this.normalizePath(href)}') }}">\n`;
      }
    });

    // Extract scripts in head
    const scripts = head.querySelectorAll("script[src]");
    scripts.forEach((script) => {
      const src = script.getAttribute("src");
      if (src) {
        headContent += `<script src="{{ asset('${this.normalizePath(src)}') }}"></script>\n`;
      }
    });

    return headContent;
  }

  /**
   * Insert Blade variables into HTML
   */
  private insertBladeVariables(html: string, variables: TemplateVariable[]): string {
    let result = html;

    // For each variable, try to find and replace content
    for (const variable of variables) {
      // This is a simplified version - in production, you'd want more sophisticated matching
      if (variable.example) {
        const escapedExample = this.escapeRegex(variable.example);
        const regex = new RegExp(escapedExample, "g");

        if (variable.type === VariableType.HTML) {
          result = result.replace(regex, `{!! $${variable.name} !!}`);
        } else {
          result = result.replace(regex, `{{ $${variable.name} }}`);
        }
      }
    }

    // Replace common patterns
    result = this.replaceCommonPatterns(result);

    return result;
  }

  /**
   * Replace common content patterns with Blade variables
   */
  private replaceCommonPatterns(html: string): string {
    let result = html;

    // Replace image sources that look like they should be dynamic
    result = result.replace(
      /src="([^"]*\/(uploads|images|media)\/[^"]*)"/gi,
      'src="{{ asset(\'$1\') }}"'
    );

    // Replace links that look dynamic
    result = result.replace(
      /href="(\/[^"]*(?:\.html|\/))"/gi,
      (match, path) => {
        if (path.includes("index.html")) {
          return `href="{{ url('${path.replace("/index.html", "")}') }}"`;
        }
        return `href="{{ url('${path}') }}"`;
      }
    );

    return result;
  }

  /**
   * Clean up HTML formatting
   */
  private cleanHTML(html: string): string {
    let result = html;

    // Remove excessive whitespace
    result = result.replace(/\n\s*\n\s*\n/g, "\n\n");

    // Remove script and style tags
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // Format indentation
    result = this.formatIndentation(result);

    return result.trim();
  }

  /**
   * Format HTML indentation
   */
  private formatIndentation(html: string): string {
    // This is a basic formatter - in production you'd want a proper HTML formatter
    const lines = html.split("\n");
    let indentLevel = 0;
    const formatted: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Decrease indent for closing tags
      if (trimmed.startsWith("</") || trimmed.startsWith("@end")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      formatted.push("    ".repeat(indentLevel) + trimmed);

      // Increase indent for opening tags
      if (
        trimmed.startsWith("<") &&
        !trimmed.startsWith("</") &&
        !trimmed.endsWith("/>") &&
        !this.isSelfClosingTag(trimmed)
      ) {
        indentLevel++;
      } else if (trimmed.startsWith("@") && !trimmed.startsWith("@end")) {
        if (
          trimmed.startsWith("@section") ||
          trimmed.startsWith("@if") ||
          trimmed.startsWith("@foreach") ||
          trimmed.startsWith("@while")
        ) {
          indentLevel++;
        }
      }
    }

    return formatted.join("\n");
  }

  /**
   * Check if tag is self-closing
   */
  private isSelfClosingTag(line: string): boolean {
    const selfClosing = ["img", "br", "hr", "input", "meta", "link"];
    return selfClosing.some((tag) => new RegExp(`<${tag}\\b`, "i").test(line));
  }

  /**
   * Extract @include directives from content
   */
  private extractIncludes(content: string): string[] {
    const includes: string[] = [];
    const regex = /@include\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      includes.push(match[1]);
    }

    return includes;
  }

  /**
   * Extract variables from Blade content
   */
  private extractVariables(content: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const varSet = new Set<string>();

    // Match {{ $variable }} and {!! $variable !!}
    const regex = /\{\{?\s*\$(\w+)[\s}!]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const varName = match[1];
      if (!varSet.has(varName)) {
        varSet.add(varName);

      // Determine if it's HTML or string
      const isHtml = content.includes(`{!! $${varName}`);

        variables.push({
          name: varName,
          type: isHtml ? VariableType.HTML : VariableType.STRING,
          required: !content.includes(`$${varName} ??`),
        });
      }
    }

    return variables;
  }

  /**
   * Normalize asset path
   */
  private normalizePath(path: string): string {
    // Remove leading slash for asset() helper
    return path.startsWith("/") ? path.substring(1) : path;
  }

  /**
   * Sanitize component name for file naming
   */
  private sanitizeComponentName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Indent lines by a number of levels
   */
  private indentLines(text: string, levels: number): string {
    const indent = "    ".repeat(levels);
    return text
      .split("\n")
      .map((line) => (line.trim() ? indent + line : ""))
      .join("\n");
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[TemplateGenerator] ${message}`);
    }
  }
}

