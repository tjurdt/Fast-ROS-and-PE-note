import { describe, expect, it } from "vitest";

import {
  COMMON_PROBLEM_IDS,
  addCustomComplaint,
  customComplaints,
  keywordProblemIds,
  removeCustomComplaint,
  searchProblems,
  selectedComplaints,
} from "../../src/domain/ed/complaints";
import {
  buildInterview,
  composeCC,
  composeChart,
  composePH,
  composePI,
  composePIDetail,
  composePeFieldDetail,
  interviewItemIds,
  selectedProblems,
  toggleProblemFinding,
} from "../../src/domain/ed/compose";
import { fitClauses, type Clause } from "../../src/domain/ed/condense";
import { historyItem } from "../../src/domain/ed/history-library";
import { ED_PROBLEMS, PROBLEM_GROUP_ORDER } from "../../src/domain/ed/problems";
import { SPECIAL_ITEMS, appendSituation } from "../../src/domain/ed/special";
import { edKey } from "../../src/domain/ed/types";
import type { FindingValue } from "../../src/domain/clinical/finding";

type Findings = Record<string, FindingValue>;
const PATIENT = { sex: "男 M", age: "40" };

function withProblems(...ids: string[]): Findings {
  const findings: Findings = {};
  for (const id of ids)
    findings[edKey.problem(id)] = toggleProblemFinding(findings, id);
  return findings;
}

function addCustom(findings: Findings, phrase: string): Findings {
  const next = addCustomComplaint(findings, phrase);
  return next ? { ...findings, [edKey.custom]: next } : findings;
}

describe("symptom search", () => {
  it("finds the standard problem by label, colloquial words and English", () => {
    expect(searchProblems("肚子痛")[0]?.id).toBe("abd_pain");
    expect(searchProblems("喘")[0]?.id).toBe("dyspnea");
    expect(searchProblems("vertigo")[0]?.id).toBe("dizziness");
    expect(searchProblems("SOB")[0]?.id).toBe("dyspnea");
    expect(searchProblems("黑便").map((p) => p.id)).toContain("gi_bleed");
    expect(searchProblems("  ")).toEqual([]);
    expect(searchProblems("zzzzzz")).toEqual([]);
  });

  it("has keywords for every problem and valid common ids", () => {
    expect(keywordProblemIds().sort()).toEqual(ED_PROBLEMS.map((p) => p.id).sort());
    const ids = new Set(ED_PROBLEMS.map((p) => p.id));
    for (const id of COMMON_PROBLEM_IDS) expect(ids.has(id)).toBe(true);
    expect(new Set(COMMON_PROBLEM_IDS).size).toBe(COMMON_PROBLEM_IDS.length);
  });

  it("groups every problem into a known group and keeps ENT/eye out of cardiopulmonary", () => {
    for (const problem of ED_PROBLEMS) {
      expect(PROBLEM_GROUP_ORDER).toContain(problem.group);
    }
    expect(ED_PROBLEMS.find((p) => p.id === "ent")?.group).toBe("五官");
    expect(ED_PROBLEMS.find((p) => p.id === "eye")?.group).toBe("五官");
    expect(ED_PROBLEMS.find((p) => p.id === "psych")?.group).toBe("精神");
    for (const group of PROBLEM_GROUP_ORDER) {
      expect(ED_PROBLEMS.some((p) => p.group === group)).toBe(true);
    }
  });
});

describe("custom and main complaints", () => {
  it("adds, de-duplicates and removes custom complaints", () => {
    let findings: Findings = {};
    findings = addCustom(findings, "  右上腹 悶痛  ");
    findings = addCustom(findings, "右上腹 悶痛");
    findings = addCustom(findings, "   ");
    expect(customComplaints(findings).map((c) => c.phrase)).toEqual(["右上腹 悶痛"]);
    findings = {
      ...findings,
      [edKey.custom]: removeCustomComplaint(findings, "右上腹 悶痛"),
    };
    expect(customComplaints(findings)).toEqual([]);
  });

  it("orders complaints by selection and lets the doctor pick the main one", () => {
    // 選取順序：發燒(1) → 自訂(2) → 腹痛(3)
    let findings = withProblems("fever");
    findings = addCustom(findings, "RUQ dull pain");
    findings = {
      ...findings,
      [edKey.problem("abd_pain")]: toggleProblemFinding(findings, "abd_pain"),
    };
    const order = selectedComplaints(findings).map((e) => e.label);
    expect(order).toEqual(["發燒", "RUQ dull pain", "腹痛"]);

    const main = { ...findings, [edKey.main]: { sel: "custom:RUQ dull pain" } };
    expect(selectedComplaints(main)[0]?.label).toBe("RUQ dull pain");
    expect(composeCC(selectedProblems(main), main).startsWith("RUQ dull pain")).toBe(
      true,
    );

    const mainProblem = { ...findings, [edKey.main]: { sel: "abd_pain" } };
    expect(selectedProblems(mainProblem)[0]?.id).toBe("abd_pain");
  });

  it("writes custom complaints into CC without bringing in a question bank", () => {
    let findings = addCustom({}, "RUQ dull pain");
    findings = {
      ...findings,
      [edKey.duration]: { fu: { "custom:RUQ dull pain": "3D" } },
    };
    expect(selectedProblems(findings)).toEqual([]);
    expect(composeCC([], findings)).toBe("RUQ dull pain for 3 days");
    expect(composeChart(findings, PATIENT).fields.CC).toBe("RUQ dull pain for 3 days");
  });

  it("keeps sequence numbers increasing when custom complaints and problems are mixed", () => {
    let findings = addCustom({}, "first custom");
    const next = toggleProblemFinding(findings, "fever");
    expect(Number(next.note)).toBe(2);
    findings = { ...findings, [edKey.problem("fever")]: next };
    expect(customComplaints(findings)[0]?.seq).toBe(1);
  });
});

describe("clause fitting", () => {
  const clauses: Clause[] = [
    { id: "a", text: "aaaaaaaaaa", score: 80 },
    { id: "b", text: "bbbbbbbbbb", score: 10 },
    { id: "c", text: "cccccccccc", score: 10 },
    { id: "d", text: "dddddddddd", score: 100, locked: true },
  ];
  const render = (kept: readonly Clause[]) => kept.map((c) => c.text).join(",");
  const none = () => undefined;

  it("drops the least important clause first and the later one on a tie", () => {
    const result = fitClauses(clauses, render, 32, none, true);
    expect(result.text).toBe("aaaaaaaaaa,bbbbbbbbbb,dddddddddd");
    expect(result.clauses.find((c) => c.id === "c")?.state).toBe("auto");
    expect(result.over).toBe(false);
  });

  it("never drops locked clauses and reports when it is still over the limit", () => {
    const result = fitClauses(clauses, render, 5, none, true);
    expect(result.text).toBe("dddddddddd");
    expect(result.over).toBe(true);
  });

  it("keeps everything when auto-fit is off", () => {
    const result = fitClauses(clauses, render, 10, none, false);
    expect(result.clauses.every((c) => c.state === "in")).toBe(true);
    expect(result.over).toBe(true);
  });

  it("honours omit and keep overrides", () => {
    const omit = fitClauses(
      clauses,
      render,
      100,
      (id) => (id === "a" ? "omit" : undefined),
      true,
    );
    expect(omit.text).not.toContain("aaaa");
    expect(omit.clauses.find((c) => c.id === "a")?.state).toBe("user");
    const keep = fitClauses(
      clauses,
      render,
      32,
      (id) => (id === "c" ? "keep" : undefined),
      true,
    );
    expect(keep.text).toContain("cccc");
    expect(keep.clauses.find((c) => c.id === "c")?.state).toBe("kept");
    expect(keep.clauses.find((c) => c.id === "b")?.state).toBe("auto");
  });
});

/** 把整份問診都回答「無」，製造很長的 PI。 */
function allNegative(problemIds: string[]): Findings {
  let findings = withProblems(...problemIds);
  const interview = buildInterview(selectedProblems(findings), findings, PATIENT);
  for (const id of interviewItemIds(interview)) {
    if (historyItem(id)?.type === "yn")
      findings = { ...findings, [edKey.history(id)]: { on: false } };
  }
  return findings;
}

describe("PI / PH / PE condensing", () => {
  it("trims an over-long PI to the ERS limit, dropping minor negatives before findings", () => {
    const base = allNegative(["fever", "abd_pain", "nausea_vomiting", "dyspnea"]);
    const findings: Findings = {
      ...base,
      [edKey.history("vomiting")]: { on: true, text: "x3" },
      [edKey.ctx("piExtra")]: { text: "家人也有類似症狀" },
    };
    const problems = selectedProblems(findings);
    const fitted = composePIDetail(problems, findings, PATIENT);
    expect(fitted.text.length).toBeLessThanOrEqual(240);
    expect(fitted.text).toContain("vomiting (x3)");
    expect(fitted.text).toContain("家人也有類似症狀");
    expect(fitted.clauses.some((c) => c.state === "auto")).toBe(true);

    const full = composePIDetail(
      problems,
      { ...findings, [edKey.ctx("autoFit")]: { text: "off" } },
      PATIENT,
    );
    expect(full.text.length).toBeGreaterThan(240);
    expect(full.over).toBe(true);
    expect(full.clauses.every((c) => c.state === "in")).toBe(true);
  });

  it("lets the doctor force a clause out or in regardless of the limit", () => {
    const base = withProblems("fever");
    const findings: Findings = { ...base, [edKey.history("headache")]: { on: false } };
    const problems = selectedProblems(findings);
    expect(composePI(problems, findings, PATIENT)).toContain("headache");
    const omitted = { ...findings, [edKey.omit("h.headache")]: { sel: "omit" } };
    expect(composePI(problems, omitted, PATIENT)).not.toContain("headache");
    expect(
      composePIDetail(problems, omitted, PATIENT).clauses.find(
        (c) => c.id === "h.headache",
      )?.state,
    ).toBe("user");
  });

  it("writes the free-text situation into PH, and still prints old ticked ones", () => {
    const findings: Findings = {
      ...withProblems("fever"),
      [edKey.special("pregnant")]: { on: true, text: "GA 20w" },
      [edKey.ctx("situation")]: { text: "on chemotherapy, from nursing home" },
      [edKey.pmh("htn")]: { on: true },
    };
    expect(composePH(findings)).toBe(
      "HX: HTN; Situation: pregnant (GA 20w), on chemotherapy, from nursing home; T(-) O(-) C(-) C(-)",
    );
  });

  it("inserts a common situation into the free text without duplicating it", () => {
    expect(appendSituation("", "DNR")).toBe("DNR");
    expect(appendSituation("bedridden", "DNR")).toBe("bedridden, DNR");
    expect(appendSituation("bedridden, DNR", "DNR")).toBe("bedridden, DNR");
    expect(appendSituation("bedridden,", "DNR")).toBe("bedridden, DNR");
  });

  it("no longer offers the visit-related (PI) situations", () => {
    const ids = SPECIAL_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["ems", "intoxicated", "comm_barrier", "unaccompanied", "ohca"]) {
      expect(ids).not.toContain(id);
    }
    for (const item of SPECIAL_ITEMS) expect(item.target).toBe("PH");
  });

  it("appends free-text PE findings and supports omitting one exam item", () => {
    const base = withProblems("abd_pain");
    const findings: Findings = {
      ...base,
      [edKey.pe("abd_tender")]: { sel: "abn", fu: { RLQ: "1" } },
      [edKey.peExtra("ABD")]: { text: "surgical scar at midline" },
    };
    const chart = composeChart(findings, PATIENT);
    expect(chart.fields.ABD).toContain("surgical scar at midline");
    expect(chart.fields.ABD).toContain("RLQ");
    const omitted = { ...findings, [edKey.omit("pe.abd_tender")]: { sel: "omit" } };
    const detail = composePeFieldDetail("ABD", ["abd_tender"], omitted);
    expect(detail.text).not.toContain("RLQ");
    expect(detail.text).toContain("surgical scar");
    expect(detail.clauses[0]?.state).toBe("user");
  });

  it("outputs a PE free-text field even when no exam item was chosen for it", () => {
    const findings: Findings = {
      ...withProblems("fever"),
      [edKey.peExtra("EXT")]: { text: "L leg 2x3 cm erythema" },
    };
    expect(composeChart(findings, PATIENT).fields.EXT).toBe("L leg 2x3 cm erythema");
  });
});
