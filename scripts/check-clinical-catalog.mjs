import { readFile } from "node:fs/promises";

import {
  clinicalCatalogPath,
  readLegacyClinicalCatalog,
  serializeClinicalCatalog,
} from "./lib/read-legacy-clinical-catalog.mjs";

const [legacyCatalog, generated] = await Promise.all([
  readLegacyClinicalCatalog(),
  readFile(clinicalCatalogPath, "utf8").catch(() => null),
]);
const expected = serializeClinicalCatalog(legacyCatalog);

if (generated !== expected) {
  console.error(
    "The typed clinical catalog is missing or stale. Run `npm run sync:clinical-catalog`.",
  );
  process.exitCode = 1;
} else {
  console.log("Generated clinical catalog matches the frozen legacy oracle.");
}
