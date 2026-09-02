import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assetManifest } from "../config/assets.mjs";
import { rootDir } from "./lib/render-app.mjs";

const failures = [];
const fail = (message) => failures.push(message);
const slash = (value) => value.replaceAll("\\", "/");

if (assetManifest.styles[0] !== "src/styles/app.css") {
  fail("src/styles/app.css must remain the first style source.");
}
if (assetManifest.scripts[0] !== "src/legacy/app.js") {
  fail("src/legacy/app.js must remain the first script source.");
}

for (const [kind, sources] of Object.entries(assetManifest)) {
  for (const source of sources) {
    const normalized = slash(source);
    const allowed =
      kind === "styles"
        ? /^src\/(styles|features)\/.+\.css$/.test(normalized)
        : /^src\/(legacy|core|features)\/.+\.js$/.test(normalized);
    if (!allowed) fail(`Unexpected ${kind} source location: ${source}`);
    await access(path.join(rootDir, source)).catch(() =>
      fail(`Manifest source does not exist: ${source}`),
    );

    const featureMatch = normalized.match(/^src\/features\/([^/]+)\//);
    if (featureMatch) {
      const readmePath = path.join(
        rootDir,
        "src",
        "features",
        featureMatch[1],
        "README.md",
      );
      await access(readmePath).catch(() =>
        fail(`Feature ${featureMatch[1]} needs its own README.md contract.`),
      );
    }
  }
}

const template = await readFile(
  path.join(rootDir, "src", "index.template.html"),
  "utf8",
);
const legacy = await readFile(path.join(rootDir, "src", "legacy", "app.js"), "utf8");
const cssSources = await Promise.all(
  assetManifest.styles.map((source) => readFile(path.join(rootDir, source), "utf8")),
);
const jsSources = await Promise.all(
  assetManifest.scripts.map((source) => readFile(path.join(rootDir, source), "utf8")),
);

if ((template.match(/{{APP_CSS}}/g) ?? []).length !== 1) {
  fail("The HTML template needs exactly one {{APP_CSS}} slot.");
}
if ((template.match(/{{APP_JS}}/g) ?? []).length !== 1) {
  fail("The HTML template needs exactly one {{APP_JS}} slot.");
}
if (/<script\b[^>]*\bsrc\s*=/i.test(template)) {
  fail("Static script dependencies break the single-file offline contract.");
}
if (/<link\b[^>]*\brel=["']?stylesheet\b/i.test(template)) {
  fail("Static stylesheet dependencies break the single-file offline contract.");
}
if (cssSources.some((source) => /<\/style/i.test(source))) {
  fail("A CSS source contains </style and can escape the inline style block.");
}
if (jsSources.some((source) => /<\/script/i.test(source))) {
  fail("A JavaScript source contains </script and can escape the inline script block.");
}

const staticIds = [...template.matchAll(/\bid=["']([^"']+)["']/g)].map(
  (match) => match[1],
);
const requiredIds = [
  "wrap",
  "scrim",
  "toast",
  "exportModal",
  "setEditor",
  "storageModal",
  "syncConflictModal",
];
for (const id of requiredIds) {
  const count = staticIds.filter((candidate) => candidate === id).length;
  if (count !== 1) fail(`Required static element #${id} appears ${count} times.`);
}

const persistenceContracts = [
  'const KEY = "rounding_notes_v1"',
  'const STORAGE_MODE_KEY = "rounding_storage_mode_v2"',
  'schema:"rounding-notes-cloud-v1"',
  'const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"',
];
for (const contract of persistenceContracts) {
  if (!legacy.includes(contract)) fail(`Missing persistence contract: ${contract}`);
}

const secretPatterns = [
  /client[_-]?secret\s*[:=]/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /AIza[0-9A-Za-z_-]{35}/,
];
const securityInput = `${template}\n${cssSources.join("\n")}\n${jsSources.join("\n")}`;
for (const pattern of secretPatterns) {
  if (pattern.test(securityInput))
    fail(`Possible committed secret matched ${pattern}.`);
}

const legacyEntries = await readdir(path.join(rootDir, "src", "legacy"));
if (legacyEntries.length !== 1 || legacyEntries[0] !== "app.js") {
  fail("src/legacy/ is frozen and may contain only app.js.");
}

if (failures.length > 0) {
  console.error(`Architecture checks failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Architecture, offline, persistence, and secret checks passed.");
}
