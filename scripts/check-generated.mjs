import { readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const outputPath = path.join(rootDir, "index.html");
const sourcePath = path.join(rootDir, "dist-v2", "index.html");

const expected = await readFile(sourcePath, "utf8").catch(() => null);
if (expected === null) {
  console.error("Missing dist-v2/index.html. Run `npm run build:v2` first.");
  process.exitCode = 1;
} else {
  const actual = await readFile(outputPath, "utf8");
  if (actual !== expected) {
    console.error(
      "index.html is stale or was edited directly. Run `npm run build` and commit the generated result.",
    );
    process.exitCode = 1;
  } else {
    console.log("Generated index.html matches the v2 production bundle.");
  }
}
