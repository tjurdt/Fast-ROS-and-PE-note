import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  clinicalCatalogPath,
  readLegacyClinicalCatalog,
  serializeClinicalCatalog,
} from "./lib/read-legacy-clinical-catalog.mjs";

const catalog = await readLegacyClinicalCatalog();
await mkdir(path.dirname(clinicalCatalogPath), { recursive: true });
await writeFile(clinicalCatalogPath, serializeClinicalCatalog(catalog));

const itemCount = catalog.sections.reduce(
  (count, section) => count + section.items.length,
  0,
);
console.log(
  `Synchronized ${catalog.sections.length} sections, ${itemCount} items, ${catalog.specialties.length} specialties, neurological widgets, and note-workspace options.`,
);
