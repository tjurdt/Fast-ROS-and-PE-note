import { describe, expect, it } from "vitest";

import type { FindingValue } from "../../src/domain/clinical/finding";
import { searchProblems } from "../../src/domain/ed/complaints";
import { composeChart, composePeFieldDetail } from "../../src/domain/ed/compose";
import { HISTORY_ITEMS, historyItem } from "../../src/domain/ed/history-library";
import { matrixKey } from "../../src/domain/ed/pe-matrix";
import { PE_ITEMS, peItem } from "../../src/domain/ed/pe-library";
import { cyclePick, pickedOptions } from "../../src/domain/ed/picks";
import { ED_PROBLEMS } from "../../src/domain/ed/problems";
import { edKey, type HistoryPick, type PeMatrixRow } from "../../src/domain/ed/types";
import { nextYesNo } from "../../src/features/ed-note/ed-controls";

type Findings = Record<string, FindingValue>;
const MALE = { sex: "男 M", age: "40" };

function matrixRow(itemId: string, label: string): PeMatrixRow {
  const row = peItem(itemId)?.matrix?.rows.find((entry) => entry.label === label);
  if (!row) throw new Error(`no matrix row ${itemId}/${label}`);
  return row;
}

/** 在一個 PE 矩陣題上選類型、變化型、部位，回傳該題的 finding。 */
function matrixFinding(
  itemId: string,
  picks: { row: string; variants?: string[]; sites?: string[] }[],
): FindingValue {
  const fu: Record<string, string> = {};
  for (const pick of picks) {
    const row = matrixRow(itemId, pick.row);
    fu[matrixKey.row(row)] = "1";
    for (const variant of pick.variants ?? [])
      fu[matrixKey.variant(row, variant)] = "1";
    for (const site of pick.sites ?? []) fu[matrixKey.site(row, site)] = "1";
  }
  return { sel: "abn", fu };
}

describe("tap behaviour", () => {
  it("cycles a yes/no question POS → NEG → NUL", () => {
    let finding: FindingValue = {};
    finding = nextYesNo(finding);
    expect(finding.on).toBe(true);
    finding = nextYesNo(finding);
    expect(finding.on).toBe(false);
    finding = nextYesNo(finding);
    expect(finding.on).toBeUndefined();
  });

  it("cycles a single-choice pick through its options and back to blank", () => {
    const item = historyItem("bp_type") as HistoryPick;
    expect(item.multi).toBeFalsy();
    let finding: FindingValue = {};
    const seen: string[] = [];
    for (let step = 0; step < item.options.length; step += 1) {
      finding = cyclePick(item, finding);
      seen.push(pickedOptions({ [edKey.history(item.id)]: finding }, item.id)[0] ?? "");
    }
    expect(seen).toEqual(item.options.map((option) => option.label));
    finding = cyclePick(item, finding);
    expect(pickedOptions({ [edKey.history(item.id)]: finding }, item.id)).toEqual([]);
  });

  it("lets everything that can co-occur be multi-select", () => {
    const mustBeMulti = [
      "onset",
      "abd_quality",
      "chest_quality",
      "dizzy_kind",
      "mechanism",
      "palp_pattern",
      "syncope_trigger",
      "dysp_trigger",
      "abd_site",
      "aggravate",
      "alleviate",
      "cough_char",
      "headache_site",
      "headache_quality",
    ];
    for (const id of mustBeMulti) {
      const item = historyItem(id);
      expect(item?.type, id).toBe("pick");
      expect((item as HistoryPick).multi, id).toBe(true);
    }
    // 真的互斥的才維持單選（循環）。
    for (const id of ["bp_type", "glu_type", "course", "episode", "ingest_intent"]) {
      expect((historyItem(id) as HistoryPick).multi, id).toBeFalsy();
    }
  });
});

describe("breath sounds and other type × site findings", () => {
  it("writes each sound once with its own variant and sites", () => {
    const findings: Findings = {
      [edKey.pe("chest_bs")]: matrixFinding("chest_bs", [
        { row: "囉音", variants: ["fine"], sites: ["RLL", "LLL"] },
        { row: "喘鳴", variants: ["expiratory"], sites: ["bil"] },
        { row: "減弱", sites: ["R"] },
        { row: "吸氣喘鳴", variants: ["inspiratory"] },
      ]),
    };
    const out = composePeFieldDetail("CHEST", ["chest_bs"], findings).text;
    expect(out).toBe(
      "decreased BS (R), fine rales (RLL, LLL), expiratory wheezing (bil), inspiratory stridor",
    );
  });

  it("unselecting a sound clears its variants and sites", () => {
    const row = matrixRow("chest_bs", "喘鳴");
    const finding = matrixFinding("chest_bs", [
      { row: "喘鳴", variants: ["biphasic"], sites: ["L"] },
    ]);
    expect(finding.fu?.[matrixKey.site(row, "L")]).toBe("1");
  });

  it("grades limb strength and edema, and still reads old quick-pick phrases", () => {
    const mp = matrixFinding("neuro_mp", [
      { row: "右上肢", variants: ["4"] },
      { row: "左下肢", variants: ["2"] },
    ]);
    const edema = matrixFinding("ext_edema", [
      { row: "凹陷水腫", variants: ["2+"], sites: ["bil legs"] },
    ]);
    const legacy: FindingValue = { sel: "abn", fu: { rales: "1", wheezing: "1" } };
    const findings: Findings = {
      [edKey.pe("neuro_mp")]: mp,
      [edKey.pe("ext_edema")]: edema,
      [edKey.pe("chest_bs")]: legacy,
    };
    expect(composePeFieldDetail("NEURO", ["neuro_mp"], findings).text).toBe(
      "RUE MP 4, LLE MP 2",
    );
    expect(composePeFieldDetail("EXT", ["ext_edema"], findings).text).toBe(
      "pitting edema 2+ (bil legs)",
    );
    expect(composePeFieldDetail("CHEST", ["chest_bs"], findings).text).toBe(
      "rales, wheezing",
    );
  });

  it("keeps matrix rows unique and their keys collision-free", () => {
    for (const item of PE_ITEMS) {
      const rows = item.matrix?.rows ?? [];
      const labels = rows.map((row) => row.label);
      expect(new Set(labels).size, item.id).toBe(labels.length);
      const texts = rows.map((row) => row.text);
      expect(new Set(texts).size, item.id).toBe(texts.length);
    }
  });
});

describe("search by Chinese, English and abbreviations", () => {
  const cases: [string, string][] = [
    ["SOB", "dyspnea"],
    ["N/V", "nausea_vomiting"],
    ["GIB", "gi_bleed"],
    ["UTI", "urinary"],
    ["AMS", "ams"],
    ["DKA", "glucose"],
    ["CP", "chest_pain"],
    ["BPPV", "dizziness"],
    ["COPD", "wheeze"],
    ["FB", "foreign_body"],
    ["OD", "intox"],
    ["TMJ", "dental"],
    ["痔瘡", "anorectal"],
    ["睪丸", "scrotal"],
    ["破水", "preg_issue"],
    ["骨折", "limb_injury"],
    ["撕裂傷", "wound"],
    ["蜂窩性組織炎", "cellulitis"],
    ["尿管", "device_prob"],
    ["蛇咬", "bite_sting"],
    ["咳血", "hemoptysis"],
    ["火燒心", "reflux"],
    ["中暑", "env_injury"],
  ];
  for (const [query, id] of cases) {
    it(`finds ${id} by "${query}"`, () => {
      expect(searchProblems(query).map((problem) => problem.id)).toContain(id);
    });
  }
});

describe("the richer library", () => {
  it("has plenty of symptoms, questions and exam items", () => {
    expect(ED_PROBLEMS.length).toBeGreaterThanOrEqual(50);
    expect(HISTORY_ITEMS.length).toBeGreaterThanOrEqual(220);
    expect(PE_ITEMS.length).toBeGreaterThanOrEqual(90);
  });

  it("writes the free background box into PH without a prefix", () => {
    const findings: Findings = {
      [edKey.pmh("htn")]: { on: true },
      [edKey.ctx("situation")]: { text: "pregnant (GA 20w)" },
    };
    expect(composeChart(findings, MALE).fields.PH).toBe(
      "HX: HTN; pregnant (GA 20w); T(-) O(-) C(-) C(-)",
    );
  });
});
