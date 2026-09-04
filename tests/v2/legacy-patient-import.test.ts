import { describe, expect, it } from "vitest";

import {
  LEGACY_LOCAL_STORAGE_KEY,
  convertLegacyDatabase,
  convertLegacyPatient,
  legacyDatabaseHasPatients,
  readLegacyDatabase,
} from "../../src/infrastructure/legacy-import/legacy-patient-import";

class MemoryStorage implements Pick<Storage, "getItem"> {
  readonly values = new Map<string, string>();
  readError: Error | null = null;

  set(key: string, value: string): void {
    this.values.set(key, value);
  }

  getItem(key: string): string | null {
    if (this.readError) throw this.readError;
    return this.values.get(key) ?? null;
  }
}

function minimalLegacyPatient(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    code: "床 12",
    specialty: "general",
    sex: "男 M",
    age: "72",
    problem: "fever workup",
    createdAt: 100,
    updatedAt: 200,
    values: {},
    globalNote: "",
    blockNotes: {},
    todos: [],
    ...overrides,
  };
}

describe("readLegacyDatabase", () => {
  it("reports absent when the key was never written", () => {
    const storage = new MemoryStorage();
    expect(readLegacyDatabase(storage)).toEqual({ status: "absent" });
  });

  it("reports unreadable on invalid JSON without throwing", () => {
    const storage = new MemoryStorage();
    storage.set(LEGACY_LOCAL_STORAGE_KEY, "{not-json");
    expect(readLegacyDatabase(storage)).toEqual({ status: "unreadable" });
  });

  it("reports unreadable when the browser blocks the read", () => {
    const storage = new MemoryStorage();
    storage.readError = new DOMException("blocked", "SecurityError");
    expect(readLegacyDatabase(storage)).toEqual({ status: "unreadable" });
  });

  it("returns the parsed payload when present", () => {
    const storage = new MemoryStorage();
    storage.set(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify({ patients: [] }));
    expect(readLegacyDatabase(storage)).toEqual({
      status: "present",
      raw: { patients: [] },
    });
  });
});

describe("legacyDatabaseHasPatients", () => {
  it("is false for an empty or missing patient list", () => {
    expect(legacyDatabaseHasPatients({ patients: [] })).toBe(false);
    expect(legacyDatabaseHasPatients({})).toBe(false);
    expect(legacyDatabaseHasPatients(null)).toBe(false);
    expect(legacyDatabaseHasPatients("nope")).toBe(false);
  });

  it("is true once at least one patient exists", () => {
    expect(legacyDatabaseHasPatients({ patients: [{ id: "p1" }] })).toBe(true);
  });
});

describe("convertLegacyPatient", () => {
  it("converts a minimal legacy patient, defaulting every v2-only field", () => {
    const result = convertLegacyPatient(minimalLegacyPatient());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient).toMatchObject({
      id: "p1",
      code: "床 12",
      specialty: "general",
      sex: "男 M",
      age: "72",
      problem: "fever workup",
      createdAt: 100,
      updatedAt: 200,
      findings: {},
    });
    expect(result.patient.pmh).toEqual([]);
    expect(result.patient.admission.habits).toEqual([]);
    expect(result.patient.adl.level).toBeTruthy();
    expect(result.patient.lqq).toEqual([]);
    expect(result.patient.customSets).toEqual({});
    expect(result.patient.postop).toBeNull();
    expect(result.patient.infections).toEqual([]);
    expect(result.patient.chemo).toBeNull();
  });

  it("renames values to findings and keeps every answer shape intact", () => {
    const legacyValues = {
      f_gen_fever: { on: true, note: "Tmax 38.6" },
      f_gen_ams: { sel: "意識改變 AMS" },
      f_neuro_cn: { grp: { cn3: "正常 Normal" } },
      f_neuro_sensory: {
        sel: "異常 Abnormal",
        sensory: {
          status: "異常 Abnormal",
          findings: [
            {
              id: "sf1",
              side: "左下肢 LLE",
              change: "感覺減退 Hypoesthesia",
              pattern: "",
              modalities: ["觸覺 Touch"],
              location: "",
              note: "",
            },
          ],
        },
      },
    };
    const result = convertLegacyPatient(minimalLegacyPatient({ values: legacyValues }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.findings).toEqual(legacyValues);
  });

  it("converts past medical history entries as-is", () => {
    const pmh = [{ id: "pm1", text: "糖尿病 Diabetes mellitus" }];
    const result = convertLegacyPatient(minimalLegacyPatient({ pmh }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.pmh).toEqual(pmh);
  });

  it("converts todos, including the pre-rename pending status", () => {
    const todos = [
      {
        id: "td1",
        text: "追蹤 CXR",
        createdAt: 10,
        important: true,
        status: "pending",
      },
      {
        id: "td2",
        text: "會診腎臟科",
        createdAt: 20,
        important: false,
        status: "done",
      },
    ];
    const result = convertLegacyPatient(minimalLegacyPatient({ todos }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.todos).toEqual([
      { id: "td1", text: "追蹤 CXR", createdAt: 10, important: true, status: "todo" },
      {
        id: "td2",
        text: "會診腎臟科",
        createdAt: 20,
        important: false,
        status: "done",
      },
    ]);
  });

  it("converts admission and ADL as structured objects", () => {
    const admission = {
      habits: ["菸 Smoking"],
      foodAllergy: true,
      foodAllergyNote: "海鮮 Shellfish",
      drugAllergy: false,
      drugAllergyNote: "",
      tocc: { t: "", o: "", c: "", cl: "" },
      recentAdm: false,
      recentAdmNote: "",
      familyHx: "",
    };
    const adl = {
      level: "完全依賴 Total dependence",
      foreign: true,
      domestic: false,
      institution: false,
      family: false,
      instName: "",
      famName: "",
      note: "",
    };
    const result = convertLegacyPatient(minimalLegacyPatient({ admission, adl }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.admission).toEqual(admission);
    expect(result.patient.adl).toEqual(adl);
  });

  it("converts LQQOPERA entries", () => {
    const lqq = [
      {
        id: "lqq1",
        name: "腹痛 Abdominal pain",
        L: "右上腹 RUQ",
        quality: ["絞痛 Colicky"],
        qnote: "",
        sev: 6,
        onset: "急性 Acute",
        onsetText: "",
        P: "進食後 After meals",
        E: "禁食 Fasting",
        R: "無 None",
        A: "噁心 Nausea",
      },
    ];
    const result = convertLegacyPatient(minimalLegacyPatient({ lqq }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.lqq).toEqual(lqq);
  });

  it("normalizes an already-migrated DNR bundle instance as-is", () => {
    const customSets = {
      sys_orders: {
        f_sys_orders_0: true,
        f_sys_orders_1: {
          不施行心肺復甦術: "agree",
          "不氣管內插管／人工呼吸": "disagree",
        },
        __notes: {},
        __setNote: "",
      },
    };
    const result = convertLegacyPatient(minimalLegacyPatient({ customSets }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dnr = result.patient.customSets.sys_orders;
    expect(dnr?.f_sys_orders_0).toBe(true);
    expect(dnr?.f_sys_orders_1).toMatchObject({
      不施行心肺復甦術: "agree",
      "不氣管內插管／人工呼吸": "disagree",
    });
  });

  it("migrates a pre-rename DNR bundle instance (raw selections in the master field)", () => {
    const customSets = {
      sys_orders: {
        f_sys_orders_0: ["不施行心肺復甦術"],
        __notes: {},
      },
    };
    const result = convertLegacyPatient(minimalLegacyPatient({ customSets }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dnr = result.patient.customSets.sys_orders;
    expect(dnr?.f_sys_orders_0).toBe(true);
    expect((dnr?.f_sys_orders_1 as Record<string, string>)["不施行心肺復甦術"]).toBe(
      "agree",
    );
  });

  it("converts infection workups with qSOFA, cultures, and antibiotics", () => {
    const infections = [
      {
        id: "inf1",
        name: "肺炎 Pneumonia",
        collapsed: false,
        temperature: "38.6",
        sources: ["肺部 Pulmonary"],
        cultures: ["Blood culture"],
        qsofa: { open: true, sbp: "yes", rr: "", mentation: "" },
        curb65: { open: false, confusion: "", urea: "", rr: "", bp: "", age: "yes" },
        antibiotics: [
          {
            id: "abx1",
            drug: "Ceftriaxone",
            startDate: "2026-09-01",
            route: "IV 靜脈",
            note: "",
          },
        ],
        note: "",
      },
    ];
    const result = convertLegacyPatient(minimalLegacyPatient({ infections }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.infections).toEqual(infections);
  });

  it("converts postoperative care and chemotherapy follow-up bundles", () => {
    const postop = {
      notes: {},
      drains: [],
      surgery: "剖腹探查 Ex-lap",
      surgeryDate: "2026-09-01",
      pain: "",
      vitals: "",
      fever: "",
      oralDiet: "",
      nutritionSupport: [],
      nauseaSymptoms: [],
      activity: "",
      flatus: "",
      voidingMethod: "",
      urinaryConcerns: [],
      respiratorySupport: "",
      respiratoryConcerns: [],
      woundFindings: [],
      vteMeasures: [],
      redFlags: [],
      plan: "",
      _multiV37: true,
    };
    const chemo = null;
    const result = convertLegacyPatient(minimalLegacyPatient({ postop, chemo }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.postop).toMatchObject({ surgery: "剖腹探查 Ex-lap" });
    expect(result.patient.chemo).toBeNull();
  });

  it("rejects a non-object patient with a diagnosable issue", () => {
    const result = convertLegacyPatient("not an object");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects a patient missing required fields with a diagnosable issue", () => {
    const result = convertLegacyPatient({ code: "床 12" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.includes("id"))).toBe(true);
  });
});

describe("convertLegacyDatabase", () => {
  it("fails fast when the payload has no patients array at all", () => {
    const result = convertLegacyDatabase({ notADatabase: true });
    expect(result.ok).toBe(false);
  });

  it("imports valid patients, skips malformed ones, and renames DB-level fields", () => {
    const raw = {
      patients: [
        minimalLegacyPatient({ id: "good-1" }),
        { code: "缺少必要欄位" },
        minimalLegacyPatient({ id: "good-2" }),
      ],
      antibioticOptions: ["Custom-Abx"],
      customSets: [
        {
          id: "user1",
          name: "自訂組套",
          fields: [
            { id: "f1", type: "toggle", label: "陽性", options: [], archived: false },
          ],
          archived: false,
        },
      ],
    };

    const result = convertLegacyDatabase(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.database.schemaVersion).toBe(2);
    expect(result.database.patients.map((patient) => patient.id)).toEqual([
      "good-1",
      "good-2",
    ]);
    expect(result.database.antibioticOptions).toEqual(["Custom-Abx"]);
    expect(result.database.customBundleTemplates).toEqual(raw.customSets);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ patientIndex: 1 });
    expect(result.skipped[0]?.issues.length).toBeGreaterThan(0);
  });

  it("never mutates the raw legacy payload it was given", () => {
    const raw = {
      patients: [minimalLegacyPatient({ id: "p1" })],
      antibioticOptions: [],
      customSets: [],
    };
    const snapshot = JSON.stringify(raw);

    convertLegacyDatabase(raw);

    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});
