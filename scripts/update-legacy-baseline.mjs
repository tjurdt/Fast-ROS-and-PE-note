import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const reasonFlag = process.argv.indexOf("--reason");
const reason = reasonFlag >= 0 ? process.argv[reasonFlag + 1]?.trim() : "";

if (!reason || reason.length < 10) {
  console.error(
    'Provide a useful reason: npm run accept:legacy -- --reason "<why this edit cannot live in a feature>"',
  );
  process.exit(1);
}

const baselinePath = path.join(rootDir, "config", "legacy-baseline.json");
const current = JSON.parse(await readFile(baselinePath, "utf8"));
const source = await readFile(path.join(rootDir, current.file), "utf8");
const normalized = source.replaceAll("\r\n", "\n");
const next = {
  file: current.file,
  normalizedSha256: createHash("sha256").update(normalized).digest("hex"),
  normalizedLineCount: normalized.split("\n").length,
  acceptedAt: new Date().toISOString().slice(0, 10),
  reason,
};

await writeFile(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
console.log("Updated the legacy baseline. Review and commit it with the tests.");
