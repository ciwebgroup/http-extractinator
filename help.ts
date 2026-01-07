// help.ts
console.log(`
    Usage:
      deno task copy [options] <URL> [alias] [alias] [...]
      deno task serve [options] <Directory>
      deno task zip [options] <Directory>
      deno task templatify [options] --site=<site-name>
      deno task help
  
    Commands:
      copy        Copies a website from the specified URL
                  Options:
                    --throttle, -t      Set delay in ms between requests (default: 300)
                    --concurrent, -c    Maximum concurrent connections (default: 5)
                    --max-pages, -m     Maximum pages to crawl (default: unlimited)
                    --skip-domains      Comma-separated domains to skip downloading from
                                        (e.g., "fonts.googleapis.com,cdn.trustindex.io")
                    --user-agent, -u    Specify a custom user-agent
                  aliases:              Add URLs to copy from and replace with relative paths
  
      zip         Zips the specified directory
                  Usage: deno task zip <directory>
  
      serve       Serves the specified directory
                  Options:
                    --port, -p        Set the port to serve on (default: 8000)
  
      templatify  Reverse-engineer templates from static HTML sites
                  Options:
                    --site, -s        Site name in sites/ directory (required)
                    --output, -o      Output directory (default: ./output)
                    --threshold, -t   Similarity threshold 0-1 (default: 0.8)
                    --verbose, -v     Enable verbose logging
                    --dry-run         Analyze only, don't write files
                  Usage: deno task templatify --site=www.example.com
  
      simulate    Debug URL rewriting patterns on any URL
                  Downloads HTML/CSS/JS to temp directory and shows all regex replacements
                  Usage: deno task simulate <URL>
                  Example: deno task simulate https://www.example.com
  
      help        Displays this help text
  `);
  