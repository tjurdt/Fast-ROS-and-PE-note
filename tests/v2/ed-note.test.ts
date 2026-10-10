import { describe, expect, it } from "vitest";

import {
  FIELD_LIMITS,
  buildInterview,
  buildPhysical,
  composeChart,
  composeCC,
  interviewItemIds,
  selectedProblems,
  toggleProblemFinding,
} from "../../src/domain/ed/compose";
import { parseChartText, serializeChart } from "../../src/domain/ed/chart-text";
import {
  HISTORY_ITEMS,
  PMH_ITEMS,
  historyItem,
} from "../../src/domain/ed/history-library";
import { PE_ITEMS, peItem } from "../../src/domain/ed/pe-library";
import { ED_PROBLEMS } from "../../src/domain/ed/problems";
import { edKey } from "../../src/domain/ed/types";
import type { FindingValue } from "../../src/domain/clinical/finding";

const ICD_PATTERN = /^[A-Z]\d[0-9A-Z]{1,2}(\.[0-9A-Z]{1,4})?$/;
const PATIENT = { sex: "男 M", age: "40" };

function withProblems(...ids: string[]): Record<string, FindingValue> {
  const findings: Record<string, FindingValue> = {};
  for (const id of ids) {
    findings[edKey.problem(id)] = toggleProblemFinding(findings, id);
  }
  return findings;
}

function answer(
  findings: Record<string, FindingValue>,
  entries: Record<string, FindingValue>,
): Record<string, FindingValue> {
  return { ...findings, ...entries };
}

describe("ED library integrity", () => {
  it("has unique ids", () => {
    const history = HISTORY_ITEMS.map((item) => item.id);
    expect(new Set(history).size).toBe(history.length);
    const pe = PE_ITEMS.map((item) => item.id);
    expect(new Set(pe).size).toBe(pe.length);
    const problems = ED_PROBLEMS.map((problem) => problem.id);
    expect(new Set(problems).size).toBe(problems.length);
    const pmh = PMH_ITEMS.map((item) => item.id);
    expect(new Set(pmh).size).toBe(pmh.length);
  });

  it("only references items that exist, and keeps must lists inside the asked lists", () => {
    const problemsFound: string[] = [];
    for (const problem of ED_PROBLEMS) {
      const asked = new Set([...problem.characterize, ...problem.ask]);
      for (const id of [...problem.characterize, ...problem.ask, ...problem.askMore]) {
        if (!historyItem(id))
          problemsFound.push(`${problem.id} → unknown history ${id}`);
      }
      for (const id of problem.must) {
        if (!asked.has(id))
          problemsFound.push(`${problem.id}: must ${id} is not asked`);
      }
      for (const id of [...problem.pe, ...problem.peMore]) {
        if (!peItem(id)) problemsFound.push(`${problem.id} → unknown pe ${id}`);
      }
      for (const id of problem.peMust) {
        if (!problem.pe.includes(id))
          problemsFound.push(`${problem.id}: peMust ${id} not in pe`);
      }
      if (!problem.icd.some((choice) => choice.defaultOn)) {
        problemsFound.push(`${problem.id}: no default ICD`);
      }
      const duplicates = [
        ...problem.characterize,
        ...problem.ask,
        ...problem.askMore,
      ].filter((id, index, all) => all.indexOf(id) !== index);
      if (duplicates.length > 0)
        problemsFound.push(`${problem.id}: duplicate ${duplicates}`);
    }
    for (const pmh of PMH_ITEMS) {
      for (const id of pmh.asks ?? []) {
        if (!historyItem(id)) problemsFound.push(`pmh ${pmh.id} → unknown ${id}`);
      }
    }
    expect(problemsFound).toEqual([]);
  });

  it("uses well-formed ICD-10 codes and resolvable pick conditions", () => {
    for (const problem of ED_PROBLEMS) {
      for (const choice of problem.icd) {
        expect(choice.code, `${problem.id} ${choice.code}`).toMatch(ICD_PATTERN);
        expect(choice.desc.length).toBeGreaterThan(3);
        if (choice.whenPick) {
          const item = historyItem(choice.whenPick.item);
          expect(item?.type, `${choice.code} pick item`).toBe("pick");
          if (item?.type === "pick") {
            expect(
              item.options.some((option) => option.label === choice.whenPick?.option),
              `${choice.code} option ${choice.whenPick.option}`,
            ).toBe(true);
          }
        }
      }
      if (problem.ccFrom) expect(historyItem(problem.ccFrom)?.type).toBe("pick");
    }
  });

  it("covers the symptom ICD codes seen most often in historical ED notes", () => {
    const codes = new Set(
      ED_PROBLEMS.flatMap((problem) => problem.icd.map((c) => c.code)),
    );
    for (const code of [
      "R50.9",
      "R42",
      "R10.9",
      "R07.9",
      "R06.00",
      "R53.1",
      "R19.7",
      "R31.9",
      "R33.9",
      "R11.2",
      "R00.2",
      "K92.2",
      "R04.0",
      "M54.50",
      "R41.82",
      "T78.40XA",
    ]) {
      expect(codes.has(code), code).toBe(true);
    }
  });

  it("keeps every problem's all-normal PE inside the form's field limits", () => {
    for (const problem of ED_PROBLEMS) {
      const base = withProblems(problem.id);
      const normals: Record<string, FindingValue> = {};
      for (const id of [...problem.pe, ...problem.peMore])
        normals[edKey.pe(id)] = { sel: "normal" };
      const chart = composeChart(answer(base, normals), PATIENT);
      for (const [key, value] of Object.entries(chart.fields)) {
        expect(
          value.length,
          `${problem.id} ${key} (${value.length}/${FIELD_LIMITS[key as keyof typeof FIELD_LIMITS]}): ${value}`,
        ).toBeLessThanOrEqual(FIELD_LIMITS[key as keyof typeof FIELD_LIMITS]);
      }
    }
  });
});

describe("shared interview across problems", () => {
  it("asks a shared question only once and lists every reason", () => {
    const findings = withProblems("fever", "abd_pain", "nausea_vomiting");
    const problems = selectedProblems(findings);
    expect(problems.map((problem) => problem.id)).toEqual([
      "fever",
      "abd_pain",
      "nausea_vomiting",
    ]);
    const interview = buildInterview(problems, findings, PATIENT);
    const ids = interviewItemIds(interview);
    expect(new Set(ids).size).toBe(ids.length);
    const vomiting = [...interview.characterize, ...interview.core]
      .flatMap((block) => block.items)
      .find((item) => item.id === "vomiting");
    expect(vomiting?.reasons).toEqual(
      expect.arrayContaining(["發燒", "腹痛", "噁心／嘔吐"]),
    );
    expect(vomiting?.must).toBe(true);
  });

  it("merges physical exam items into one list per chart field", () => {
    const problems = selectedProblems(withProblems("fever", "abd_pain"));
    const sections = buildPhysical(problems);
    const abdomen = sections.find((section) => section.field === "ABD");
    const ids = abdomen?.core.map((item) => item.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("abd_tender");
    const all = sections.flatMap((section) =>
      [...section.core, ...section.more].map((i) => i.id),
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it("hides pregnancy questions for men and shows them for women of child-bearing age", () => {
    const findings = withProblems("abd_pain");
    const problems = selectedProblems(findings);
    const male = interviewItemIds(buildInterview(problems, findings, PATIENT));
    const female = interviewItemIds(
      buildInterview(problems, findings, { sex: "女 F", age: "28" }),
    );
    const elderly = interviewItemIds(
      buildInterview(problems, findings, { sex: "女 F", age: "78" }),
    );
    expect(male).not.toContain("lmp");
    expect(female).toContain("lmp");
    expect(elderly).not.toContain("lmp");
  });

  it("adds follow-up questions from the history chips", () => {
    const findings = answer(withProblems("dyspnea"), {
      [edKey.pmh("esrd")]: { on: true },
    });
    const problems = selectedProblems(findings);
    const interview = buildInterview(problems, findings, PATIENT);
    expect(interview.conditional?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["last_hd", "hd_missed", "access_problem"]),
    );
  });
});

describe("chart composition", () => {
  it("writes only the main complaint into CC; the others lead the PI with their own time", () => {
    const findings = answer(withProblems("abd_pain", "nausea_vomiting"), {
      [edKey.history("abd_site")]: { sel: "右下腹" },
      [edKey.duration]: { fu: { abd_pain: "1D", nausea_vomiting: "6H" } },
    });
    expect(composeCC(selectedProblems(findings), findings)).toBe(
      "RLQ abd pain for 1 day",
    );
    expect(
      composeChart(findings, PATIENT).fields.PI.startsWith("N/V for 6 hours"),
    ).toBe(true);
  });

  it("still reads the old single complaint time when the main complaint has none", () => {
    const findings = answer(withProblems("abd_pain"), {
      [edKey.ctx("duration")]: { text: "since last night" },
    });
    expect(composeCC(selectedProblems(findings), findings)).toBe(
      "abd pain since last night",
    );
  });

  it("uses a replacing pick for the CC when the problem needs one", () => {
    const findings = answer(withProblems("dizziness"), {
      [edKey.history("dizzy_kind")]: { sel: "天旋地轉" },
    });
    expect(composeCC(selectedProblems(findings), findings)).toBe("vertigo");
  });

  it("builds PI with positives first and negatives collapsed into one 'no ...' list", () => {
    const findings = answer(withProblems("abd_pain"), {
      [edKey.history("abd_site")]: { sel: "右下腹" },
      [edKey.history("onset")]: { sel: "漸進" },
      [edKey.history("nausea")]: { on: true },
      [edKey.history("vomiting")]: { on: true, text: "x3" },
      [edKey.history("diarrhea")]: { on: false },
      [edKey.history("fever")]: { on: false },
      [edKey.history("melena")]: { on: false },
    });
    const chart = composeChart(findings, PATIENT);
    expect(chart.fields.PI).toBe(
      "RLQ pain, gradual onset, nausea, vomiting (x3). no fever, diarrhea, melena",
    );
  });

  it("only writes physical findings that were actually examined", () => {
    const findings = answer(withProblems("abd_pain"), {
      [edKey.pe("abd_inspect")]: { sel: "normal" },
      [edKey.pe("abd_tender")]: { sel: "abn", fu: { RLQ: "1", periumbilical: "1" } },
      [edKey.pe("abd_rebound")]: { sel: "abn", fu: { "rebounding pain(+)": "1" } },
    });
    const chart = composeChart(findings, PATIENT);
    expect(chart.fields.ABD).toBe(
      "Soft, flat, tenderness(+) at periumbilical/RLQ, rebounding pain(+)",
    );
    expect(chart.fields.HEENT).toBe("");
  });

  it("builds PH from history chips, medication, TOCC and allergy", () => {
    const findings = answer(withProblems("fever"), {
      [edKey.pmh("htn")]: { on: true },
      [edKey.pmh("cancer")]: { on: true, text: "CRC s/p chemo" },
      [edKey.ctx("allergy")]: { text: "nil" },
      [edKey.tocc("t")]: { sel: "-" },
      [edKey.tocc("o")]: { sel: "-" },
      [edKey.tocc("c1")]: { sel: "-" },
      [edKey.tocc("c2")]: { sel: "-" },
    });
    expect(composeChart(findings, PATIENT).fields.PH).toBe(
      "HX: HTN, cancer (CRC s/p chemo); T(-) O(-) C(-) C(-); Drug allergy: nil",
    );
  });

  it("drops normal phrases to their short form only when the field would overflow", () => {
    const base = withProblems("dizziness");
    const one = composeChart(
      answer(base, { [edKey.pe("heent_conj")]: { sel: "normal" } }),
      PATIENT,
    ).fields.HEENT;
    expect(one).toBe("Pale conj(-)");

    const findings = answer(base, {
      [edKey.pe("heent_pupil")]: { sel: "normal" },
      [edKey.pe("heent_nystagmus")]: { sel: "normal" },
      [edKey.pe("heent_conj")]: { sel: "normal" },
      [edKey.pe("heent_ent")]: { sel: "normal" },
    });
    const heent = composeChart(findings, PATIENT).fields.HEENT;
    expect(heent.length).toBeLessThanOrEqual(FIELD_LIMITS.HEENT);
    expect(heent).toBe("Pale conj(-), LR(+), nystagmus(-), ENT ok");
  });

  it("applies manual overrides and flags the field", () => {
    const findings = answer(withProblems("fever"), {
      [edKey.override("CC")]: { on: true, text: "fever x3d" },
    });
    const chart = composeChart(findings, PATIENT);
    expect(chart.fields.CC).toBe("fever x3d");
    expect(chart.overridden).toEqual(["CC"]);
  });

  it("reports unanswered red-flag questions and exams", () => {
    const findings = answer(withProblems("chest_pain"), {
      [edKey.history("dyspnea")]: { on: false },
      [edKey.pe("chest_bs")]: { sel: "normal" },
    });
    const missing = composeChart(findings, PATIENT).missing;
    expect(missing.find((m) => m.id === "dyspnea")).toBeUndefined();
    expect(missing.find((m) => m.id === "cold_sweat")?.kind).toBe("history");
    expect(missing.find((m) => m.id === "heart_rhythm")?.kind).toBe("pe");
    expect(missing.find((m) => m.id === "chest_bs")).toBeUndefined();
  });
});

describe("ICD selection", () => {
  it("defaults to unspecified symptom codes of the selected problems", () => {
    const chart = composeChart(withProblems("abd_pain", "nausea_vomiting"), PATIENT);
    expect(chart.icd.map((line) => line.code)).toEqual(["R10.9", "R11.2"]);
  });

  it("follows the picked symptom type and respects manual toggles", () => {
    const findings = answer(withProblems("urinary"), {
      [edKey.history("uri_type")]: { sel: "血尿" },
    });
    expect(composeChart(findings, PATIENT).icd.map((line) => line.code)).toEqual([
      "R31.9",
    ]);
    const toggled = answer(findings, {
      [edKey.icd]: { fu: { "N39.0": "1", "R31.9": "0" }, text: "n39.0, bad" },
    });
    expect(composeChart(toggled, PATIENT).icd.map((line) => line.code)).toEqual([
      "N39.0",
    ]);
  });

  it("caps the form at five ICD rows and reports what was dropped", () => {
    const chart = composeChart(
      answer(withProblems("fever"), {
        [edKey.icd]: { text: "R10.9 R11.2 R19.7 R42 R07.9" },
      }),
      PATIENT,
    );
    expect(chart.icd).toHaveLength(5);
    expect(chart.icdDropped.map((line) => line.code)).toEqual(["R07.9"]);
  });
});

describe("interchange text", () => {
  it("round-trips through serialize and parse", () => {
    const findings = answer(withProblems("abd_pain", "nausea_vomiting"), {
      [edKey.history("abd_site")]: { sel: "右下腹" },
      [edKey.duration]: {
        fu: { abd_pain: "CUSTOM" },
        grp: { abd_pain: "since 22:00" },
      },
      [edKey.ctx("nrs")]: { text: "6" },
      [edKey.history("nausea")]: { on: true },
      [edKey.pe("abd_tender")]: { sel: "abn", fu: { RLQ: "1" } },
    });
    const chart = composeChart(findings, PATIENT);
    const text = serializeChart(chart, { sex: "女 F", age: "72" });
    expect(text.startsWith("#ERNOTE v1\n")).toBe(true);
    const parsed = parseChartText(text);
    expect(parsed.version).toBe(1);
    expect(parsed.patient).toBe("72F");
    expect(parsed.fields.CC).toBe(chart.fields.CC);
    expect(parsed.fields.NRS).toBe("6");
    expect(parsed.fields.ABD).toBe(chart.fields.ABD);
    expect(parsed.fields.CC).toBe("RLQ abd pain since 22:00");
    expect(parsed.icd.map((entry) => entry.code)).toEqual(["R10.31", "R11.2"]);
    expect(parsed.icd[0]?.desc).toBe("Right lower quadrant pain");
  });

  it("keeps multi-line values together and ignores text before any field", () => {
    const parsed = parseChartText(
      "hello\nPI: line one\nline two\nPH: HX: DM\nICD: R50.9",
    );
    expect(parsed.fields.PI).toBe("line one\nline two");
    expect(parsed.fields.PH).toBe("HX: DM");
    expect(parsed.icd).toEqual([{ code: "R50.9", desc: "" }]);
  });
});
