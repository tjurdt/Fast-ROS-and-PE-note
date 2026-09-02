import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import { rootDir } from "./render-app.mjs";

const START_MARKER = "function T(";
const END_MARKER =
  "const SPEC_INDEX = {}; SPECIALTIES.forEach(s=>SPEC_INDEX[s.key]=s);";

export const clinicalCatalogPath = path.join(
  rootDir,
  "src",
  "domain",
  "clinical",
  "catalog.generated.json",
);

export async function readLegacyClinicalCatalog() {
  const legacyPath = path.join(rootDir, "src", "legacy", "app.js");
  const source = await readFile(legacyPath, "utf8");
  const start = source.indexOf(START_MARKER);
  const endMarkerStart = source.indexOf(END_MARKER, start);

  if (start < 0 || endMarkerStart < 0) {
    throw new Error("Cannot locate the legacy clinical catalog boundaries.");
  }

  const end = endMarkerStart + END_MARKER.length;
  const catalogSource = `${source.slice(start, end)}\nJSON.stringify({ sections: SECTIONS, specialties: SPECIALTIES });`;
  const serialized = vm.runInNewContext(catalogSource, Object.create(null), {
    filename: "legacy-clinical-catalog.vm.js",
    timeout: 1_000,
  });
  const catalog = JSON.parse(serialized);

  const itemIds = catalog.sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Legacy clinical catalog contains duplicate item IDs.");
  }

  return catalog;
}

export function serializeClinicalCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}
