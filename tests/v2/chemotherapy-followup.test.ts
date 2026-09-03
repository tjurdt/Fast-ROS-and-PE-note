import { describe, expect, it } from "vitest";

import {
  CHEMO_CYCLES,
  CHEMO_FLAGS,
  CHEMO_MULTI,
  NEUROPATHY_ROWS,
  NEUROPATHY_SITES,
  ChemotherapyFollowupSchema,
  calculateChemotherapyDay,
  chemotherapyHasNeuropathy,
  chemotherapyTemperatureState,
  createChemotherapyFollowup,
  cycleChemotherapyValue,
  cycleNeuropathyStatus,
  toggleChemotherapyMultiValue,
  toggleNeuropathyCell,
} from "../../src/domain/chemotherapy-followup";

describe("chemotherapy follow-up domain", () => {
  it("uses the complete definitions extracted from the frozen legacy oracle", () => {
    expect(Object.keys(CHEMO_CYCLES)).toHaveLength(4);
    expect(Object.keys(CHEMO_MULTI)).toHaveLength(8);
    expect(CHEMO_FLAGS).toHaveLength(5);
    expect(NEUROPATHY_SITES).toHaveLength(4);
    expect(NEUROPATHY_ROWS).toHaveLength(7);
    expect(NEUROPATHY_ROWS.find((row) => row.key === "fine")?.sites).toEqual([
      "LH",
      "RH",
    ]);
    expect(NEUROPATHY_ROWS.find((row) => row.key === "gait")?.sites).toEqual([
      "LF",
      "RF",
    ]);
  });

  it("creates a normalized legacy-compatible follow-up", () => {
    const followup = createChemotherapyFollowup();

    expect(followup).toMatchObject({
      notes: {},
      flags: [],
      regimen: "",
      chemoDate: "",
      temperature: "",
      nauseaSymptoms: [],
      neuropathyStatus: "",
      skinFindings: [],
      labs: "",
      plan: "",
      _multiV37: true,
      _neuroMatrixV38: true,
    });
    expect(Object.keys(followup.neuropathyMatrix)).toEqual(
      NEUROPATHY_ROWS.map((row) => row.key),
    );
    expect(ChemotherapyFollowupSchema.parse({ temperature: 38 }).temperature).toBe(
      "38",
    );
  });

  it("matches legacy chemotherapy day and fever calculations", () => {
    const now = new Date(2026, 8, 4, 18, 30);

    expect(calculateChemotherapyDay("", now)).toMatchObject({
      text: "Day —",
      value: "",
      status: "empty",
    });
    expect(calculateChemotherapyDay("2026-09-02", now)).toMatchObject({
      text: "D+2",
      value: "D+2",
      status: "valid",
      days: 2,
    });
    expect(calculateChemotherapyDay("2026-09-05", now).status).toBe("future");
    expect(chemotherapyTemperatureState("37.9")).toEqual({
      tone: "norm",
      label: "已測量",
    });
    expect(chemotherapyTemperatureState("38")).toEqual({
      tone: "danger",
      label: "≥38°C 警訊",
    });
  });

  it("cycles severity values through all options and back to unassessed", () => {
    let fatigue = "";
    for (const option of CHEMO_CYCLES.fatigue ?? []) {
      fatigue = cycleChemotherapyValue(fatigue, "fatigue");
      expect(fatigue).toBe(option.value);
    }
    expect(cycleChemotherapyValue(fatigue, "fatigue")).toBe("");
  });

  it("keeps normal and abnormal multi-select values mutually exclusive", () => {
    const normal = toggleChemotherapyMultiValue([], "無 None", "nauseaSymptoms");
    expect(normal).toEqual(["無 None"]);

    const abnormal = toggleChemotherapyMultiValue(
      normal,
      "嘔吐 Vomiting",
      "nauseaSymptoms",
    );
    expect(abnormal).toEqual(["嘔吐 Vomiting"]);
    expect(
      toggleChemotherapyMultiValue(abnormal, "噁心 Nausea", "nauseaSymptoms"),
    ).toEqual(["嘔吐 Vomiting", "噁心 Nausea"]);
    expect(toggleChemotherapyMultiValue(abnormal, "無 None", "nauseaSymptoms")).toEqual(
      ["無 None"],
    );
  });

  it("tracks valid neuropathy cells and clears the matrix with a normal status", () => {
    let followup = createChemotherapyFollowup();
    followup = toggleNeuropathyCell(followup, "numbness", "LH");
    followup = toggleNeuropathyCell(followup, "fine", "RH");

    expect(followup.neuropathyStatus).toBe("有異常 Present");
    expect(followup.neuropathyMatrix.numbness).toEqual(["LH"]);
    expect(followup.neuropathyMatrix.fine).toEqual(["RH"]);
    expect(chemotherapyHasNeuropathy(followup)).toBe(true);
    expect(() => toggleNeuropathyCell(followup, "fine", "LF")).toThrow(
      /does not support/,
    );

    followup = cycleNeuropathyStatus(followup);
    expect(followup.neuropathyStatus).toBe("");
    expect(chemotherapyHasNeuropathy(followup)).toBe(false);
    followup = cycleNeuropathyStatus(followup);
    expect(followup.neuropathyStatus).toBe("無明顯異常 None");
  });
});
