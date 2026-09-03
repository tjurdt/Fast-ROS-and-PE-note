import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import { rootDir } from "./render-app.mjs";

const START_MARKER = "function T(";
const END_MARKER =
  "const SPEC_INDEX = {}; SPECIALTIES.forEach(s=>SPEC_INDEX[s.key]=s);";
const WIDGET_START_MARKER = "const DTR_SITES=[";
const WIDGET_END_MARKER = "function sensoryState(v){";
const ADL_START_MARKER = "const ADL_LEVELS =";
const ADL_END_MARKER = "function adlDependent(a)";
const PMH_START_MARKER = "const PMH_COMMON=[";
const PMH_END_MARKER = "function addPmh(text){";
const ADMISSION_START_MARKER = "const ADM_HABITS=[";
const ADMISSION_END_MARKER = "function admissionPosCount(ad){";

export const clinicalCatalogPath = path.join(
  rootDir,
  "src",
  "domain",
  "clinical",
  "catalog.generated.json",
);

function evaluateLegacySlice(source, startMarker, endMarker, expression, filename) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Cannot locate legacy oracle slice ${startMarker}.`);
  }
  return JSON.parse(
    vm.runInNewContext(
      `${source.slice(start, end)}\nJSON.stringify(${expression});`,
      Object.create(null),
      {
        filename,
        timeout: 1_000,
      },
    ),
  );
}

export async function readLegacyClinicalCatalog() {
  const legacyPath = path.join(rootDir, "src", "legacy", "app.js");
  const source = await readFile(legacyPath, "utf8");
  const start = source.indexOf(START_MARKER);
  const endMarkerStart = source.indexOf(END_MARKER, start);
  const widgetStart = source.indexOf(WIDGET_START_MARKER, endMarkerStart);
  const widgetEnd = source.indexOf(WIDGET_END_MARKER, widgetStart);

  if (start < 0 || endMarkerStart < 0 || widgetStart < 0 || widgetEnd < 0) {
    throw new Error("Cannot locate the legacy clinical catalog boundaries.");
  }

  const end = endMarkerStart + END_MARKER.length;
  const catalogSource = `${source.slice(start, end)}\nJSON.stringify({ sections: SECTIONS, specialties: SPECIALTIES });`;
  const serialized = vm.runInNewContext(catalogSource, Object.create(null), {
    filename: "legacy-clinical-catalog.vm.js",
    timeout: 1_000,
  });
  const catalog = JSON.parse(serialized);
  const widgetSource = `${source.slice(widgetStart, widgetEnd)}
JSON.stringify({
  dtr: {
    sites: DTR_SITES.map(({ k, l }) => ({ key: k, label: l })),
    grades: DTR_GRADES,
  },
  plantar: { options: PLANTAR_OPTS },
  sensory: {
    statuses: SENSORY_STATUS,
    sides: SENSORY_SIDES,
    changes: SENSORY_CHANGES,
    patterns: SENSORY_PATTERNS,
    modalities: SENSORY_MODALITIES,
  },
});`;
  const widgets = JSON.parse(
    vm.runInNewContext(widgetSource, Object.create(null), {
      filename: "legacy-clinical-widgets.vm.js",
      timeout: 1_000,
    }),
  );
  const workspace = {
    adlLevels: evaluateLegacySlice(
      source,
      ADL_START_MARKER,
      ADL_END_MARKER,
      "ADL_LEVELS",
      "legacy-adl-levels.vm.js",
    ),
    pmhCommon: evaluateLegacySlice(
      source,
      PMH_START_MARKER,
      PMH_END_MARKER,
      "PMH_COMMON",
      "legacy-pmh-common.vm.js",
    ),
    admissionHabits: evaluateLegacySlice(
      source,
      ADMISSION_START_MARKER,
      ADMISSION_END_MARKER,
      "ADM_HABITS",
      "legacy-admission-habits.vm.js",
    ),
  };

  const itemIds = catalog.sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Legacy clinical catalog contains duplicate item IDs.");
  }

  return { ...catalog, widgets, workspace };
}

export function serializeClinicalCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}
