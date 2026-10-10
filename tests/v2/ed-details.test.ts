import { describe, expect, it } from "vitest";

import type { FindingValue } from "../../src/domain/clinical/finding";
import { parseChartText, serializeChart } from "../../src/domain/ed/chart-text";
import {
  composeChart,
  composeTOCC,
  selectedProblems,
  toggleProblemFinding,
} from "../../src/domain/ed/compose";
import {
  DURATION_CYCLE,
  cycleDuration,
  durationCode,
  durationPhrase,
  setCustomDuration,
} from "../../src/domain/ed/duration";
import { ORDER_MEMO_MAX, orderMemo } from "../../src/domain/ed/order-memo";
import { planOrders } from "../../src/domain/ed/order-rules";
import { edOrder } from "../../src/domain/ed/orders";
import { ED_PROBLEMS } from "../../src/domain/ed/problems";
import { edKey } from "../../src/domain/ed/types";

type Findings = Record<string, FindingValue>;
const PATIENT = { sex: "男 M", age: "40" };

function withProblems(...ids: string[]): Findings {
  const findings: Findings = {};
  for (const id of ids)
    findings[edKey.problem(id)] = toggleProblemFinding(findings, id);
  return findings;
}

const icd = (findings: Findings) =>
  composeChart(findings, PATIENT).icd.map((line) => line.code);

describe("per-complaint time cycle", () => {
  it("cycles TODAY → … → 1W → 自訂 → unset", () => {
    let findings: Findings = withProblems("fever");
    const seen: string[] = [];
    for (let i = 0; i <= DURATION_CYCLE.length; i += 1) {
      findings = { ...findings, [edKey.duration]: cycleDuration(findings, "fever") };
      seen.push(durationCode(findings, "fever"));
    }
    expect(seen).toEqual([
      "TODAY",
      "2H",
      "6H",
      "12H",
      "1D",
      "2D",
      "3D",
      "5D",
      "1W",
      "CUSTOM",
      "",
    ]);
  });

  it("keeps each complaint's time separate and writes readable phrases", () => {
    let findings: Findings = withProblems("fever", "cough_uri");
    findings = {
      ...findings,
      [edKey.duration]: { fu: { fever: "2D", cough_uri: "TODAY" } },
    };
    expect(durationPhrase(findings, "fever")).toBe("for 2 days");
    expect(durationPhrase(findings, "cough_uri")).toBe("today");
    findings = {
      ...findings,
      [edKey.duration]: setCustomDuration(findings, "fever", "since 22:00"),
    };
    expect(durationPhrase(findings, "fever")).toBe("since 22:00");
    expect(durationPhrase(findings, "cough_uri")).toBe("today");
  });
});

describe("secondary complaints in PI", () => {
  it("does not repeat a complaint as its own question, but keeps the question's detail", () => {
    const findings = {
      ...withProblems("abd_pain", "fever"),
      [edKey.duration]: { fu: { fever: "2D" } },
      [edKey.history("fever")]: { on: true, text: "Tmax 38.5" },
    };
    const pi = composeChart(findings, PATIENT).fields.PI;
    expect(pi.startsWith("fever for 2 days (Tmax 38.5)")).toBe(true);
    expect(pi.match(/fever/g)).toHaveLength(1);
  });
});

describe("TOCC", () => {
  it("defaults to all negative and only rewrites the ones marked positive", () => {
    expect(composeTOCC({})).toBe("T(-) O(-) C(-) C(-)");
    expect(composeTOCC({ [edKey.tocc("t")]: { sel: "+", text: "Japan" } })).toBe(
      "T(+: Japan) O(-) C(-) C(-)",
    );
    expect(composeChart(withProblems("fever"), PATIENT).fields.PH).toBe(
      "T(-) O(-) C(-) C(-)",
    );
  });
});

describe("ICD follows the interview answers", () => {
  it("uses the abdominal quadrant when the site is known", () => {
    const base = withProblems("abd_pain");
    expect(icd(base)).toEqual(["R10.9"]);
    expect(icd({ ...base, [edKey.history("abd_site")]: { sel: "右下腹" } })).toEqual([
      "R10.31",
    ]);
    expect(
      icd({ ...base, [edKey.history("abd_site")]: { sel: "上腹／心窩" } }),
    ).toEqual(["R10.13"]);
  });

  it("maps chest pressure and tightness to R07.89 once, and keeps R07.9 for stabbing pain", () => {
    const base = withProblems("chest_pain");
    expect(icd({ ...base, [edKey.history("chest_quality")]: { sel: "悶" } })).toEqual([
      "R07.89",
    ]);
    expect(
      icd({ ...base, [edKey.history("chest_quality")]: { sel: "壓迫／緊縮" } }),
    ).toEqual(["R07.89"]);
    expect(icd({ ...base, [edKey.history("chest_quality")]: { sel: "刺痛" } })).toEqual(
      ["R07.9"],
    );
  });

  it("codes an acute cough only when the complaint time says so", () => {
    const base = withProblems("cough_uri");
    expect(icd(base)).toEqual(["R05.9"]);
    expect(icd({ ...base, [edKey.duration]: { fu: { cough_uri: "3D" } } })).toEqual([
      "R05.1",
    ]);
  });

  it("drops vomiting from the code when vomiting was denied", () => {
    const base = withProblems("nausea_vomiting");
    expect(icd(base)).toEqual(["R11.2"]);
    expect(icd({ ...base, [edKey.history("vomiting")]: { on: false } })).toEqual([
      "R11.0",
    ]);
  });

  it("adds laterality for limb pain and uses it for the CC", () => {
    const findings = {
      ...withProblems("limb"),
      [edKey.history("limb_site")]: { sel: "左下肢" },
    };
    expect(icd(findings)).toEqual(["M79.605"]);
    expect(composeChart(findings, PATIENT).fields.CC).toBe("L leg pain/swelling");
  });

  it("does not call ear pain a sore throat", () => {
    const base = withProblems("ent");
    expect(icd(base)).toEqual(["R07.0"]);
    expect(icd({ ...base, [edKey.history("ent_type")]: { sel: "耳痛" } })).toEqual([
      "H92.09",
    ]);
  });

  it("uses melena / hematemesis codes for the bleeding type", () => {
    const base = withProblems("gi_bleed");
    expect(icd({ ...base, [edKey.history("gib_type")]: { sel: "黑便" } })).toEqual([
      "K92.1",
    ]);
    expect(icd({ ...base, [edKey.history("gib_type")]: { sel: "咖啡渣" } })).toEqual([
      "K92.0",
    ]);
    expect(icd({ ...base, [edKey.history("gib_type")]: { sel: "血便" } })).toEqual([
      "K92.2",
    ]);
  });
});

describe("fewer must-do exams", () => {
  it("keeps at most a handful of ★ exams per problem", () => {
    for (const problem of ED_PROBLEMS) {
      expect(problem.peMust.length, problem.id).toBeLessThanOrEqual(
        problem.id === "trauma" ? 5 : 3,
      );
    }
  });
});

describe("imaging memo for the ERS 請輸入說明 dialog", () => {
  it("writes 診斷說明 and 檢查目的 for the chest film only", () => {
    const findings = {
      ...withProblems("fever", "cough_uri"),
      [edKey.duration]: { fu: { fever: "2D" } },
    };
    const chart = composeChart(findings, PATIENT);
    const problems = selectedProblems(findings);
    const cxr = edOrder("cxr_pa");
    const cbc = edOrder("cbc_dc");
    if (!cxr || !cbc) throw new Error("catalog changed");
    expect(orderMemo(cbc, problems, chart.fields.CC)).toBeNull();
    expect(orderMemo(cxr, problems, chart.fields.CC)).toEqual({
      dx: "fever for 2 days",
      purpose: "r/o pneumonia",
    });

    const text = serializeChart(chart, PATIENT, [cbc, cxr], problems);
    expect(text).toContain(
      "15002010|CHEST PA VIEW|0000000|Patient|URGENT|fever for 2 days|r/o pneumonia",
    );
    const parsed = parseChartText(text);
    const parsedCxr = parsed.orders.find((order) => order.pfkey === "15002010");
    expect(parsedCxr?.memoDx).toBe("fever for 2 days");
    expect(parsedCxr?.memoPurpose).toBe("r/o pneumonia");
    expect(parsed.orders.find((order) => order.pfkey === cbc.pfkey)?.memoDx).toBe("");
  });

  it("never lets a pipe or newline break the exchange line, and stays under the ERS limit", () => {
    const cxr = edOrder("cxr_pa");
    if (!cxr) throw new Error("catalog changed");
    const memo = orderMemo(cxr, [], `a|b\nc ${"x".repeat(400)}`);
    expect(memo?.dx).not.toMatch(/[|\n]/);
    expect(memo?.dx.length).toBeLessThanOrEqual(ORDER_MEMO_MAX);
  });

  it("is carried by every suggested X-ray for the common chest problems", () => {
    for (const id of ["dyspnea", "chest_pain", "fever"]) {
      const findings = withProblems(id);
      const plan = planOrders(findings, PATIENT);
      const xray = plan.selected.filter((order) => order.group === "xray");
      for (const order of xray) {
        expect(orderMemo(order, selectedProblems(findings), "x")?.purpose).not.toBe("");
      }
    }
  });
});
