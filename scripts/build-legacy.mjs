import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderApp, rootDir } from "./lib/render-app.mjs";

const outputDir = path.join(rootDir, "dist-legacy");
const outputPath = path.join(outputDir, "index.html");
const next = await renderApp();
await mkdir(outputDir, { recursive: true });
const current = await readFile(outputPath, "utf8").catch(() => null);

if (current === next) {
  console.log("dist-legacy/index.html is already up to date.");
} else {
  await writeFile(outputPath, next);
  console.log("Built dist-legacy/index.html from the frozen legacy source manifest.");
}
