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

let directory = args._[1] as string || "./";
const port = args.port;

// Strip "http://" or "https://" from the start if present
directory = directory.replace(/^https?:\/\//, "");

// Check if the directory exists
if (!(await exists(directory))) {
  console.error(`\x1b[31mError:\x1b[0m Directory "${directory}" not found.`);
  Deno.exit(1);
}

console.log(`Serving directory "${directory}" at http://localhost:${port}`);
serve((req) => serveDir(req, { fsRoot: directory }), { port });