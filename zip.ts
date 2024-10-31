// zip.ts
import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";

const args = parse(Deno.args);
const dir = args._[1] as string;
if (!dir) {
  console.error("Please provide a directory to zip.");
  Deno.exit(1);
}

const zipFilePath = `${dir}.zip`;

async function zipFolder(directory: string) {
  console.log(`\x1b[32mZipping folder: ${directory}\x1b[0m`);
  const zipProcess = Deno.run({
    cmd: ["zip", "-r", zipFilePath, directory],
    stdout: "piped",
  });
  await zipProcess.status();
  zipProcess.close();
  console.log(`\x1b[32mZipped to ${zipFilePath}\x1b[0m`);
}

await zipFolder(dir);
