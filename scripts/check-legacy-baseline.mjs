import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const baselinePath = path.join(rootDir, "config", "legacy-baseline.json");
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const source = await readFile(path.join(rootDir, baseline.file), "utf8");
const normalized = source.replaceAll("\r\n", "\n");
const hash = createHash("sha256").update(normalized).digest("hex");
const lineCount = normalized.split("\n").length;

if (hash !== baseline.normalizedSha256 || lineCount !== baseline.normalizedLineCount) {
  console.error(
    [
      "The frozen legacy application changed.",
      "Put new behavior in src/features/ whenever possible.",
      "For an intentional legacy fix, add regression coverage and run:",
      'npm run accept:legacy -- --reason "<why the legacy edit is required>"',
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("Legacy behavior baseline is unchanged.");
}
