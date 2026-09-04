import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const sourcePath = path.join(rootDir, "dist-v2", "index.html");
const outputPath = path.join(rootDir, "index.html");

let next;
try {
  next = await readFile(sourcePath, "utf8");
} catch {
  console.error("Missing dist-v2/index.html. Run `npm run build:v2` first.");
  process.exit(1);
}

const current = await readFile(outputPath, "utf8").catch(() => null);

if (current === next) {
  console.log("index.html is already up to date.");
} else {
  await copyFile(sourcePath, outputPath);
  console.log("Promoted dist-v2/index.html to index.html.");
}
