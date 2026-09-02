import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const sourceRoot = path.join(rootDir, "src");
const layerDirectories = [
  "app",
  "application",
  "domain",
  "features",
  "infrastructure",
  "ui",
];
const files = [];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolutePath);
    else if (/\.tsx?$/.test(entry.name)) files.push(absolutePath);
  }
}

for (const directory of layerDirectories) {
  await collect(path.join(sourceRoot, directory));
}

const allowedDependencies = {
  app: new Set(["app", "application", "domain", "features", "infrastructure", "ui"]),
  application: new Set(["application", "domain"]),
  domain: new Set(["domain"]),
  features: new Set(["application", "domain", "features", "ui"]),
  infrastructure: new Set(["application", "domain", "infrastructure"]),
  ui: new Set(["ui"]),
};
const failures = [];

function sourceLayer(relativePath) {
  return relativePath.split("/")[0];
}

function featureName(relativePath) {
  const parts = relativePath.split("/");
  return parts[0] === "features" ? parts[1] : null;
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  const relativeSource = path.relative(sourceRoot, file).replaceAll("\\", "/");
  const fromLayer = sourceLayer(relativeSource);
  const imports = [
    ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s+["']([^"']+)["']/g),
  ].map((match) => match[1]);

  for (const imported of imports) {
    if (!imported.startsWith(".")) continue;
    const target = path.resolve(path.dirname(file), imported);
    const relativeTarget = path.relative(sourceRoot, target).replaceAll("\\", "/");
    const toLayer = sourceLayer(relativeTarget);
    if (!allowedDependencies[fromLayer]?.has(toLayer)) {
      failures.push(`${relativeSource} may not depend on ${relativeTarget}`);
    }
    if (
      fromLayer === "features" &&
      toLayer === "features" &&
      featureName(relativeSource) !== featureName(relativeTarget)
    ) {
      failures.push(`${relativeSource} crosses into feature ${relativeTarget}`);
    }
  }

  if (
    (fromLayer === "domain" || fromLayer === "application") &&
    /\b(?:window|document|localStorage|sessionStorage|fetch)\b/.test(source)
  ) {
    failures.push(`${relativeSource} uses a browser/infrastructure global.`);
  }
}

if (failures.length > 0) {
  console.error(`v2 dependency boundary checks failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`v2 dependency boundaries are valid across ${files.length} files.`);
}
