import { describe, expect, it } from "vitest";

import type { FindingValue } from "../../src/domain/clinical/finding";
import { composeChart, toggleProblemFinding } from "../../src/domain/ed/compose";
import { HISTORY_ITEMS } from "../../src/domain/ed/history-library";
import { ED_PROBLEMS } from "../../src/domain/ed/problems";
import { edKey } from "../../src/domain/ed/types";

type Findings = Record<string, FindingValue>;
const MALE = { sex: "男 M", age: "40" };

function withProblems(ids: readonly string[]): Findings {
  const findings: Findings = { [edKey.ctx("autoFit")]: { text: "off" } };
  for (const id of ids)
    findings[edKey.problem(id)] = toggleProblemFinding(findings, id);
  return findings;
}

type Pattern = "yes" | "no" | "mixed";

/** 把全部問診題依樣式作答：yes＝有（附獨一無二的細節）＋複選全選、no＝無、mixed＝交錯。 */
function answerAll(base: Findings, pattern: Pattern): Findings {
  const findings: Findings = { ...base };
  HISTORY_ITEMS.forEach((item, index) => {
    const positive = pattern === "yes" || (pattern === "mixed" && index % 2 === 0);
    if (item.type === "yn") {
      findings[edKey.history(item.id)] = positive
        ? { on: true, text: `#${index}` }
        : { on: false };
    } else if (item.type === "pick") {
      if (pattern === "no") return;
      findings[edKey.history(item.id)] = item.multi
        ? positive
          ? { fu: Object.fromEntries(item.options.map((o) => [o.label, "1"])) }
          : { fu: { [item.options[0]?.label ?? ""]: "1" } }
        : { sel: item.options[positive ? 0 : item.options.length - 1]?.label ?? "" };
    } else if (pattern !== "no") {
      findings[edKey.history(item.id)] = { text: "v1" };
    }
  });
  return findings;
}

/** 症狀關鍵字：PI 裡每個最多出現一次，且不能同時出現在陽性與「no …」陰性清單。 */
const SYMPTOM_WORDS = [
  "abd pain",
  "nausea",
  "vomiting",
  "dyspnea",
  "melena",
  "hematochezia",
  "hematemesis",
  "chest pain",
  "chest tightness",
  "dizziness",
  "fever",
  "cough",
  "headache",
  "diarrhea",
  "dysuria",
  "hematuria",
  "flank pain",
  "sore throat",
  "epistaxis",
  "constipation",
  "rash",
  "seizure",
  "syncope",
  "palpitation",
];

function countWord(text: string, word: string): number {
  return (text.match(new RegExp(`(?<![A-Za-z-])${word}(?![A-Za-z])`, "gu")) ?? [])
    .length;
}

function assertNoRepeat(pi: string, label: string) {
  const [positive = "", negative = ""] = pi.split(/\. no /u);
  for (const word of SYMPTOM_WORDS) {
    // "dyspnea" 也會出現在 "exertional dyspnea" 這類不同事情的描述，只檢查完整重複。
    const inPositive = countWord(positive, word);
    const inNegative = countWord(negative, word);
    expect(inPositive, `${label}: "${word}" repeated in "${pi}"`).toBeLessThanOrEqual(
      1,
    );
    expect(
      inPositive > 0 && inNegative > 0,
      `${label}: "${word}" both positive and negative in "${pi}"`,
    ).toBe(false);
  }
  // 括號裡是各症狀自己的細節（胸痛的 burning 和腹痛的 burning 是兩件事），只比對括號外。
  const pieces = pi
    .replace(/\([^()]*\)/gu, "")
    .split(/[;,.()]/u)
    .map((piece) => piece.trim().toLowerCase())
    .filter((piece) => piece.length > 3);
  const seen = new Set<string>();
  for (const piece of pieces) {
    expect(seen.has(piece), `${label}: duplicate "${piece}" in "${pi}"`).toBe(false);
    seen.add(piece);
  }
}

describe("PI never says the same thing twice", () => {
  const ids = ED_PROBLEMS.map((problem) => problem.id);
  const patterns: Pattern[] = ["yes", "no", "mixed"];

  it("holds for every single complaint under every answer pattern", () => {
    for (const id of ids) {
      for (const pattern of patterns) {
        const findings = answerAll(withProblems([id]), pattern);
        assertNoRepeat(composeChart(findings, MALE).fields.PI, `${id}/${pattern}`);
      }
    }
  });

  it("holds for every pair of complaints under every answer pattern", () => {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = 0; j < ids.length; j += 1) {
        if (i === j) continue;
        const pair = [ids[i] ?? "", ids[j] ?? ""];
        for (const pattern of patterns) {
          const findings = answerAll(withProblems(pair), pattern);
          assertNoRepeat(composeChart(findings, MALE).fields.PI, `${pair}/${pattern}`);
        }
      }
    }
  }, 120_000);

  it("writes several abdominal sites as one 'abd pain (…)' instead of repeating pain", () => {
    const findings: Findings = {
      ...withProblems(["fever", "abd_pain"]),
      [edKey.history("abd_site")]: { fu: { 右上腹: "1", 左上腹: "1", 臍周: "1" } },
      [edKey.history("abd_pain")]: { on: true },
    };
    const pi = composeChart(findings, MALE).fields.PI;
    expect(pi).toContain("abd pain (RUQ, LUQ, periumbilical)");
    expect(countWord(pi, "abd pain")).toBe(1);
  });

  it("folds a yes/no item the complaint already covers into that sentence", () => {
    const findings: Findings = {
      ...withProblems(["fever", "dyspnea"]),
      [edKey.history("dyspnea")]: { on: true, text: "since morning" },
      [edKey.history("dysp_trigger")]: { fu: { 休息時也喘: "1" } },
    };
    const pi = composeChart(findings, MALE).fields.PI;
    expect(countWord(pi, "dyspnea")).toBe(1);
    expect(pi).toContain("since morning");
    expect(pi).toContain("at rest");
  });

  it("drops 'no X' when X is positive somewhere else", () => {
    const findings: Findings = {
      ...withProblems(["fever", "abd_pain"]),
      [edKey.history("abd_site")]: { fu: { 右下腹: "1" } },
      [edKey.history("abd_pain")]: { on: false },
    };
    const pi = composeChart(findings, MALE).fields.PI;
    expect(pi).not.toContain("no abd pain");
  });
});
