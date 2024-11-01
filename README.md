# http-extractinator

---

**http-extractinator** is a powerful Deno-based tool for downloading and organizing assets (e.g., images, scripts, CSS) from a website, making it easy to extract and save static assets locally for offline access or further analysis.

## Table of Contents
- [http-extractinator](#http-extractinator)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Options](#options)
    - [Examples](#examples)
  - [Troubleshooting](#troubleshooting)
  - [Files](#files)

## Features
- Downloads assets such as images, scripts, styles, fonts, and icons from a specified domain.
- Saves assets in a structured, easy-to-navigate directory format.
- Supports configurable **throttling** and **concurrency** to control download rates.
- **Sanitizes filenames** for compatibility with local file systems.
- Respects `srcset` and `src` attribute handling to avoid redundant downloads.

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

## Files
```
http-extract/
├── copy.ts       # Handles site copying functionality
├── zip.ts        # Handles zipping functionality
├── serve.ts      # Handles serving functionality
├── help.ts       # Outputs usage information
├── main.ts       # Main entry point to invoke each task
└── deno.json     # Configuration file with task definitions
```