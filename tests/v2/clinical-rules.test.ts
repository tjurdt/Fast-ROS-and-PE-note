import { describe, expect, it } from "vitest";

import { clinicalCatalog, clinicalItemIndex } from "../../src/domain/clinical/catalog";
import {
  buildClinicalView,
  countFindings,
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
});
