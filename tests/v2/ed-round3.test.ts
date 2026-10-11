import { describe, expect, it } from "vitest";

import type { FindingValue } from "../../src/domain/clinical/finding";
import {
  ALL_CHIPS,
  chipActive,
  problemsWithoutChip,
  toggleChip,
} from "../../src/domain/ed/complaint-chips";
import { composeChart, toggleProblemFinding } from "../../src/domain/ed/compose";
import { historyItem } from "../../src/domain/ed/history-library";
import { planOrders } from "../../src/domain/ed/order-rules";
import { ED_ORDERS, edOrder } from "../../src/domain/ed/orders";
import { pickedOptions, togglePick } from "../../src/domain/ed/picks";
import { edKey, type HistoryPick } from "../../src/domain/ed/types";

type Findings = Record<string, FindingValue>;
const MALE = { sex: "男 M", age: "40" };
const FEMALE_28 = { sex: "女 F", age: "28" };

function withProblems(...ids: string[]): Findings {
  const findings: Findings = {};
  for (const id of ids)
    findings[edKey.problem(id)] = toggleProblemFinding(findings, id);
  return findings;
}
const plan = (findings: Findings, patient = MALE) => planOrders(findings, patient);
const tierOf = (findings: Findings, id: string, patient = MALE) =>
  plan(findings, patient).suggestions.find((entry) => entry.order.id === id)?.tier;

describe("orders a non-specialist can place", () => {
  it("uses no item labelled (ER) except ECG, blood gas and One touch, which have no alternative", () => {
    const labelled = ED_ORDERS.filter((order) => /\(ER\)/.test(order.name)).map(
      (order) => order.id,
    );
    expect(labelled.sort()).toEqual(["ecg", "onetouch", "vbg"]);
  });

  it("orders NT-proBNP as 90612193 and the other swapped items by their regular codes", () => {
    expect(edOrder("bnp")?.pfkey).toBe("90612193");
    expect(edOrder("tni")?.pfkey).toBe("90609061");
    expect(edOrder("ddimer")?.pfkey).toBe("90608079");
    expect(edOrder("pct")?.pfkey).toBe("90612192");
    expect(edOrder("bhcg")?.pfkey).toBe("90612022");
    expect(edOrder("kub")?.pfkey).toBe("15003010");
  });
});

describe("KUB for belly problems", () => {
  it("is a standard order for abdominal pain, N/V, constipation and GI bleeding in men", () => {
    for (const id of [
      "abd_pain",
      "nausea_vomiting",
      "constipation_bloating",
      "gi_bleed",
    ]) {
      expect(tierOf(withProblems(id), "kub"), id).toBe("core");
    }
    expect(tierOf(withProblems("diarrhea"), "kub")).toBe("plus");
  });

  it("is held back (not ticked) for women of child-bearing age until pregnancy is denied", () => {
    const belly = withProblems("abd_pain");
    const held = plan(belly, FEMALE_28).suggestions.find((e) => e.order.id === "kub");
    expect(held?.tier).toBe("ask");
    expect(held?.selected).toBe(false);
    expect(held?.reasons.join("")).toContain("先驗孕");
    expect(plan(belly, FEMALE_28).selected.map((o) => o.id)).toContain("urine_hcg");

    const denied = { ...belly, [edKey.history("pregnancy_possible")]: { on: false } };
    expect(tierOf(denied, "kub", FEMALE_28)).toBe("core");
    expect(tierOf(belly, "kub", { sex: "女 F", age: "70" })).toBe("core");
  });
});

describe("liver and biliary work-up", () => {
  it("adds Bil-D and ALP for right-upper or epigastric pain", () => {
    const base = withProblems("abd_pain");
    expect(plan(base).selected.map((o) => o.id)).not.toContain("dbil");
    const ruq = { ...base, [edKey.history("abd_site")]: { fu: { 右上腹: "1" } } };
    const ids = plan(ruq).selected.map((o) => o.id);
    expect(ids).toContain("dbil");
    expect(ids).toContain("alp");
  });
});

describe("multi-select abdominal 9-grid", () => {
  it("keeps several sites, writes them together and codes each quadrant", () => {
    const item = historyItem("abd_site") as HistoryPick;
    expect(item.layout).toBe("grid9");
    let site: FindingValue = {};
    site = togglePick(item, site, "右上腹");
    site = togglePick(item, site, "上腹／心窩");
    const findings = { ...withProblems("abd_pain"), [edKey.history("abd_site")]: site };
    expect(pickedOptions(findings, "abd_site")).toEqual(["右上腹", "上腹／心窩"]);
    const chart = composeChart(findings, MALE);
    expect(chart.fields.CC).toBe("RUQ/epigastric abd pain");
    expect(chart.fields.PI.startsWith("abd pain (RUQ, epigastric)")).toBe(true);
    expect(chart.icd.map((line) => line.code)).toEqual(["R10.13", "R10.11"]);
  });

  it("still reads an old single-choice answer", () => {
    const findings = {
      ...withProblems("abd_pain"),
      [edKey.history("abd_site")]: { sel: "右下腹" },
    };
    expect(composeChart(findings, MALE).fields.CC).toBe("RLQ abd pain");
  });
});

describe("one chip per symptom", () => {
  it("covers every problem and only points at options that exist", () => {
    expect(problemsWithoutChip()).toEqual([]);
    for (const chip of ALL_CHIPS) {
      if (chip.pick) {
        const item = historyItem(chip.pick.item);
        expect(item?.type, chip.key).toBe("pick");
        if (item?.type === "pick") {
          expect(
            item.options.map((o) => o.label),
            chip.key,
          ).toContain(chip.pick.option);
        }
      }
      if (chip.yes) expect(historyItem(chip.yes)?.type, chip.key).toBe("yn");
      expect([...chip.label].length, chip.key).toBeLessThanOrEqual(4);
    }
  });

  it("selects the problem with the matching type, and drops the problem with the last chip", () => {
    const ear = ALL_CHIPS.find((chip) => chip.key === "ent:耳痛");
    const throat = ALL_CHIPS.find((chip) => chip.key === "ent:喉嚨痛");
    if (!ear || !throat) throw new Error("chips changed");
    let findings: Findings = {};
    findings = { ...findings, ...toggleChip(findings, ear) };
    findings = { ...findings, ...toggleChip(findings, throat) };
    expect(chipActive(findings, ear)).toBe(true);
    expect(findings[edKey.problem("ent")]?.on).toBe(true);
    expect(composeChart(findings, MALE).fields.CC).toBe("sore throat, ear pain");
    findings = { ...findings, ...toggleChip(findings, ear) };
    expect(findings[edKey.problem("ent")]?.on).toBe(true);
    findings = { ...findings, ...toggleChip(findings, throat) };
    expect(findings[edKey.problem("ent")]?.on).toBe(false);
  });

  it("writes the neurological CC from the chosen deficit", () => {
    const numb = ALL_CHIPS.find((chip) => chip.key === "focal_neuro:numb");
    if (!numb) throw new Error("chips changed");
    const findings = toggleChip({}, numb);
    expect(composeChart(findings, MALE).fields.CC).toBe("numbness");
  });
});

describe("PI punctuation", () => {
  it("separates different symptoms with semicolons and keeps one symptom's details together", () => {
    const findings = {
      ...withProblems("abd_pain", "fever"),
      [edKey.duration]: { fu: { fever: "2D" } },
      [edKey.history("abd_site")]: { fu: { 右下腹: "1" } },
      [edKey.history("onset")]: { sel: "漸進" },
      [edKey.history("vomiting")]: { on: true },
    };
    expect(composeChart(findings, MALE).fields.PI).toBe(
      "abd pain (RLQ), gradual onset; fever for 2 days; vomiting",
    );
  });
});
