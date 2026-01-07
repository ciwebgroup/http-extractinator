// Core type definitions for the templatify system

export interface ParsedPage {
  filePath: string;
  url: string;
  title: string;
  dom: Document;
  body: Element;
  metadata: PageMetadata;
  fingerprint: string;
  structuralSignature: string;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  author?: string;
  date?: string;
  keywords?: string[];
  ogTags?: Record<string, string>;
  customMeta?: Record<string, string>;
}

export interface ComponentMatch {
  fingerprint: string;
  element: Element;
  frequency: number;
  pageIndexes: number[];
  type: ComponentType;
  name: string;
  position: ComponentPosition;
}

export enum ComponentType {
  HEADER = "header",
  FOOTER = "footer",
  NAVIGATION = "navigation",
  SIDEBAR = "sidebar",
  HERO = "hero",
  CONTENT = "content",
  UNKNOWN = "unknown",
}

export enum ComponentPosition {
  TOP = "top",
  BOTTOM = "bottom",
  SIDE = "side",
  MAIN = "main",
  UNKNOWN = "unknown",
}

export interface ExtractedComponent {
  name: string;
  type: ComponentType;
  html: string;
  variables: TemplateVariable[];
  fingerprint: string;
  frequency: number;
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  example?: string;
  required: boolean;
}

export enum VariableType {
  STRING = "string",
  HTML = "html",
  DATE = "date",
  NUMBER = "number",
  URL = "url",
  IMAGE = "image",
  ARRAY = "array",
}

export interface ExtractedContent {
  title: string;
  body: string;
  bodyMarkdown: string;
  metadata: ContentMetadata;
  images: ImageReference[];
  links: LinkReference[];
}

export interface ContentMetadata {
  date?: string;
  author?: string;
  category?: string;
  tags?: string[];
  excerpt?: string;
  [key: string]: string | string[] | undefined;
}

export interface ImageReference {
  src: string;
  alt?: string;
  title?: string;
  position: "inline" | "featured";
}

export interface LinkReference {
  href: string;
  text: string;
  external: boolean;
}

export interface PageArchetype {
  name: string;
  pages: number[];
  commonStructure: string;
  distinctiveFeatures: string[];
  templateName: string;
  confidence: number;
}

export interface BladeTemplate {
  name: string;
  type: TemplateFileType;
  content: string;
  extends?: string;
  includes: string[];
  sections: string[];
  variables: TemplateVariable[];
}

export enum TemplateFileType {
  LAYOUT = "layout",
  COMPONENT = "component",
  PAGE = "page",
}

export interface AnalysisReport {
  sitePath: string;
  totalPages: number;
  pagesAnalyzed: number;
  components: ComponentSummary[];
  archetypes: ArchetypeSummary[];
  extractionMetrics: ExtractionMetrics;
  warnings: string[];
  timestamp: Date;
}

export interface ComponentSummary {
  name: string;
  type: ComponentType;
  frequency: number;
  confidence: number;
}

export interface ArchetypeSummary {
  name: string;
  pageCount: number;
  confidence: number;
  examplePages: string[];
}

export interface ExtractionMetrics {
  processingTimeMs: number;
  componentsIdentified: number;
  archetypesIdentified: number;
  averageConfidence: number;
  successRate: number;
}

export interface TemplatifyOptions {
  sitePath: string;
  outputDir: string;
  threshold: number;
  verbose: boolean;
  dryRun: boolean;
  templateEngine: "blade" | "twig" | "jinja2";
  contentFormat: "markdown" | "html";
}

export interface TreeNode {
  tag: string;
  classes: string[];
  attributes: Record<string, string>;
  children: TreeNode[];
  textContent?: string;
  fingerprint?: string;
}

export interface SimilarityResult {
  similarity: number;
  differences: TreeDifference[];
}

export interface TreeDifference {
  path: string;
  type: "added" | "removed" | "modified";
  description: string;
}



