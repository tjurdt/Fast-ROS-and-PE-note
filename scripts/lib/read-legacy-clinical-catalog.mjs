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
const LQQ_START_MARKER = "const LQQ_QUALITY=[";
const LQQ_END_MARKER = "function addLqq(){";
const DNR_START_MARKER = "const DNR_OPTIONS=[";
const DNR_END_MARKER = "const DNR_CLINICAL_PATTERNS=[";
const BUILTIN_SET_START_MARKER = "function csField(type,label,options){";
const BUILTIN_SET_END_MARKER = "function allTemplates(){";
const DIALYSIS_DAYS_START_MARKER = "const DIALYSIS_MODALITIES=[";
const DIALYSIS_DAYS_END_MARKER = "function buildDTR(it,v){";
const POSTOP_START_MARKER = "const PO_CYCLES={";
const POSTOP_END_MARKER = "function appendLegacyNote(po,key,text){";
const INFECTION_START_MARKER = "const INF_MULTI={";
const INFECTION_END_MARKER = "function antibioticOptions(){";

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
  const lqq = evaluateLegacySlice(
    source,
    LQQ_START_MARKER,
    LQQ_END_MARKER,
    "{ qualities: LQQ_QUALITY, onsets: LQQ_ONSET }",
    "legacy-lqq-options.vm.js",
  );
  const dnrOptions = evaluateLegacySlice(
    source,
    DNR_START_MARKER,
    DNR_END_MARKER,
    "DNR_OPTIONS",
    "legacy-dnr-options.vm.js",
  );
  const dialysisDays = evaluateLegacySlice(
    source,
    DIALYSIS_DAYS_START_MARKER,
    DIALYSIS_DAYS_END_MARKER,
    "DIALYSIS_DAYS.map(({ k, d }) => ({ key: k, label: d }))",
    "legacy-dialysis-days.vm.js",
  );
  const builtinStart = source.indexOf(BUILTIN_SET_START_MARKER);
  const builtinEnd = source.indexOf(BUILTIN_SET_END_MARKER, builtinStart);
  if (builtinStart < 0 || builtinEnd < 0) {
    throw new Error("Cannot locate the legacy built-in bundle boundaries.");
  }
  const builtinSource = `const DNR_OPTIONS=${JSON.stringify(dnrOptions)};
${source.slice(builtinStart, builtinEnd)}
JSON.stringify(BUILTIN_SETS.map((template) => ({
  ...template,
  fields: template.fields.map((field, index) => ({
    ...field,
    id: "f_" + template.id + "_" + index,
  })),
})));`;
  const builtinSets = JSON.parse(
    vm.runInNewContext(builtinSource, Object.create(null), {
      filename: "legacy-builtin-bundles.vm.js",
      timeout: 1_000,
    }),
  );
  const postop = evaluateLegacySlice(
    source,
    POSTOP_START_MARKER,
    POSTOP_END_MARKER,
    `{
      cycles: Object.fromEntries(Object.entries(PO_CYCLES).map(([key, options]) => [
        key,
        options.map(({ v, c }) => ({ value: v, tone: c })),
      ])),
      multi: Object.fromEntries(Object.entries(PO_MULTI).map(([key, definition]) => [
        key,
        {
          normal: definition.normal,
          options: definition.options.map(({ v, c }) => ({ value: v, tone: c })),
        },
      ])),
    }`,
    "legacy-postop-options.vm.js",
  );
  const infection = evaluateLegacySlice(
    source,
    INFECTION_START_MARKER,
    INFECTION_END_MARKER,
    `{
      multi: Object.fromEntries(Object.entries(INF_MULTI).map(([key, definition]) => [
        key,
        {
          normal: definition.normal,
          options: definition.options.map(({ v }) => v),
        },
      ])),
      qsofaCriteria: QSOFA_CRITERIA.map(({ k, l }) => ({ key: k, label: l })),
      curb65Criteria: CURB65_CRITERIA.map(({ k, l }) => ({ key: k, label: l })),
      scoreStates: SCORE_STATES,
      defaultAntibiotics: DEFAULT_ANTIBIOTICS,
      antibioticRoutes: ABX_ROUTES,
    }`,
    "legacy-infection-options.vm.js",
  );
  const bundles = {
    lqq,
    dnrOptions,
    dialysisDays,
    builtinSets,
    postop,
    infection,
  };

  const itemIds = catalog.sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Legacy clinical catalog contains duplicate item IDs.");
  }

  return { ...catalog, widgets, workspace, bundles };
}

export function serializeClinicalCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}
