import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assetManifest } from "../../config/assets.mjs";

export const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const TOKENS = Object.freeze({
  styles: "{{APP_CSS}}",
  scripts: "{{APP_JS}}",
});

function assertSingleToken(template, token) {
  const count = template.split(token).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one ${token} token, found ${count}.`);
  }
}

function resolveAsset(relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Asset paths must be relative: ${relativePath}`);
  }

  const absolutePath = path.resolve(rootDir, relativePath);
  const relativeToRoot = path.relative(rootDir, absolutePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Asset escapes the repository: ${relativePath}`);
  }
  return absolutePath;
}

async function combineAssets(paths, kind, eol) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error(`The ${kind} manifest must contain at least one source.`);
  }

  const uniquePaths = new Set(paths);
  if (uniquePaths.size !== paths.length) {
    throw new Error(`The ${kind} manifest contains duplicate paths.`);
  }

  const contents = await Promise.all(
    paths.map((relativePath) => readFile(resolveAsset(relativePath), "utf8")),
  );

  return contents
    .map((content, index) => {
      if (index === 0) return content;
      const label = paths[index].replaceAll("\\", "/");
      return `${eol}/* source: ${label} */${eol}${content}`;
    })
    .join("");
}

export async function renderApp() {
  const templatePath = path.join(rootDir, "src", "index.template.html");
  const template = await readFile(templatePath, "utf8");
  const eol = template.includes("\r\n") ? "\r\n" : "\n";

  assertSingleToken(template, TOKENS.styles);
  assertSingleToken(template, TOKENS.scripts);

  const [styles, scripts] = await Promise.all([
    combineAssets(assetManifest.styles, "styles", eol),
    combineAssets(assetManifest.scripts, "scripts", eol),
  ]);

  return template.replace(TOKENS.styles, styles).replace(TOKENS.scripts, scripts);
}
