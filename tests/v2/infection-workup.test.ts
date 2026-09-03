import { describe, expect, it } from "vitest";

import {
  ANTIBIOTIC_ROUTES,
  CURB65_CRITERIA,
  DEFAULT_ANTIBIOTICS,
  INFECTION_MULTI,
  QSOFA_CRITERIA,
  allAntibioticOptions,
  calculateAntibioticDay,
  createAntibioticCourse,
  createInfectionRecord,
  cycleAntibioticRoute,
  cycleScoreState,
  infectionScoreAdvice,
  infectionScoreInfo,
  infectionTemperatureState,
  setInfectionScoreState,
  toggleInfectionMultiValue,
} from "../../src/domain/infection-workup";

describe("infection workup domain", () => {
  it("uses complete definitions extracted from the frozen legacy oracle", () => {
    expect(INFECTION_MULTI.sources?.options).toHaveLength(9);
    expect(INFECTION_MULTI.cultures?.options).toHaveLength(8);
    expect(QSOFA_CRITERIA).toHaveLength(3);
    expect(CURB65_CRITERIA).toHaveLength(5);
    expect(DEFAULT_ANTIBIOTICS).toHaveLength(12);
    expect(ANTIBIOTIC_ROUTES).toHaveLength(6);
  });

  it("creates legacy-compatible records and initializes CURB-65 age", () => {
    const older = createInfectionRecord("65", { createId: () => "infection-1" });
    const younger = createInfectionRecord("64", { createId: () => "infection-2" });
    const unknown = createInfectionRecord("unknown", {
      createId: () => "infection-3",
    });

    expect(older.curb65.age).toBe("yes");
    expect(younger.curb65.age).toBe("no");
    expect(unknown.curb65.age).toBe("");
    expect(older).toMatchObject({
      id: "infection-1",
      name: "",
      temperature: "",
      sources: [],
      cultures: [],
      qsofa: { sbp: "", rr: "", mentation: "" },
      antibiotics: [],
      note: "",
    });
  });

  it("cycles and scores qSOFA with the legacy high-risk advice", () => {
    let infection = createInfectionRecord("", { createId: () => "infection-1" });
    expect(cycleScoreState("")).toBe("no");
    expect(cycleScoreState("no")).toBe("yes");
    expect(cycleScoreState("yes")).toBe("");

    infection = setInfectionScoreState(infection, "qsofa", "sbp", "yes");
    infection = setInfectionScoreState(infection, "qsofa", "rr", "yes");
    expect(infectionScoreInfo("qsofa", infection.qsofa)).toMatchObject({
      score: 2,
      done: 2,
      total: 3,
      complete: false,
    });
    infection = setInfectionScoreState(infection, "qsofa", "mentation", "no");
    expect(infectionScoreAdvice("qsofa", infection.qsofa)).toMatchObject({
      tone: "danger",
    });
  });

  it("reports CURB-65 medium risk at two complete positive criteria", () => {
    let infection = createInfectionRecord("64", { createId: () => "infection-1" });
    for (const criterion of CURB65_CRITERIA) {
      infection = setInfectionScoreState(
        infection,
        "curb65",
        criterion.key,
        criterion.key === "confusion" || criterion.key === "urea" ? "yes" : "no",
      );
    }

    expect(infectionScoreInfo("curb65", infection.curb65).score).toBe(2);
    expect(infectionScoreAdvice("curb65", infection.curb65)).toMatchObject({
      tone: "warn",
    });
  });

  it("toggles sources and evaluates temperature thresholds", () => {
    const pulmonary = toggleInfectionMultiValue([], "肺部 Pulmonary", "sources");
    expect(pulmonary).toEqual(["肺部 Pulmonary"]);
    expect(toggleInfectionMultiValue(pulmonary, "肺部 Pulmonary", "sources")).toEqual(
      [],
    );
    expect(infectionTemperatureState("35.9").tone).toBe("danger");
    expect(infectionTemperatureState("36").tone).toBe("norm");
    expect(infectionTemperatureState("38").label).toBe("發燒 ≥38°C");
  });

  it("creates antibiotic courses, cycles routes, and calculates inclusive days", () => {
    const course = createAntibioticCourse(
      { createId: () => "antibiotic-1" },
      "Cefepime",
    );
    expect(course).toEqual({
      id: "antibiotic-1",
      drug: "Cefepime",
      startDate: "",
      route: "",
      note: "",
    });
    expect(cycleAntibioticRoute("")).toBe("IV 靜脈");
    expect(cycleAntibioticRoute(ANTIBIOTIC_ROUTES.at(-1) ?? "")).toBe("");
    expect(calculateAntibioticDay("2026-09-01", new Date(2026, 8, 3)).text).toBe(
      "Day 3",
    );
    expect(allAntibioticOptions(["Custom-X", "Cefepime"]).at(-1)).toBe("Custom-X");
  });
});
