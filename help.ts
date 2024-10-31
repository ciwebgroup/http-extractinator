// help.ts
console.log(`
    Usage:
      deno task <command> [options] <URL or Directory>
  
    Commands:
      copy    Copies a website from the specified URL
              Options:
                --throttle, -t    Set delay in ms between requests (default: 300)
                --concurrent, -c  Maximum concurrent connections (default: 5)
                --user-agent, -u  Specify a custom user-agent
                --alias, -r       Domains to treat as main URL for assets
  
      zip     Zips the specified directory
              Usage: deno task zip <directory>
  
      serve   Serves the specified directory
              Options:
                --port, -p        Set the port to serve on (default: 8000)
  
      help    Displays this help text
  `);
  