import { parse } from "https://deno.land/std@0.181.0/flags/mod.ts";

const args = parse(Deno.args);
const task = args._[0];

switch (task) {
  case "copy":
    await import("./copy.ts");
    break;
  case "zip":
    await import("./zip.ts");
    break;
  case "serve":
    await import("./serve.ts");
    break;
  case "help":
  default:
    await import("./help.ts");
    break;
}
