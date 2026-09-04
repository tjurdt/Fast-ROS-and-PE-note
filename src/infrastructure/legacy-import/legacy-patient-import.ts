import {
  DNR_BUNDLE_ID,
  DNR_MASTER_FIELD_ID,
  DNR_STATES_FIELD_ID,
  dnrStateMap,
} from "../../domain/bundles";
import { PatientSchema, type Patient } from "../../domain/patient";
import {
  PatientDatabaseSchema,
  type PatientDatabase,
} from "../../domain/patient-database";

/**
 * localStorage key the legacy single-file app (`src/legacy/app.js`) persists its
 * database under. Frozen by the legacy behavioral baseline; never changes.
 */
export const LEGACY_LOCAL_STORAGE_KEY = "rounding_notes_v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type LegacyDatabaseDetection =
  { status: "absent" } | { status: "unreadable" } | { status: "present"; raw: unknown };

/**
 * Reads the legacy database for inspection. Never throws and never writes back:
 * a missing key, a blocked read, or invalid JSON all come back as a status instead
 * of an exception, since this adapter must not disturb the legacy source of truth
 * either way.
 */
export function readLegacyDatabase(
  storage: Pick<Storage, "getItem">,
): LegacyDatabaseDetection {
  let serialized: string | null;
  try {
    serialized = storage.getItem(LEGACY_LOCAL_STORAGE_KEY);
  } catch {
    return { status: "unreadable" };
  }
  if (serialized === null) return { status: "absent" };
  try {
    return { status: "present", raw: JSON.parse(serialized) };
  } catch {
    return { status: "unreadable" };
  }
}

/** Whether a detected legacy payload actually has at least one patient to offer. */
export function legacyDatabaseHasPatients(raw: unknown): boolean {
  return isRecord(raw) && Array.isArray(raw.patients) && raw.patients.length > 0;
}

/**
 * Normalizes a legacy `customSets.sys_orders` (DNR) bundle instance into v2 shape.
 *
 * Legacy has shipped two shapes for this bundle over time:
 *  - current: `f_sys_orders_0` is a boolean master switch and `f_sys_orders_1` is a
 *    `{option: "agree" | "disagree" | ""}` map — already what v2 expects verbatim.
 *  - older (pre-migration): `f_sys_orders_0` held the raw selections instead (an
 *    array of option strings, or a legacy `"DNR"` / `"DNI"` / `"DNR / DNI"` string)
 *    and `f_sys_orders_1` did not exist yet.
 *
 * `dnrStateMap` — the same helper v2's own UI uses — already accepts either shape
 * for the *states* half. The master boolean for the older shape is derived from
 * whether any state ended up set, since the clinical-pattern heuristic legacy
 * originally used to decide it is legacy-internal and not exposed to v2.
 */
function normalizeDnrInstance(raw: Record<string, unknown>): Record<string, unknown> {
  const rawMaster = raw[DNR_MASTER_FIELD_ID];
  const legacySelections =
    typeof rawMaster === "boolean" ? raw[DNR_STATES_FIELD_ID] : rawMaster;
  const states = dnrStateMap(legacySelections, true);
  const hasAnyState = Object.values(states).some(
    (state) => state === "agree" || state === "disagree",
  );
  return {
    ...raw,
    [DNR_MASTER_FIELD_ID]: typeof rawMaster === "boolean" ? rawMaster : hasAnyState,
    [DNR_STATES_FIELD_ID]: states,
  };
}

function normalizeCustomSets(raw: unknown): unknown {
  if (!isRecord(raw)) return {};
  const normalized: Record<string, unknown> = { ...raw };
  const dnrInstance = normalized[DNR_BUNDLE_ID];
  if (isRecord(dnrInstance)) {
    normalized[DNR_BUNDLE_ID] = normalizeDnrInstance(dnrInstance);
  }
  return normalized;
}

function formatIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string[] {
  return issues.map((issue) => `${issue.path.join(".") || "(root)"}：${issue.message}`);
}

export type LegacyPatientConversion =
  { ok: true; patient: Patient } | { ok: false; issues: string[] };

/**
 * Converts one legacy patient record (as persisted under `rounding_notes_v1`) into a
 * validated v2 `Patient`. Read-only and pure: never mutates `raw`, never talks to
 * storage. The only real reshape is legacy's `values` becoming v2's `findings` (a
 * rename — the field contents are identical, since the clinical catalog work already
 * keeps per-item answer shapes byte-for-byte in sync) plus DNR bundle normalization;
 * every other field already shares its shape with v2's domain schemas, because v2 was
 * built as a typed reimplementation of the exact same runtime objects.
 *
 * A patient that fails validation is reported, never partially imported.
 */
export function convertLegacyPatient(raw: unknown): LegacyPatientConversion {
  if (!isRecord(raw)) {
    return { ok: false, issues: ["病人資料不是有效物件。"] };
  }

  const candidate = {
    id: raw.id,
    code: raw.code,
    specialty: raw.specialty,
    sex: raw.sex,
    age: raw.age,
    problem: raw.problem,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    findings: raw.values ?? {},
    globalNote: raw.globalNote,
    blockNotes: raw.blockNotes,
    todos: raw.todos,
    pmh: raw.pmh,
    admission: raw.admission,
    adl: raw.adl,
    lqq: raw.lqq,
    customSets: normalizeCustomSets(raw.customSets),
    autoTriggered: raw.autoTriggered,
    postop: raw.postop ?? null,
    infections: raw.infections,
    chemo: raw.chemo ?? null,
  };

  const parsed = PatientSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, issues: formatIssues(parsed.error.issues) };
  }
  return { ok: true, patient: parsed.data };
}

export interface LegacyImportSkip {
  patientIndex: number;
  patientId?: string;
  issues: string[];
}

export type LegacyDatabaseConversion =
  | { ok: true; database: PatientDatabase; skipped: LegacyImportSkip[] }
  | { ok: false; issues: string[] };

/**
 * Converts a whole legacy database into a validated v2 `PatientDatabase`.
 *
 * Each patient converts independently: one malformed patient is skipped and
 * reported in `skipped`, it never blocks importing the rest and never produces a
 * half-written patient. The overall call only fails (`ok: false`) when `raw` is not
 * even database-shaped (no `patients` array to read at all).
 */
export function convertLegacyDatabase(raw: unknown): LegacyDatabaseConversion {
  if (!isRecord(raw) || !Array.isArray(raw.patients)) {
    return { ok: false, issues: ["找不到 legacy 病人清單（patients 陣列）。"] };
  }

  const patients: Patient[] = [];
  const skipped: LegacyImportSkip[] = [];
  raw.patients.forEach((rawPatient: unknown, index: number) => {
    const result = convertLegacyPatient(rawPatient);
    if (result.ok) {
      patients.push(result.patient);
      return;
    }
    const patientId =
      isRecord(rawPatient) && typeof rawPatient.id === "string"
        ? rawPatient.id
        : undefined;
    skipped.push({
      patientIndex: index,
      ...(patientId !== undefined ? { patientId } : {}),
      issues: result.issues,
    });
  });

  const parsed = PatientDatabaseSchema.safeParse({
    schemaVersion: 2,
    patients,
    antibioticOptions: Array.isArray(raw.antibioticOptions)
      ? raw.antibioticOptions
      : [],
    customBundleTemplates: Array.isArray(raw.customSets) ? raw.customSets : [],
  });
  if (!parsed.success) {
    return { ok: false, issues: formatIssues(parsed.error.issues) };
  }
  return { ok: true, database: parsed.data, skipped };
}
