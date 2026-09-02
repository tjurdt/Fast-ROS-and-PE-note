import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderApp, rootDir } from "./lib/render-app.mjs";

const outputPath = path.join(rootDir, "index.html");
const [actual, expected] = await Promise.all([
  readFile(outputPath, "utf8"),
  renderApp(),
]);

if (actual !== expected) {
  console.error(
    "index.html is stale or was edited directly. Run `npm run build` and commit the generated result.",
  );
  process.exitCode = 1;
} else {
  console.log("Generated index.html matches its sources.");
}
