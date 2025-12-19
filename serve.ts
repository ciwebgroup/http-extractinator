// serve.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.181.0/http/file_server.ts";
import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";
import { exists } from "https://deno.land/std@0.181.0/fs/mod.ts";

const args = parse(Deno.args, {
  default: {
    port: 8000,
  },
});

const siteDirectory = "./sites/"
const site = (args._[1] as string || "./").replace(/^https?:\/\//, "");
let port = args.port;

// Check if the directory exists
if (!(await exists(`${siteDirectory}${site}`))) {
  console.error(`\x1b[31mError:\x1b[0m Directory "${site}" not found.`);
  Deno.exit(1);
}

// Function to check if a port is available
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const listener = Deno.listen({ port });
    listener.close();
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.AddrInUse) {
      return false;
    }
    throw error;
  }
}

// Try to find an available port (max 20 attempts)
const maxAttempts = 20;
let attempt = 0;
let foundPort = false;

while (attempt < maxAttempts && !foundPort) {
  console.log(`\x1b[36mChecking port\x1b[0m ${port}...`);
  
  if (await isPortAvailable(port)) {
    foundPort = true;
    console.log(`\x1b[32m✓ Port ${port} is available\x1b[0m`);
    break;
  } else {
    console.log(`\x1b[33m⚠ Port ${port} is already in use, trying ${port + 1}...\x1b[0m`);
    port++;
    attempt++;
  }
}

if (!foundPort) {
  console.error(`\x1b[31mError:\x1b[0m Could not find an available port after ${maxAttempts} attempts (tried ${args.port}-${port - 1})`);
  Deno.exit(1);
}

// Start the server on the available port
console.log(`\x1b[36mServing\x1b[0m directory "${site}" at http://localhost:${port}`);
const handler = (req: Request) => serveDir(req, { fsRoot: `${siteDirectory}${site}` });

await serve(handler, { 
  port: port,
  onListen: () => {
    console.log(`\x1b[32m✓ Server started successfully\x1b[0m on http://localhost:${port}`);
    console.log(`\x1b[36mListening on\x1b[0m http://localhost:${port}/\n`);
  }
});