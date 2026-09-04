import { readFile } from "node:fs/promises";
import path from "node:path";

import { v2ParityGates } from "../config/v2-parity.mjs";
import { rootDir } from "./lib/render-app.mjs";

const expectedGateIds = [
  "patient-lifecycle",
  "clinical-catalog",
  "workspace-and-bundles",
  "clinical-export",
  "google-sync",
  "responsive-workflows",
  "single-file-deployment",
];
const evidenceKinds = new Set(["unit", "contract", "browser", "build"]);
const failures = [];
const seenIds = new Set();
const sourceCache = new Map();

for (const gate of v2ParityGates) {
  if (seenIds.has(gate.id)) failures.push(`Duplicate parity gate: ${gate.id}`);
  seenIds.add(gate.id);
  if (!gate.description?.trim()) failures.push(`${gate.id} has no description.`);
  if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) {
    failures.push(`${gate.id} has no executable evidence.`);
    continue;
  }
  if (!gate.evidence.some((item) => item.kind === "browser")) {
    failures.push(`${gate.id} needs at least one browser workflow.`);
  }

  const seenEvidence = new Set();
  for (const evidence of gate.evidence) {
    if (!evidenceKinds.has(evidence.kind)) {
      failures.push(`${gate.id} has unknown evidence kind ${evidence.kind}.`);
    }
    const normalized = evidence.path.replaceAll("\\", "/");
    if (path.isAbsolute(evidence.path) || normalized.includes("../")) {
      failures.push(`${gate.id} evidence escapes the repository: ${evidence.path}`);
      continue;
    }
    const identity = `${evidence.kind}:${normalized}:${evidence.marker}`;
    if (seenEvidence.has(identity)) {
      failures.push(`${gate.id} repeats evidence ${normalized}.`);
      continue;
    }
    seenEvidence.add(identity);

    const absolutePath = path.join(rootDir, normalized);
    let source = sourceCache.get(absolutePath);
    if (source === undefined) {
      source = await readFile(absolutePath, "utf8").catch(() => null);
      sourceCache.set(absolutePath, source);
    }
    if (source === null) {
      failures.push(`${gate.id} evidence file is missing: ${normalized}`);
    } else if (!evidence.marker || !source.includes(evidence.marker)) {
      failures.push(`${gate.id} evidence marker is missing from ${normalized}.`);
    }
  }
}

for (const expectedId of expectedGateIds) {
  if (!seenIds.has(expectedId)) failures.push(`Missing parity gate: ${expectedId}`);
}
for (const actualId of seenIds) {
  if (!expectedGateIds.includes(actualId))
    failures.push(`Unexpected parity gate: ${actualId}`);
}

if (failures.length > 0) {
  console.error(`v2 parity checks failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  const evidenceCount = v2ParityGates.reduce(
    (count, gate) => count + gate.evidence.length,
    0,
  );
  console.log(
    `v2 parity manifest covers ${v2ParityGates.length} gates with ${evidenceCount} executable references.`,
  );
}
