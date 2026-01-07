#!/usr/bin/env -S deno run --allow-read --allow-write

// Templatify - Reverse template engine for static sites
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

import { HTMLParser } from "./lib/parser.ts";
import { PatternAnalyzer } from "./lib/analyzer.ts";
import { ComponentExtractor } from "./lib/component-extractor.ts";
import { ContentExtractor } from "./lib/content-extractor.ts";
import { ArchetypeClassifier } from "./lib/archetype-classifier.ts";
import { TemplateGenerator } from "./lib/template-generator.ts";

import type {
  TemplatifyOptions,
  ParsedPage,
  AnalysisReport,
  ComponentSummary,
  ArchetypeSummary,
  ExtractedComponent,
  PageArchetype,
  BladeTemplate,
} from "./lib/types.ts";

const VERSION = "0.1.0";

async function main() {
  const args = parse(Deno.args, {
    string: ["site", "output", "threshold"],
    boolean: ["verbose", "dry-run", "help", "version"],
    alias: {
      s: "site",
      o: "output",
      t: "threshold",
      v: "verbose",
      h: "help",
    },
    default: {
      threshold: "0.8",
      output: "./output",
      verbose: false,
      "dry-run": false,
    },
  });

  if (args.help) {
    printHelp();
    return;
  }

  if (args.version) {
    console.log(`Templatify v${VERSION}`);
    return;
  }

  if (!args.site) {
    console.error("Error: --site parameter is required\n");
    printHelp();
    Deno.exit(1);
  }

  const options: TemplatifyOptions = {
    sitePath: join("sites", args.site),
    outputDir: args.output,
    threshold: parseFloat(args.threshold),
    verbose: args.verbose,
    dryRun: args["dry-run"],
    templateEngine: "blade",
    contentFormat: "markdown",
  };

  // Validate site path
  try {
    const stat = await Deno.stat(options.sitePath);
    if (!stat.isDirectory) {
      console.error(`Error: ${options.sitePath} is not a directory`);
      Deno.exit(1);
    }
  } catch {
    console.error(`Error: Site directory not found: ${options.sitePath}`);
    Deno.exit(1);
  }

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║                      TEMPLATIFY                           ║");
  console.log("║            Reverse Template Engine v" + VERSION + "                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`📂 Site: ${options.sitePath}`);
  console.log(`📁 Output: ${options.outputDir}`);
  console.log(`🎯 Threshold: ${options.threshold}`);
  console.log(`🔍 Dry run: ${options.dryRun ? "Yes" : "No"}\n`);

  const startTime = Date.now();

  try {
    await templatify(options);

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Complete in ${elapsed}ms`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    Deno.exit(1);
  }
}

async function templatify(options: TemplatifyOptions): Promise<void> {
  const { sitePath, outputDir, threshold, verbose, dryRun } = options;

  // Phase 1: Parse HTML files
  console.log("📖 Phase 1: Parsing HTML files...");
  const parser = new HTMLParser();
  const htmlFiles = await parser.findHTMLFiles(sitePath);
  console.log(`   Found ${htmlFiles.length} HTML files`);

  if (htmlFiles.length === 0) {
    throw new Error("No HTML files found in site directory");
  }

  // Limit to first 50 pages for initial analysis (can be made configurable)
  const filesToAnalyze = htmlFiles.slice(0, 50);
  console.log(`   Analyzing ${filesToAnalyze.length} files...`);

  const pages = await parser.parseFiles(filesToAnalyze);
  console.log(`   ✓ Parsed ${pages.length} pages\n`);

  // Phase 2: Analyze patterns
  console.log("🔍 Phase 2: Analyzing patterns...");
  const analyzer = new PatternAnalyzer(threshold, verbose);
  analyzer.analyzePages(pages);
  console.log("   ✓ Generated fingerprints");

  const components = analyzer.findRepeatedComponents(pages);
  console.log(`   ✓ Found ${components.length} repeated components\n`);

  // Phase 3: Extract components
  console.log("🧩 Phase 3: Extracting components...");
  const componentExtractor = new ComponentExtractor(verbose);
  const extractedComponents = componentExtractor.extractComponents(components, pages);
  console.log(`   ✓ Extracted ${extractedComponents.length} components\n`);

  // Phase 4: Classify archetypes
  console.log("🏛️  Phase 4: Classifying page archetypes...");
  const classifier = new ArchetypeClassifier(threshold * 0.9, verbose);
  const archetypes = classifier.classifyPages(pages);
  console.log(`   ✓ Identified ${archetypes.length} archetypes\n`);

  // Phase 5: Extract content
  console.log("📝 Phase 5: Extracting content...");
  const contentExtractor = new ContentExtractor(verbose);
  const extractedContents = pages.map((page) => {
    const mainContent = analyzer.findMainContent(page, components);
    return contentExtractor.extractContent(page, mainContent);
  });
  console.log(`   ✓ Extracted content from ${extractedContents.length} pages\n`);

  // Phase 6: Generate templates
  console.log("🎨 Phase 6: Generating Blade templates...");
  const templateGenerator = new TemplateGenerator(verbose);

  // Generate master layout
  const masterLayout = templateGenerator.generateMasterLayout(
    extractedComponents,
    pages[0]
  );

  // Generate component templates
  const componentTemplates = extractedComponents.map((comp) =>
    templateGenerator.generateComponentTemplate(comp)
  );

  // Generate page templates for each archetype
  const pageTemplates: BladeTemplate[] = [];
  for (const archetype of archetypes) {
    const sampleContent = extractedContents[archetype.pages[0]];
    const template = templateGenerator.generatePageTemplate(
      archetype,
      pages,
      extractedComponents,
      sampleContent
    );
    pageTemplates.push(template);
  }

  console.log(`   ✓ Generated ${1 + componentTemplates.length + pageTemplates.length} templates\n`);

  // Phase 7: Write output
  if (dryRun) {
    console.log("🏃 Dry run mode - skipping file writes");
    printSummary(pages, extractedComponents, archetypes);
  } else {
    console.log("💾 Phase 7: Writing output files...");
    await writeOutput(
      outputDir,
      masterLayout,
      componentTemplates,
      pageTemplates,
      extractedContents,
      pages,
      archetypes
    );
    console.log(`   ✓ Output written to ${outputDir}`);

    // Generate analysis report
    const report = generateReport(
      sitePath,
      pages,
      extractedComponents,
      archetypes,
      Date.now() - performance.now()
    );
    await writeReport(outputDir, report);
    console.log(`   ✓ Analysis report saved`);
  }
}

async function writeOutput(
  outputDir: string,
  masterLayout: BladeTemplate,
  componentTemplates: BladeTemplate[],
  pageTemplates: BladeTemplate[],
  contents: any[],
  pages: ParsedPage[],
  archetypes: PageArchetype[]
): Promise<void> {
  // Create directory structure
  await ensureDir(join(outputDir, "templates", "layouts"));
  await ensureDir(join(outputDir, "templates", "components"));
  await ensureDir(join(outputDir, "templates", "pages"));
  await ensureDir(join(outputDir, "content", "pages"));

  // Write master layout
  await Deno.writeTextFile(
    join(outputDir, "templates", "layouts", "master.blade.php"),
    masterLayout.content
  );

  // Write component templates
  for (const template of componentTemplates) {
    const filename = `${template.name}.blade.php`;
    await Deno.writeTextFile(
      join(outputDir, "templates", "components", filename),
      template.content
    );
  }

  // Write page templates
  for (const template of pageTemplates) {
    const filename = `${template.name}.blade.php`;
    await Deno.writeTextFile(
      join(outputDir, "templates", "pages", filename),
      template.content
    );
  }

  // Write content files
  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    const page = pages[i];

    // Find archetype for this page
    const archetype = archetypes.find((a) => a.pages.includes(i));
    const templateName = archetype?.templateName || "page";

    // Generate frontmatter
    const frontmatter = generateFrontmatter(content, templateName);

    // Generate filename from URL
    const filename = generateFilename(page.url, i);

    const fullContent = `---\n${frontmatter}\n---\n\n${content.bodyMarkdown}`;

    await Deno.writeTextFile(
      join(outputDir, "content", "pages", `${filename}.md`),
      fullContent
    );
  }

  // Write manifest
  const manifest = {
    generated: new Date().toISOString(),
    totalPages: pages.length,
    archetypes: archetypes.map((a) => ({
      name: a.name,
      template: a.templateName,
      pageCount: a.pages.length,
    })),
    components: componentTemplates.map((c) => c.name),
  };

  await Deno.writeTextFile(
    join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

function generateFrontmatter(content: any, templateName: string): string {
  const lines: string[] = [];

  lines.push(`title: "${content.title.replace(/"/g, '\\"')}"`);
  lines.push(`template: "${templateName}"`);

  if (content.metadata.date) {
    lines.push(`date: "${content.metadata.date}"`);
  }

  if (content.metadata.author) {
    lines.push(`author: "${content.metadata.author}"`);
  }

  if (content.metadata.excerpt) {
    lines.push(`excerpt: "${content.metadata.excerpt.replace(/"/g, '\\"')}"`);
  }

  if (content.metadata.tags && content.metadata.tags.length > 0) {
    lines.push(`tags:`);
    content.metadata.tags.forEach((tag: string) => {
      lines.push(`  - "${tag}"`);
    });
  }

  return lines.join("\n");
}

function generateFilename(url: string, index: number): string {
  // Extract path from URL
  const match = url.match(/https?:\/\/[^\/]+\/(.+)/);
  if (match) {
    let path = match[1];
    // Remove trailing slash and index.html
    path = path.replace(/\/$/, "").replace(/\/index\.html$/, "");
    // Replace slashes with hyphens
    path = path.replace(/\//g, "-");
    // Remove special characters
    path = path.replace(/[^a-z0-9-]/gi, "-");
    // Remove multiple hyphens
    path = path.replace(/-+/g, "-");
    // Remove leading/trailing hyphens
    path = path.replace(/^-|-$/g, "");

    return path || "home";
  }

  return `page-${index}`;
}

async function writeReport(outputDir: string, report: AnalysisReport): Promise<void> {
  await Deno.writeTextFile(
    join(outputDir, "extraction-report.json"),
    JSON.stringify(report, null, 2)
  );
}

function generateReport(
  sitePath: string,
  pages: ParsedPage[],
  components: ExtractedComponent[],
  archetypes: PageArchetype[],
  processingTimeMs: number
): AnalysisReport {
  const componentSummaries: ComponentSummary[] = components.map((c) => ({
    name: c.name,
    type: c.type,
    frequency: c.frequency,
    confidence: c.frequency,
  }));

  const archetypeSummaries: ArchetypeSummary[] = archetypes.map((a) => ({
    name: a.name,
    pageCount: a.pages.length,
    confidence: a.confidence,
    examplePages: a.pages.slice(0, 3).map((idx) => pages[idx].url),
  }));

  return {
    sitePath,
    totalPages: pages.length,
    pagesAnalyzed: pages.length,
    components: componentSummaries,
    archetypes: archetypeSummaries,
    extractionMetrics: {
      processingTimeMs,
      componentsIdentified: components.length,
      archetypesIdentified: archetypes.length,
      averageConfidence: archetypes.reduce((sum, a) => sum + a.confidence, 0) / archetypes.length || 0,
      successRate: 1.0,
    },
    warnings: [],
    timestamp: new Date(),
  };
}

function printSummary(
  pages: ParsedPage[],
  components: ExtractedComponent[],
  archetypes: PageArchetype[]
): void {
  console.log("\n📊 Analysis Summary:");
  console.log(`   Pages analyzed: ${pages.length}`);
  console.log(`   Components found: ${components.length}`);
  console.log(`   Archetypes identified: ${archetypes.length}\n`);

  console.log("🧩 Components:");
  components.forEach((c) => {
    console.log(`   - ${c.name} (${c.type}) - ${(c.frequency * 100).toFixed(0)}% frequency`);
  });

  console.log("\n🏛️  Archetypes:");
  archetypes.forEach((a) => {
    console.log(`   - ${a.name}: ${a.pages.length} pages (${(a.confidence * 100).toFixed(0)}% confidence)`);
  });
}

function printHelp(): void {
  console.log(`
Templatify - Reverse Template Engine for Static Sites

USAGE:
    deno task templatify --site=<site-name> [OPTIONS]

OPTIONS:
    -s, --site <name>       Site name in the sites/ directory (required)
    -o, --output <dir>      Output directory (default: ./output)
    -t, --threshold <num>   Similarity threshold 0-1 (default: 0.8)
    -v, --verbose           Enable verbose logging
    --dry-run               Analyze only, don't write files
    -h, --help              Show this help message
    --version               Show version

EXAMPLES:
    # Analyze a site
    deno task templatify --site=www.example.com

    # Custom output directory
    deno task templatify --site=www.example.com --output=./extracted

    # Dry run with verbose output
    deno task templatify --site=www.example.com --dry-run --verbose

    # Adjust similarity threshold
    deno task templatify --site=www.example.com --threshold=0.9
`);
}

if (import.meta.main) {
  main();
}



