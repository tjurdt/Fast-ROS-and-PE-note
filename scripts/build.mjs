import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderApp, rootDir } from "./lib/render-app.mjs";

const outputPath = path.join(rootDir, "index.html");
const next = await renderApp();
const current = await readFile(outputPath, "utf8").catch(() => null);

if (current === next) {
  console.log("index.html is already up to date.");
} else {
  await writeFile(outputPath, next);
  console.log("Built index.html from the source manifest.");
}
