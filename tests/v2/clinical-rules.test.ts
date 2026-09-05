import { describe, expect, it } from "vitest";

import { clinicalCatalog, clinicalItemIndex } from "../../src/domain/clinical/catalog";
import {
  DTR_GRADES,
  FindingValueSchema,
  nextCycleValue,
} from "../../src/domain/clinical/finding";
import {
  buildClinicalView,
  countFindings,
  countFindingsByKind,
  hasFinding,
} from "../../src/domain/clinical/clinical-rules";
import { createPatient, updatePatientFinding } from "../../src/domain/patient";

function patientFor(specialty = "general", sex: "" | "女 F" = "") {
  return createPatient(
    { code: "TEST", specialty, sex, age: "", problem: "" },
    { createId: () => "patient-1", now: () => 100 },
  );
}

describe("clinical catalog parity", () => {
  it("contains the complete frozen legacy catalog", () => {
    expect(clinicalCatalog.sections).toHaveLength(25);
    expect(clinicalItemIndex.size).toBe(194);
    expect(clinicalCatalog.specialties).toHaveLength(16);
    expect(clinicalCatalog.widgets.dtr.sites).toHaveLength(5);
    expect(clinicalCatalog.widgets.dtr.grades).toEqual([
      "",
      "0",
      "1+",
      "2+",
      "3+",
      "4+",
    ]);
    expect(clinicalCatalog.widgets.plantar.options).toHaveLength(3);
    expect(clinicalCatalog.widgets.sensory.modalities).toHaveLength(5);
  });

  it("moves specialty focus items without duplicating them", () => {
    const view = buildClinicalView(patientFor("cms"));
    const focusRos = view.find((section) => section.key === "focus_ros");
    const respiratory = view.find((section) => section.key === "ros_resp");

    expect(focusRos?.items.some((item) => item.id === "cough")).toBe(true);
    expect(respiratory?.items.some((item) => item.id === "cough")).toBe(false);
    const allIds = view.flatMap((section) => section.items.map((item) => item.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("keeps sensory in the neurological section outside Neuro specialty", () => {
    const view = buildClinicalView(patientFor("ortho"));
    expect(
      view
        .find((section) => section.key === "focus_pe")
        ?.items.some((item) => item.id === "pe_sensory"),
    ).toBe(false);
    expect(
      view
        .find((section) => section.key === "pe_neuro")
        ?.items.some((item) => item.id === "pe_sensory"),
    ).toBe(true);
  });

  it("applies gynecology and obstetric visibility gates", () => {
    const defaultKeys = buildClinicalView(patientFor()).map((section) => section.key);
    expect(defaultKeys).not.toContain("ros_gyn");
    expect(defaultKeys).not.toContain("ros_obs");
    expect(defaultKeys).not.toContain("pe_obgyn");

    const femaleKeys = buildClinicalView(patientFor("general", "女 F")).map(
      (section) => section.key,
    );
    expect(femaleKeys).toContain("ros_gyn");
    expect(femaleKeys).toContain("pe_obgyn");
    expect(femaleKeys).not.toContain("ros_obs");

    const obstetricKeys = buildClinicalView(patientFor("obs")).map(
      (section) => section.key,
    );
    expect(obstetricKeys).toContain("ros_gyn");
    expect(obstetricKeys).toContain("ros_obs");
    expect(obstetricKeys).toContain("pe_obgyn");
  });

  it("matches legacy positive rules and counts each item once", () => {
    const fever = clinicalItemIndex.get("fever")?.item;
    const consciousness = clinicalItemIndex.get("consciousness")?.item;
    const gcs = clinicalItemIndex.get("gcs")?.item;
    if (!fever || !consciousness || !gcs) throw new Error("Missing fixture items.");

    expect(hasFinding(fever, { on: true })).toBe(true);
    expect(hasFinding(consciousness, { sel: "清醒 Alert" })).toBe(false);
    expect(hasFinding(consciousness, { sel: "嗜睡 Drowsy" })).toBe(true);
    expect(hasFinding(gcs, { grp: { E: "4", V: "5", M: "6" } })).toBe(false);
    expect(hasFinding(gcs, { grp: { E: "3", V: "5", M: "6" } })).toBe(true);
    expect(hasFinding(fever, { note: "曾發燒" })).toBe(true);

    const updated = updatePatientFinding(patientFor("inf"), "fever", { on: true }, 200);
    expect(countFindings(updated)).toBe(1);
  });

  it("scopes countFindingsByKind to just the ROS or just the PE section", () => {
    let patient = patientFor("inf");
    patient = updatePatientFinding(patient, "fever", { on: true }, 200);
    patient = updatePatientFinding(patient, "pe_dtr", { dtr: { biceps_L: "3+" } }, 200);

    expect(countFindingsByKind(patient, "ROS")).toBe(1);
    expect(countFindingsByKind(patient, "PE")).toBe(1);
    expect(countFindings(patient)).toBe(
      countFindingsByKind(patient, "ROS") + countFindingsByKind(patient, "PE"),
    );
  });

  it("matches DTR, plantar, sensory, and cranial nerve positive rules", () => {
    const dtr = clinicalItemIndex.get("pe_dtr")?.item;
    const plantar = clinicalItemIndex.get("pe_plantar")?.item;
    const sensory = clinicalItemIndex.get("pe_sensory")?.item;
    const cranialNerves = clinicalItemIndex.get("pe_cn")?.item;
    if (!dtr || !plantar || !sensory || !cranialNerves) {
      throw new Error("Missing neurological fixture items.");
    }

    expect(hasFinding(dtr, { dtr: { biceps_L: "2+" } })).toBe(false);
    expect(hasFinding(dtr, { dtr: { biceps_L: "3+" } })).toBe(true);
    expect(hasFinding(plantar, { plantar: { L: "屈曲↓ (正常)" } })).toBe(false);
    expect(hasFinding(plantar, { plantar: { L: "伸直↑ Babinski(+)" } })).toBe(true);
    expect(
      hasFinding(sensory, { sensory: { status: "正常 Intact", findings: [] } }),
    ).toBe(false);
    expect(
      hasFinding(sensory, { sensory: { status: "異常 Abnormal", findings: [] } }),
    ).toBe(true);
    expect(
      hasFinding(cranialNerves, {
        sel: "大致正常 Intact",
        cn: { cn1: { note: "嗅覺改變" } },
      }),
    ).toBe(true);
  });

  it("validates nested widget state while preserving unknown additive fields", () => {
    const parsed = FindingValueSchema.parse({
      dtr: { biceps_L: "4+" },
      plantar: { L: "無反應" },
      sensory: {
        status: "異常 Abnormal",
        futureSensoryField: true,
        findings: [
          {
            id: "sf-1",
            side: "左下肢 LLE",
            change: "感覺減退 Hypoesthesia",
            pattern: "皮節 Dermatomal",
            modalities: ["輕觸 Light touch"],
            location: "L4",
            note: "",
            futureFindingField: "kept",
          },
        ],
      },
      cn: { cn1: { abn: true, grid: { anosmia_L: true }, futureCnField: 1 } },
      futureFindingValueField: "kept",
    });

    expect(parsed.sensory?.futureSensoryField).toBe(true);
    expect(parsed.sensory?.findings[0]?.futureFindingField).toBe("kept");
    expect(parsed.cn?.cn1?.futureCnField).toBe(1);
    expect(parsed.futureFindingValueField).toBe("kept");
    expect(nextCycleValue(DTR_GRADES, "2+")).toBe("3+");
    expect(nextCycleValue(DTR_GRADES, "4+")).toBe("");
  });
});
