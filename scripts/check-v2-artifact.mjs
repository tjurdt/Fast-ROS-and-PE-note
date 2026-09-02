import { readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const artifactPath = path.join(rootDir, "dist-v2", "index.html");
const html = await readFile(artifactPath, "utf8").catch(() => null);

if (!html) {
  console.error("Missing dist-v2/index.html. Run `npm run build:v2` first.");
  process.exit(1);
}

const failures = [];
if (html.length < 10_000) failures.push("artifact is unexpectedly small");
if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  failures.push("artifact contains an external script source");
}
if (/<link\b[^>]*\brel=["']?stylesheet\b/i.test(html)) {
  failures.push("artifact contains an external stylesheet");
}
if (!html.includes('id="root"')) failures.push("React root element is missing");
if (!html.includes("PE Note v2")) failures.push("v2 identity marker is missing");

if (failures.length > 0) {
  console.error(`v2 artifact checks failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("v2 is a self-contained single-file artifact.");
}
