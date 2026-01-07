# http-extractinator

---

**http-extractinator** is a powerful [Deno](https://deno.com)-based tool for downloading and organizing assets (e.g., images, scripts, CSS) from a website, making it easy to extract and save static assets locally for offline access or further analysis.

**[Get Deno](https://docs.deno.com)

## Table of Contents
- [http-extractinator](#http-extractinator)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Options](#options)
    - [Examples](#examples)
  - [Resume \& Fault Tolerance](#resume--fault-tolerance)
    - [Features](#features-1)
    - [How It Works](#how-it-works)
    - [Resuming a Download](#resuming-a-download)
    - [Example Output](#example-output)
    - [Adjusting Parameters Mid-Stream](#adjusting-parameters-mid-stream)
    - [Manual State Management](#manual-state-management)
  - [Troubleshooting](#troubleshooting)
  - [Templatify - Reverse Template Engine](#templatify---reverse-template-engine)
    - [Features](#features-2)
    - [Templatify Usage](#templatify-usage)
    - [Templatify Options](#templatify-options)
    - [Output Structure](#output-structure)
    - [How It Works](#how-it-works-1)
  - [Documentation](#documentation)
  - [Files](#files)

## Features
- Downloads assets such as images, scripts, styles, fonts, and icons from a specified domain.
- Saves assets in a structured, easy-to-navigate directory format.
- Supports configurable **throttling** and **concurrency** to control download rates.
- **Domain whitelisting** - Skip downloading from specific domains (e.g., Google Fonts, Analytics CDNs).
- **Fault-tolerant downloads** - Failed downloads are logged but don't stop the entire process.
- **Resume capability** - Automatically saves progress and can resume interrupted extractions.
- **Sanitizes filenames** for compatibility with local file systems.
- Respects `srcset` and `src` attribute handling to avoid redundant downloads.
- **State tracking** with `.summary.json` manifest including queues, progress, and failure logs.
- **NEW: Templatify** - Reverse-engineer templates from downloaded static sites, extracting reusable components and content.

## Requirements
- **Deno**: [Install Deno](https://deno.land/manual/getting_started/installation)
- **Network access** for asset download

## Installation

To install **http-extractinator** as a standalone executable:

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/http-extractinator.git
   cd http-extractinator
   ```

2. Build the standalone executable:
   ```bash
   deno compile --allow-net --allow-read --allow-write --output http-extractinator src/http-extractinator.ts
   ```

3. Run the `http-extractinator` executable:
   ```bash
   ./http-extractinator --help
   ```

## Usage

```bash
http-extractinator <URL> [options]
```

The command downloads assets from the provided URL, organizes them by asset type, and saves them in a structured directory under `/sites/<domain>`.

### Options

| Option           | Description                                                                                      |
|------------------|--------------------------------------------------------------------------------------------------|
| `--throttle`     | Sets a delay (in milliseconds) between each download (default: `300`).                           |
| `--concurrent`   | Specifies the maximum number of concurrent downloads (default: `5`).                             |
| `--max-pages`    | Limits the number of pages to crawl (default: unlimited). Useful for testing.                    |
| `--skip-domains` | Comma-separated domains to skip downloading from (keeps as external references).                 |
| `--user-agent`   | Sets a custom user agent for the requests.                                                       |
| `--output-dir`   | Specifies the directory where assets should be saved (default: `./sites/<domain>`).              |
| `--help`         | Displays usage information and options.                                                          |

### Examples

- **Download assets from a site with default settings**:
  ```bash
  http-extractinator https://example.com
  ```

- **Throttle requests to 500ms and limit concurrency to 3**:
  ```bash
  http-extractinator https://example.com --throttle=500 --concurrent=3
  ```

- **Specify a custom output directory**:
  ```bash
  http-extractinator https://example.com --output-dir=./downloaded_assets
  ```

- **Use a custom user agent**:
  ```bash
  http-extractinator https://example.com --user-agent="CustomUserAgent/1.0"
  ```

- **Limit crawl to first 10 pages (useful for testing)**:
  ```bash
  http-extractinator https://example.com --max-pages=10
  ```

- **Skip external CDN domains** (Google Fonts, Analytics, etc.):
  ```bash
  deno task copy https://example.com --skip-domains="fonts.googleapis.com,www.googletagmanager.com,cdn.trustindex.io"
  ```

## Skip Domains (Whitelist)

The `--skip-domains` option allows you to exclude specific domains from being downloaded. This is useful for:

- **Public CDNs**: Keep Google Fonts, Google Analytics, and other CDN resources as external links
- **Third-party widgets**: Skip downloading tracking scripts, chat widgets, etc.
- **Performance**: Reduce download time and storage by excluding unnecessary external resources

**Example usage:**
```bash
deno task copy https://www.designroofservicesllc.com/ \
  https://cdn.example.com \
  --skip-domains="fonts.googleapis.com,www.googletagmanager.com,cdn.trustindex.io"
```

When a domain is skipped:
- Assets from that domain won't be downloaded
- The original external URLs remain unchanged in the HTML/CSS
- Skipped assets are counted and displayed in the final summary
- All skipped domains are logged in `.summary.json`

**Common domains to skip:**
- `fonts.googleapis.com` - Google Fonts
- `fonts.gstatic.com` - Google Fonts assets
- `www.googletagmanager.com` - Google Tag Manager
- `www.google-analytics.com` - Google Analytics
- `cdn.trustindex.io` - Trustindex widgets
- `connect.facebook.net` - Facebook SDK
- `platform.twitter.com` - Twitter widgets

## Resume & Fault Tolerance

**http-extractinator** includes robust fault-tolerance and resume capabilities, making it perfect for extracting large websites or dealing with unreliable network connections.

### Features

- **Automatic State Saving**: Progress is automatically saved every 10 operations to `.summary.json` in the site directory
- **Resume from Interruption**: If the process is stopped (Ctrl+C, crash, or network failure), simply run the same command again to resume
- **Fault-Tolerant Downloads**: Failed downloads are logged but don't stop the entire process
- **Detailed Failure Log**: All failures are tracked with timestamps and error messages

### How It Works

When you run the copy command, http-extractinator creates a `.summary.json` file in `sites/<domain>/` that tracks:

- **Visited Pages**: URLs already crawled
- **Crawl Queue**: Remaining pages to visit
- **Asset Queue**: Remaining assets to download
- **Downloaded Assets**: Assets successfully saved
- **Failed Downloads**: URLs that failed with error details
- **Statistics**: Pages processed, assets downloaded, failure count, timestamps

### Resuming a Download

If your extraction is interrupted for any reason:

1. The state is saved in `sites/<domain>/.summary.json`
2. Simply run the same command again:
   ```bash
   deno task copy https://example.com [same options and domains]
   ```
3. http-extractinator will detect the existing session and resume from where it left off

### Example Output

```
📂 Resuming from previous session
   Pages visited: 45
   Pages in queue: 12
   Assets downloaded: 234
   Assets in queue: 89
   Failed downloads: 3

🚀 Starting extraction
   URL: https://example.com
   Additional domains: 5
   Throttle: 300ms
   Concurrent: 5

✓ Saved page: https://example.com/about
✓ Downloaded: https://cdn.example.com/image.jpg
❌ Failed (asset): https://cdn.example.com/missing.png
   Error: HTTP 404: Not Found

═══════════════════════════════════════════
✅ Extraction Complete!
═══════════════════════════════════════════
   Pages processed: 57
   Assets downloaded: 323
   Total failures: 4
   Output directory: ./sites/example.com

⚠ Failed Downloads (4):
   See ./sites/example.com/.summary.json for details
   1. [asset] https://cdn.example.com/missing.png
      HTTP 404: Not Found
   2. [asset] https://cdn.example.com/broken.js
      connection reset
```

### Adjusting Parameters Mid-Stream

You can stop the extraction (Ctrl+C) and resume with different parameters:

```bash
# Start with default settings
deno task copy https://example.com

# Stop it (Ctrl+C), then resume with more aggressive settings
deno task copy https://example.com --throttle=100 --concurrent=10
```

**Note**: Changing the URL or domain list will start a fresh extraction, as the configuration is validated on resume.

### Manual State Management

- **View Progress**: Check `sites/<domain>/.summary.json` to see current state
- **Reset Extraction**: Delete `.summary.json` to start fresh
- **Retry Failed Downloads**: Remove entries from `downloadedAssets` array to retry specific items

## Troubleshooting

- **Assets aren’t appearing in the specified folder**:
  - Make sure the URL you provided is accessible.
  - Verify that you have write permissions for the specified output directory.

- **Experiencing `404` errors**:
  - Check if the asset URLs are being sanitized correctly. If double-encoded spaces or special characters are an issue, try adjusting `sanitizeFilename()` in `src/http-extractinator.ts`.

- **Executable won’t run on Windows**:
  - Ensure you used the `.exe` extension when building on Windows:
    ```bash
    deno compile --allow-net --allow-read --allow-write --output http-extractinator.exe src/http-extractinator.ts
    ```

---

Feel free to adjust the `README.md` based on additional features, usage details, or specific instructions unique to `http-extractinator`!

## Templatify - Reverse Template Engine

**Templatify** analyzes downloaded static sites and reverse-engineers them into reusable templates and content files. Perfect for migrating from static sites to template-based systems like Laravel Blade.

### Features

- **Pattern Detection**: Automatically identifies repeated components (header, footer, navigation, etc.)
- **Archetype Classification**: Groups similar pages together (blog posts, products, landing pages)
- **Component Extraction**: Extracts reusable template components
- **Content Separation**: Separates dynamic content from static structure
- **Markdown Conversion**: Converts HTML content to Markdown format
- **Blade Template Generation**: Outputs production-ready Laravel Blade templates

### Templatify Usage

```bash
# Analyze a downloaded site
deno task templatify --site=www.example.com

# Specify output directory
deno task templatify --site=www.example.com --output=./templates

# Dry run to see what would be generated
deno task templatify --site=www.example.com --dry-run --verbose

# Adjust similarity threshold for component detection
deno task templatify --site=www.example.com --threshold=0.85
```

### Templatify Options

| Option         | Description                                                     |
|----------------|-----------------------------------------------------------------|
| `--site, -s`   | Site name in the `sites/` directory (required)                 |
| `--output, -o` | Output directory for templates and content (default: `./output`) |
| `--threshold, -t` | Similarity threshold for component detection 0-1 (default: 0.8) |
| `--verbose, -v` | Enable detailed logging of the analysis process                |
| `--dry-run`    | Analyze and report without writing files                        |

### Output Structure

```
output/
├── templates/
│   ├── layouts/
│   │   └── master.blade.php          # Base layout template
│   ├── components/
│   │   ├── header.blade.php          # Header component
│   │   ├── footer.blade.php          # Footer component
│   │   └── navigation.blade.php      # Navigation component
│   └── pages/
│       ├── blog-post.blade.php       # Blog post archetype
│       └── homepage.blade.php        # Homepage archetype
├── content/
│   └── pages/
│       ├── about.md                  # Page content in Markdown
│       └── post-1.md                 # Blog post content
├── manifest.json                      # Template mapping manifest
└── extraction-report.json             # Detailed analysis report
```

### How It Works

1. **Parsing**: Loads and parses all HTML files in the site
2. **Pattern Analysis**: Generates structural fingerprints and identifies similarities
3. **Component Detection**: Finds elements that repeat across 80%+ of pages
4. **Archetype Classification**: Groups pages by structural similarity
5. **Content Extraction**: Separates content from structure and converts to Markdown
6. **Template Generation**: Creates Blade templates with proper syntax and variables

## Documentation

Additional documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [TEMPLATIFY_GUIDE.md](docs/TEMPLATIFY_GUIDE.md) | Comprehensive guide for the Templatify feature |
| [SPECIFICATION-STATIC-ASSET-REMAPPING-USING-REGEX.md](docs/SPECIFICATION-STATIC-ASSET-REMAPPING-USING-REGEX.md) | Technical specification for URL rewriting |
| [REGEX-SPEC-FOR-WEB-ASSETS.md](docs/REGEX-SPEC-FOR-WEB-ASSETS.md) | Regex patterns for web asset handling |
| [ALL_PATTERNS.md](docs/ALL_PATTERNS.md) | Complete pattern reference |
| [AP_COMPRESSED.md](docs/AP_COMPRESSED.md) | Compressed pattern documentation |

## Files
```
http-extractinator/
├── copy.ts                    # Handles site copying functionality
├── zip.ts                     # Handles zipping functionality
├── serve.ts                   # Handles serving functionality
├── help.ts                    # Outputs usage information
├── main.ts                    # Main entry point to invoke each task
├── templatify.ts              # Templatify main command
├── lib/
│   ├── types.ts               # TypeScript type definitions
│   ├── parser.ts              # HTML parsing and normalization
│   ├── fingerprint.ts         # Structural fingerprinting algorithms
│   ├── analyzer.ts            # Pattern detection engine
│   ├── component-extractor.ts # Component identification and extraction
│   ├── content-extractor.ts   # Content extraction and Markdown conversion
│   ├── archetype-classifier.ts # Page classification system
│   ├── url-rewriter.ts        # URL rewriting for local assets
│   └── template-generator.ts  # Blade template generation
├── docs/                      # Additional documentation
│   ├── TEMPLATIFY_GUIDE.md
│   ├── SPECIFICATION-STATIC-ASSET-REMAPPING-USING-REGEX.md
│   ├── REGEX-SPEC-FOR-WEB-ASSETS.md
│   ├── ALL_PATTERNS.md
│   └── AP_COMPRESSED.md
└── deno.json                  # Configuration file with task definitions
```