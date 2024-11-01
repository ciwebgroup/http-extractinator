import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.181.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

// Parse arguments
const args = parse(Deno.args, {
  default: {
    throttle: 300,
    concurrent: 5,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
});

const startUrl = args._[1] as string;
if (!startUrl) {
  console.error("Please provide a URL to copy.");
  Deno.exit(1);
}

const allDomains: string[] = args._ as string[];

allDomains.shift();

const domain = new URL(startUrl).hostname;
const outputDir = `./sites/${domain}`;
const visitedPages = new Set<string>();

await ensureDir(outputDir);
await ensureDir(path.join(outputDir, "assets/scripts"));
await ensureDir(path.join(outputDir, "assets/styles"));
await ensureDir(path.join(outputDir, "assets/images"));
await ensureDir(path.join(outputDir, "assets/fonts"));
await ensureDir(path.join(outputDir, "assets/icons"));

// Sanitize filename function with double URL decoding
function sanitizeFilename(filename: string): string {
  // Decode double-encoded spaces and any other double-encoded characters
  return decodeURIComponent(filename)
    .toLowerCase()
    .replace(/%20|[\s]+/g, "-"); // Replace spaces with dashes
}

// Function to categorize assets by type based on extension
function getAssetType(url: URL): "scripts" | "styles" | "images" | "fonts" | "icons" | null {

  const extension = url.pathname.split(".").pop();

  if (extension) {
    if (["js"].includes(extension)) return "scripts";
    if (["css"].includes(extension)) return "styles";
    if (["avif", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(extension)) return "images";
    if (["woff", "woff2", "ttf", "otf", "eot"].includes(extension)) return "fonts";
    if (["ico"].includes(extension)) return "icons";
  }

  return null;
}

// Download and save an asset based on its type
async function downloadAsset(assetUrl: URL) {

  const assetType = getAssetType(assetUrl);

  if (!assetType) return;

  const response = await fetch(assetUrl.href, {
    headers: { "User-Agent": args["user-agent"] },
  });

  if (response.ok) {

    const data = new Uint8Array(await response.arrayBuffer());

    const savePath = path.join(
      outputDir,
      'assets',
      assetType,
      sanitizeFilename( path.basename(assetUrl.pathname) )
    );

    await Deno.writeFile(savePath, data);

    console.log(`\x1b[32mDownloaded\x1b[0m: ${assetUrl.href} to ${savePath}`);

    if (assetType === "styles") {
      const cssText = new TextDecoder().decode(data);
      await discoverAssetsInCSS(cssText, assetUrl);
    }
  } else {
    console.error(`\x1b[31mFailed to download\x1b[0m: ${assetUrl.href}`);
  }
}

// Discover additional assets referenced in CSS files
async function discoverAssetsInCSS(cssText: string, baseUrl: URL) {
  const assetUrls = cssText.match(/url\(['"]?([^'")]+)['"]?\)/g) || [];
  for (const match of assetUrls) {
    const assetPath = match.replace(/url\(['"]?|['"]?\)/g, "");
    const assetUrl = new URL(assetPath, baseUrl);
    await downloadAsset(assetUrl);
  }
}

// Process a page, discover links and assets, enqueue them as needed
async function processPage(pageUrl: URL) {
  // Remove the fragment (if any) from the URL
  pageUrl.hash = "";

  if (visitedPages.has(pageUrl.href)) return; // Avoid duplicates

  visitedPages.add(pageUrl.href);

  const response = await fetch(pageUrl.href, {
    headers: { "User-Agent": args["user-agent"] },
  });

  if (!response.ok) {
    console.error(`\x1b[31mFailed to retrieve\x1b[0m: ${pageUrl.href}`);
    return;
  }

  let html = await response.text();

  await discoverLinksAndAssets(html, pageUrl);

  // Replace alias domains with relative paths for local assets
  allDomains.forEach((url) => {  

    const domain = new URL(url).hostname;
   
    // Replace image paths with relative URI paths
    html = html.replace(
      new RegExp(`src=["'](https?:\\/\\/(?:www\\.)?${domain}\\/[^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))["']`, "gi"),
      (_, url) => `src="/assets/images/${sanitizeFilename(path.basename(url))}"`
    ).replace(
      new RegExp(`srcset=["']((https?:\\/\\/(?:www\\.)?${domain}\\/[^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\\s\\d+w)?,?\\s*)+)["']`, "gi"),
      (_, srcset) => {
        const updatedSrcset = srcset
          .split(",") // Split by comma to get individual URLs with resolutions
          .map((entry: string) => {
            const [url, size] = entry.trim().split(/\s+/); // Separate the URL and size (e.g., "500w")
            const filename = sanitizeFilename(path.basename(url));
            return `/assets/images/${filename} ${size || ""}`.trim(); // Reconstruct the entry with the sanitized URL
          })
          .join(", "); // Rejoin with commas
        return `srcset="${updatedSrcset}"`;
      }
    ).replace(
      new RegExp(`https?:\/\/(?:www\\.)?${domain}\/[^\/]+\/([^"']+\\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))(?=['"\\s>])`, "g"),
      (_, filename) => `/assets/images/${sanitizeFilename(filename)}`
      // "/assets/images/$1"
    ).replace(
      new RegExp(`https?:\/\/(?:www\\.)?${domain}\/(?:[^\/]+\/)*([^"']+\\.(js))(?=['"\\s>])`, "g"),
      // "/assets/scripts/$1"
      (_, filename) => `/assets/scripts/${sanitizeFilename(filename)}`
    ).replace(
      new RegExp(`https?:\/\/(?:www\\.)?${domain}\/(?:[^\/]+\/)*([^"']+\\.(css))(?=['"\\s>])`, "g"),
      // "/assets/styles/$1"
      (_, filename) => `/assets/styles/${sanitizeFilename(filename)}`
    ).replace(
      new RegExp(`https?:\/\/(?:www\\.)?${domain}\/[^\/]+\/([^"']+\\.(woff|woff2|ttf|otf|eot))(?=['"\\s>])`, "g"),
      // "/assets/fonts/$1"
      (_, filename) => `/assets/fonts/${sanitizeFilename(filename)}`
    ).replace(
      new RegExp(`https?:\/\/(?:www\\.)?${domain}\/[^\/]+\/([^"']+\\.(ico))(?=['"\\s>])`, "g"),
      // "/assets/icons/$1"
      (_, filename) => `/assets/icons/${sanitizeFilename(filename)}`
    ).replace(/\r\n|\r/g, "\n");

  });

  // Determine save path, handling trailing slashes and no file extension
  let savePath: string;
  if (pageUrl.pathname.endsWith("/") || !path.extname(pageUrl.pathname)) {
    savePath = path.join(outputDir, pageUrl.pathname, "index.html");
  } else {
    savePath = path.join(outputDir, `${pageUrl.pathname}.html`);
  }

  await ensureDir(path.dirname(savePath));
  await Deno.writeTextFile(savePath, html);
  console.log(`\x1b[32mSaved page\x1b[0m: ${pageUrl.href} to ${savePath}`);
}

// Discover links and assets within HTML content
function discoverLinksAndAssets(html: string, baseUrl: URL) {
  const document = new DOMParser().parseFromString(html, "text/html");
  if (!document) return;

  // Enqueue linked pages
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      const absoluteUrl = new URL(href, baseUrl);
      if (
        absoluteUrl.hostname === domain &&
        !visitedPages.has(absoluteUrl.href)
      ) {
        crawlQueue.push(absoluteUrl);
      }
    }
  });

  // console.log('html', html);
  allDomains.forEach((url) => {
    
    const domain = new URL(url).hostname;

    const allStaticAssetsRegExpString = `https?:\\/\\/(?:www\\.)?${domain}\\/[^\"' ]+\\.(css|png|avif|jpg|jpeg|gif|webp|svg|bmp|js|ico|woff2?|ttf|otf|eot)(?=['\"\\s>])`;

    // console.log('allStaticAssetsRegExpString', allStaticAssetsRegExpString);

    const allStaticAssetsRegExp = new RegExp(allStaticAssetsRegExpString, "gi");        
    const allStaticAssets = html.match(allStaticAssetsRegExp) ?? [];

    // console.log('allStaticAssets', allStaticAssets);
   
    allStaticAssets.forEach((assetUrlString) => {
      const assetUrl = new URL(assetUrlString);
      if (!assetQueue.includes(assetUrl)) {
        assetQueue.push(assetUrl);
      }
    });

  });


}

// Queues for pages to crawl and assets to download
const crawlQueue: URL[] = [new URL(startUrl)];
const assetQueue: URL[] = [];

// Process each page in the crawl queue
while (crawlQueue.length > 0) {
  const pageUrl = crawlQueue.shift();
  if (pageUrl) await processPage(pageUrl);
}

console.log(`Downloading ${assetQueue.length} assets...`);

// Process each asset in the asset queue
while (assetQueue.length > 0) {
  const assetUrl = assetQueue.shift();
  if (assetUrl) await downloadAsset(assetUrl);
}

