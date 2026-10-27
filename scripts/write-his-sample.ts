// Writes lib/his-sample.ts out as files: npm run his-sample
import { mkdirSync, writeFileSync } from "node:fs";
import { hisSample } from "../lib/his-sample.ts";
mkdirSync("samples/his-16", { recursive: true });
for (const [name, text] of Object.entries(hisSample))
  writeFileSync(`samples/his-16/${name}.txt`, text + "\r\n");
console.log("wrote samples/his-16");
