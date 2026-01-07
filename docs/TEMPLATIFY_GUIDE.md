# Templatify Quick Start Guide

## Overview

Templatify is a reverse template engine that analyzes static HTML sites and extracts reusable templates and content. It's perfect for migrating from static sites to template-based systems like Laravel.

## Installation

Ensure you have Deno installed:
```bash
curl -fsSL https://deno.land/install.sh | sh
```

## Basic Usage

### 1. Download a Site First

Before running templatify, download a site using the copy command:

```bash
deno task copy https://www.example.com
```

This will save the site to `sites/www.example.com/`

### 2. Run Templatify

Analyze the downloaded site:

```bash
deno task templatify --site=www.example.com
```

### 3. Review Output

The output will be generated in the `output/` directory:

```
output/
├── templates/
│   ├── layouts/master.blade.php
│   ├── components/
│   │   ├── header.blade.php
│   │   ├── footer.blade.php
│   │   └── navigation.blade.php
│   └── pages/
│       └── blog-post.blade.php
├── content/
│   └── pages/
│       ├── page-1.md
│       └── page-2.md
├── manifest.json
└── extraction-report.json
```

## Command Options

### Required
- `--site, -s`: Site name in the sites/ directory

### Optional
- `--output, -o`: Output directory (default: `./output`)
- `--threshold, -t`: Similarity threshold 0-1 (default: `0.8`)
  - Higher = more strict (fewer, more similar components)
  - Lower = more lenient (more components, less similar)
- `--verbose, -v`: Enable detailed logging
- `--dry-run`: Analyze without writing files (useful for preview)

## Examples

### Example 1: Basic Analysis
```bash
deno task templatify --site=www.designroofservicesllc.com
```

### Example 2: Dry Run with Verbose Output
```bash
deno task templatify --site=www.example.com --dry-run --verbose
```

This will show you what would be generated without actually writing files.

### Example 3: Custom Output Directory
```bash
deno task templatify --site=www.example.com --output=./my-templates
```

### Example 4: Stricter Component Detection
```bash
deno task templatify --site=www.example.com --threshold=0.9
```

Use a higher threshold when you want to only extract components that are very similar across pages.

### Example 5: More Lenient Detection
```bash
deno task templatify --site=www.example.com --threshold=0.7
```

Use a lower threshold to extract more components, even if they vary slightly.

## Understanding the Output

### Templates Directory

#### layouts/master.blade.php
The main layout file that other templates extend. Contains the HTML structure, head section, and includes for components.

#### components/*.blade.php
Reusable components extracted from the site:
- `header.blade.php`: Site header
- `footer.blade.php`: Site footer
- `navigation.blade.php`: Navigation menus
- Other repeated elements

#### pages/*.blade.php
Page templates for different archetypes:
- `blog-post.blade.php`: Template for blog posts
- `homepage.blade.php`: Template for homepage
- `product.blade.php`: Template for product pages

### Content Directory

Each `.md` file contains:
- **Frontmatter**: Metadata (title, date, author, template reference)
- **Body**: Content in Markdown format

Example:
```markdown
---
title: "My Blog Post"
date: "2025-12-12"
template: "blog-post"
author: "John Doe"
---

# My Blog Post

Content goes here...
```

### manifest.json

Contains a summary of what was generated:
- Number of pages analyzed
- List of archetypes and their page counts
- List of components extracted

### extraction-report.json

Detailed analysis report including:
- Processing metrics
- Component confidence scores
- Archetype classifications
- Warnings and issues

## Tips for Best Results

### 1. Start with Dry Run
Always do a dry run first to see what will be generated:
```bash
deno task templatify --site=example.com --dry-run --verbose
```

### 2. Adjust Threshold Based on Site Consistency
- **Highly consistent sites** (same builder/theme): Use threshold 0.8-0.9
- **Mixed content sites**: Use threshold 0.7-0.8
- **Very diverse sites**: Use threshold 0.6-0.7

### 3. Review the Report
Check `extraction-report.json` to understand:
- How confident the system is about each component
- Which pages were grouped together
- Any warnings or issues

### 4. Iterate
You can run templatify multiple times with different thresholds to find the best results.

## Troubleshooting

### "No HTML files found"
Make sure you've downloaded the site first using `deno task copy`

### "Too many/too few components detected"
Adjust the `--threshold` parameter:
- Increase (0.9) for fewer, more accurate components
- Decrease (0.7) for more components with slight variations

### "Components are too generic"
This happens with very consistent sites where everything is similar. The system correctly identifies shared elements. Review the output to see if the extracted templates are useful.

### "Missing some obvious components"
- Try lowering the threshold
- Some components may only appear on 70-80% of pages (default is 80%)
- Check the extraction report for details

## Next Steps After Extraction

1. **Review Templates**: Check the generated Blade templates for accuracy
2. **Customize Variables**: Update variable names to match your naming conventions
3. **Add Logic**: Add conditional logic, loops, and other Blade directives as needed
4. **Integrate Content**: Set up a content management system to use the extracted Markdown files
5. **Test**: Create a Laravel application and test the templates with real data

## Advanced Usage

### Custom Analysis Workflow

For large sites, you might want to:

1. Analyze a subset first
2. Review the archetypes
3. Run full extraction with optimized settings

### Integration with Laravel

The generated Blade templates are ready to use in Laravel:

1. Copy `templates/` to your Laravel `resources/views/` directory
2. Set up routes to use the templates
3. Create controllers to pass data to views
4. Use the Markdown content files with a package like `spatie/laravel-markdown`

## Support

For issues or questions:
1. Check the verbose output: `--verbose`
2. Review the extraction report: `extraction-report.json`
3. Try different threshold values
4. Examine the dry run output first

## Architecture

Templatify works in 7 phases:

1. **Parsing**: Load and normalize HTML files
2. **Pattern Analysis**: Generate structural fingerprints
3. **Component Extraction**: Identify repeated elements
4. **Archetype Classification**: Group similar pages
5. **Content Extraction**: Separate content from structure
6. **Template Generation**: Create Blade templates
7. **Output Writing**: Write files to disk

Each phase builds on the previous, ensuring accurate template extraction.



