import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";
import { ensureDir, exists } from "https://deno.land/std@0.181.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

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

const allDomains = args._;

allDomains.shift();

// TODO: Validate these are all actual domains if not throw an error

// allDomains.forEach((domain) => {
//   if (!domain.startsWith("http")) {
//     throw new Error("All domains must start with http or https");
//   }
// });

const domain = new URL(startUrl).hostname;
const outputDir = `./${domain}`;
const visitedPages = new Set<string>();
const aliases = Array.isArray(args.alias)
  ? args.alias
  : [args.alias].filter(Boolean); // Support multiple aliases

await ensureDir(outputDir);
await ensureDir(path.join(outputDir, "scripts"));
await ensureDir(path.join(outputDir, "styles"));
await ensureDir(path.join(outputDir, "images"));

// Function to categorize assets by type based on extension
function getAssetType(url: URL): "scripts" | "styles" | "images" | null {
  const extension = url.pathname.split(".").pop();
  if (extension) {
    if (["js"].includes(extension)) return "scripts";
    if (["css"].includes(extension)) return "styles";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(extension))
      return "images";
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
      assetType,
      path.basename(assetUrl.pathname)
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

  // Replace alias domains with relative paths for local assets
  allDomains.forEach((url) => {  
    const domain = new URL(url).hostname;
    // replace the main domain with relative paths for any links to local assets: images, scripts, styles
   
    // Replace image paths with relative URI paths
    html = html.replace(
      new RegExp(`https?:\/\/(?:www\.)?${domain}\/([^"']+\\.(jpg|jpeg|png|gif|webp|svg|bmp))(?=['"\\s>])`, "g"),
      "/images/$1"
    );

    // Replace script paths with relative URI paths
    html = html.replace(
      new RegExp(`https?:\/\/(?:www\.)?${domain}\/([^"']+\\.(js))(?=['"\\s>])`, "g"),
      "/scripts/$1"
    );

    // Replace style paths with relative URI paths
    html = html.replace(
      new RegExp(`https?:\/\/(?:www\.)?${domain}\/([^"']+\\.(css))(?=['"\\s>])`, "g"),
      "/styles/$1"
    );

    // Replace font and other link paths
    html = html.replace(
      new RegExp(`https?:\/\/(?:www\.)?${domain}\/([^"']+)(?=['"\\s>])`, "g"),
      "/assets/$1"
    );


    console.log("domain", domain);

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

  await discoverLinksAndAssets(html, pageUrl);
}

// Discover links and assets within HTML content
async function discoverLinksAndAssets(html: string, baseUrl: URL) {
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

  allDomains.forEach((domain) => {
    
    const currentUrl = new URL(domain).hostname;
    const allStaticAssetsRegExp = new RegExp(`https?:\\/\\/(?:www\\.)?${currentUrl}\\/[^\"' ]+\\.(css|js|png|jpg|jpeg|gif|webp|svg|bmp|ico|woff2?|ttf|otf|eot)(?=['\"\\s>])`, "gi");        
    const allStaticAssets = html.match(allStaticAssetsRegExp) ?? [];
   
    allStaticAssets.forEach((url) => {
      const assetUrl = new URL(url);
      if (!assetQueue.includes(assetUrl)) {
        assetQueue.push(assetUrl);
      }
    });

  })
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

