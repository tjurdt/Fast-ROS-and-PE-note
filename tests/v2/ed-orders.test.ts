import { describe, expect, it } from "vitest";

import { parseChartText, serializeChart } from "../../src/domain/ed/chart-text";
import { composeChart, toggleProblemFinding } from "../../src/domain/ed/compose";
import {
  orderRuleProblemIds,
  planOrders,
  referencedOrderIds,
} from "../../src/domain/ed/order-rules";
import {
  ED_ORDERS,
  ED_ORDER_GROUP_LABELS,
  ED_ORDER_GROUP_ORDER,
  edOrder,
} from "../../src/domain/ed/orders";
import { ED_PROBLEMS } from "../../src/domain/ed/problems";
import { edKey } from "../../src/domain/ed/types";
import type { FindingValue } from "../../src/domain/clinical/finding";

type Findings = Record<string, FindingValue>;

const MALE_40 = { sex: "男 M", age: "40" };
const MALE_70 = { sex: "男 M", age: "70" };
const FEMALE_28 = { sex: "女 F", age: "28" };

function withProblems(...ids: string[]): Findings {
  const findings: Findings = {};
  for (const id of ids) {
    findings[edKey.problem(id)] = toggleProblemFinding(findings, id);
  }
  return findings;
}

const yes = (...ids: string[]): Findings =>
  Object.fromEntries(ids.map((id) => [edKey.history(id), { on: true }]));

function ids(findings: Findings, patient = MALE_40) {
  return planOrders(findings, patient).selected.map((order) => order.id);
}

describe("ED order catalog", () => {
  it("has unique ids and pfkeys in the ERS format", () => {
    const orderIds = ED_ORDERS.map((order) => order.id);
    const pfkeys = ED_ORDERS.map((order) => order.pfkey);
    expect(new Set(orderIds).size).toBe(orderIds.length);
    expect(new Set(pfkeys).size).toBe(pfkeys.length);
    for (const order of ED_ORDERS) {
      expect(order.pfkey).toMatch(/^[0-9A-Z]{8}$/);
      expect(order.name.trim()).not.toBe("");
      expect(order.name).not.toContain("|");
      expect(ED_ORDER_GROUP_ORDER).toContain(order.group);
      expect(ED_ORDER_GROUP_LABELS[order.group]).toBeTruthy();
    }
  });

  it("keeps the exact ERS names for the most used orders", () => {
    expect(edOrder("cbc_dc")?.pfkey).toBe("9071715F");
    expect(edOrder("cbc_dc")?.name).toBe("CBC,DC,");
    expect(edOrder("cxr_pa")?.name).toBe("CHEST PA VIEW");
    expect(edOrder("ecg")?.name).toBe("ECG(ER)");
  });

  it("only needs the specimen dialog for the culture that has no default specimen", () => {
    const withoutSpecimen = ED_ORDERS.filter((order) => !order.spcnmCode).map(
      (o) => o.id,
    );
    expect(withoutSpecimen).toEqual(["urine_cx"]);
  });
});

describe("ED order rules integrity", () => {
  it("only references orders that exist in the catalog", () => {
    const missing = referencedOrderIds().filter((id) => !edOrder(id));
    expect(missing).toEqual([]);
  });

  it("defines rules for every ED problem and nothing else", () => {
    const problems = ED_PROBLEMS.map((problem) => problem.id).sort();
    expect(orderRuleProblemIds().sort()).toEqual(problems);
  });
});

describe("planOrders", () => {
  it("suggests nothing before a problem is chosen", () => {
    const plan = planOrders({}, MALE_40);
    expect(plan.suggestions).toEqual([]);
    expect(plan.selected).toEqual([]);
  });

  it("never lists the same order twice when several problems overlap", () => {
    const findings = withProblems("fever", "cough_uri", "dyspnea", "chest_pain");
    const plan = planOrders(findings, MALE_70);
    const planned = plan.suggestions.map((entry) => entry.order.id);
    expect(new Set(planned).size).toBe(planned.length);
    expect(plan.selected.filter((order) => order.id === "flu")).toHaveLength(1);
    expect(plan.selected.filter((order) => order.id === "cbc_dc")).toHaveLength(1);
  });

  it("picks only one troponin and one chest film, and no duplicate lab panels", () => {
    const young = ids(withProblems("chest_pain", "dyspnea"), MALE_40);
    expect(young).toContain("hs_tnt");
    expect(young).not.toContain("tni");
    const old = ids(withProblems("chest_pain", "dizziness"), MALE_70);
    expect(old).toContain("tni");
    expect(old).not.toContain("hs_tnt");
    for (const list of [young, old]) {
      expect(list.filter((id) => id === "cxr_pa" || id === "cxr_port")).toHaveLength(1);
      expect(list).not.toContain("amylase");
      expect(list).not.toContain("ast");
    }
  });

  it("uses a portable film when the patient cannot stand (AMS, seizure, trauma)", () => {
    const list = ids(withProblems("ams", "fever"), MALE_70);
    expect(list).toContain("cxr_port");
    expect(list).not.toContain("cxr_pa");
  });

  it("checks pregnancy only for women of childbearing age", () => {
    expect(ids(withProblems("abd_pain"), FEMALE_28)).toContain("urine_hcg");
    expect(ids(withProblems("abd_pain"), MALE_40)).not.toContain("urine_hcg");
    expect(ids(withProblems("abd_pain"), { sex: "女 F", age: "70" })).not.toContain(
      "urine_hcg",
    );
    const gyn = ids(withProblems("gyn"), FEMALE_28);
    expect(gyn).toContain("bhcg");
    expect(gyn).not.toContain("urine_hcg");
  });

  it("leaves high-radiation or discuss-first orders unticked by default", () => {
    const plan = planOrders(withProblems("headache"), MALE_40);
    const ct = plan.suggestions.find((entry) => entry.order.id === "ct_brain");
    expect(ct?.tier).toBe("ask");
    expect(ct?.selected).toBe(false);
    expect(plan.selected.map((o) => o.id)).not.toContain("ct_brain");
  });

  it("promotes the brain CT to a standard order when red flags are present", () => {
    const findings = { ...withProblems("headache"), ...yes("headache_worst") };
    const plan = planOrders(findings, MALE_40);
    const ct = plan.suggestions.find((entry) => entry.order.id === "ct_brain");
    expect(ct?.tier).toBe("core");
    expect(ct?.selected).toBe(true);
  });

  it("orders the stroke bundle for focal neurological deficits", () => {
    const list = ids(withProblems("focal_neuro"), MALE_70);
    for (const id of [
      "ct_brain",
      "cta_head_neck",
      "pt",
      "aptt",
      "ecg",
      "tni",
      "ddimer",
    ]) {
      expect(list).toContain(id);
    }
  });

  it("adds the pocketbook's extra fever work-up only without an obvious URI focus or for high-risk patients", () => {
    const uri = ids({ ...withProblems("fever"), ...yes("cough") }, MALE_40);
    expect(uri).toEqual(expect.arrayContaining(["alt", "flu", "cxr_pa"]));
    expect(uri).not.toContain("ggt");
    expect(uri).not.toContain("urine_routine");
    const noFocus = ids(withProblems("fever"), MALE_40);
    expect(noFocus).toEqual(
      expect.arrayContaining(["ggt", "tbil", "urine_routine", "covid_ag"]),
    );
    const older = ids({ ...withProblems("fever"), ...yes("cough") }, MALE_70);
    expect(older).toEqual(expect.arrayContaining(["ggt", "tbil", "urine_routine"]));
  });

  it("respects the user's overrides, including manual extras", () => {
    const base = withProblems("fever");
    expect(ids(base)).toContain("cbc_dc");
    const off = { ...base, [edKey.order("cbc_dc")]: { on: false } };
    expect(ids(off)).not.toContain("cbc_dc");
    const extra = { ...base, [edKey.order("tsh")]: { on: true } };
    expect(ids(extra)).toContain("tsh");
    const plan = planOrders(extra, MALE_40);
    expect(plan.extras.map((entry) => entry.order.id)).not.toContain("cbc_dc");
  });

  it("keeps selected orders in screen order (labs before imaging)", () => {
    const selected = planOrders(withProblems("abd_pain"), FEMALE_28).selected;
    const groups = selected.map((order) => ED_ORDER_GROUP_ORDER.indexOf(order.group));
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
  });

  it("explains every suggestion", () => {
    const plan = planOrders(withProblems("dyspnea", "fever", "abd_pain"), MALE_70);
    for (const entry of plan.suggestions) {
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(edOrder(entry.order.id)).toBe(entry.order);
    }
  });

  it("tells the doctor what is deliberately not ordered in the first round", () => {
    const notes = planOrders(withProblems("fever", "urinary"), MALE_40).notes.join(
      "\n",
    );
    expect(notes).toContain("第一輪不預設開");
    expect(notes).toContain("護理師");
  });

  it("every problem produces at least one suggestion or a note", () => {
    for (const problem of ED_PROBLEMS) {
      const plan = planOrders(withProblems(problem.id), FEMALE_28);
      expect(plan.suggestions.length + plan.notes.length).toBeGreaterThan(0);
    }
  });
});

const FIRST_ROUND_EXCLUDED = [
  "bcx",
  "urine_cx",
  "sputum_cx",
  "c_diff",
  "stool_cx",
  "vbg",
  "sono_cardiac",
  "sono_sob",
  "sono_abd",
  "sono_dvt",
  "sono_fast",
  "sono_aortic_renal",
  "sono_pelvic",
  "sono_fb",
  // 使用者指定：不開 One touch（床邊血糖由護理師處理）。
  "onetouch",
];

describe("first-round policy (no cultures, no bedside sono, no blood gas, no One touch)", () => {
  it("no rule references an excluded order, so none can ever be suggested", () => {
    const referenced = referencedOrderIds();
    for (const id of FIRST_ROUND_EXCLUDED) expect(referenced).not.toContain(id);
  });

  it("never selects or even suggests one, for any problem and any patient", () => {
    const patients = [
      MALE_40,
      MALE_70,
      FEMALE_28,
      { sex: "女 F", age: "70" },
      { sex: "男 M", age: "8" },
    ];
    const extras = [
      {},
      yes("fever", "cough", "sputum", "dysuria", "diarrhea", "anticoag", "calf_pain"),
    ];
    for (const problem of ED_PROBLEMS) {
      for (const patient of patients) {
        for (const extra of extras) {
          const plan = planOrders({ ...withProblems(problem.id), ...extra }, patient);
          const suggested = plan.suggestions.map((entry) => entry.order.id);
          for (const id of FIRST_ROUND_EXCLUDED) expect(suggested).not.toContain(id);
        }
      }
    }
  });

  it("orders CRP with the 9068010F item, not the POCT CRP(ER)", () => {
    expect(edOrder("crp")?.pfkey).toBe("9068010F");
    expect(edOrder("crp")?.name).toBe("CRP,");
    expect(ids(withProblems("fever"))).toContain("crp");
  });

  it("still lets the doctor add them manually", () => {
    const findings = { ...withProblems("fever"), [edKey.order("bcx")]: { on: true } };
    expect(ids(findings)).toContain("bcx");
  });
});

describe("pocketbook 3-5 category first-round lists", () => {
  const BASE = ["cbc_dc", "crea", "na", "k", "glu", "crp"];
  const cases: [string, Findings, { sex: string; age: string }, string[]][] = [
    [
      "chest pain, young",
      withProblems("chest_pain"),
      MALE_40,
      [...BASE, "ck", "hs_tnt", "ecg", "cxr_pa"],
    ],
    [
      "chest pain, older",
      withProblems("chest_pain"),
      MALE_70,
      [...BASE, "ck", "tni", "ecg", "cxr_pa"],
    ],
    [
      "dyspnea",
      withProblems("dyspnea"),
      MALE_40,
      [...BASE, "bnp", "ck", "hs_tnt", "ecg", "cxr_pa"],
    ],
    [
      "abdominal pain",
      withProblems("abd_pain"),
      MALE_40,
      [...BASE, "alt", "ggt", "tbil", "lipase", "urine_routine", "cxr_pa", "kub"],
    ],
    [
      "GI bleeding",
      withProblems("gi_bleed"),
      MALE_40,
      [...BASE, "pt", "aptt", "stool_ob", "cxr_pa", "kub"],
    ],
    [
      "dizziness",
      withProblems("dizziness"),
      MALE_40,
      [...BASE, "alt", "ca", "ck", "ecg", "cxr_pa"],
    ],
    [
      "psychiatric",
      withProblems("psych"),
      MALE_40,
      [...BASE, "alt", "urine_routine", "cxr_pa", "ecg"],
    ],
  ];
  for (const [label, findings, patient, expected] of cases) {
    it(`${label}: contains the listed items and nothing questionable`, () => {
      const list = ids(findings, patient);
      expect(list).toEqual(expect.arrayContaining(expected));
      for (const id of ["pct", "lactate", "sono_abd", "bcx", "vbg", "ct_chest"]) {
        if (!expected.includes(id)) expect(list).not.toContain(id);
      }
    });
  }
});

describe("sex and age", () => {
  it("pregnancy testing follows the 12–55 female window and treats a blank age as fertile", () => {
    expect(ids(withProblems("abd_pain"), { sex: "女 F", age: "11" })).not.toContain(
      "urine_hcg",
    );
    expect(ids(withProblems("abd_pain"), { sex: "女 F", age: "12" })).toContain(
      "urine_hcg",
    );
    expect(ids(withProblems("abd_pain"), { sex: "女 F", age: "55" })).toContain(
      "urine_hcg",
    );
    expect(ids(withProblems("abd_pain"), { sex: "女 F", age: "56" })).not.toContain(
      "urine_hcg",
    );
    expect(ids(withProblems("abd_pain"), { sex: "女 F", age: "" })).toContain(
      "urine_hcg",
    );
    expect(ids(withProblems("abd_pain"), { sex: "男 M", age: "28" })).not.toContain(
      "urine_hcg",
    );
    expect(ids(withProblems("gyn"), { sex: "男 M", age: "28" })).not.toContain("bhcg");
  });

  it("a woman of childbearing age gets a pregnancy test before CT even for a headache", () => {
    const findings = { ...withProblems("headache"), ...yes("headache_worst") };
    expect(ids(findings, FEMALE_28)).toContain("urine_hcg");
    expect(ids(findings, MALE_40)).not.toContain("urine_hcg");
  });

  it("elderly or cardiac-history patients get the cardiac work-up for abdominal pain, others do not", () => {
    expect(ids(withProblems("abd_pain"), MALE_70)).toEqual(
      expect.arrayContaining(["ck", "tni"]),
    );
    expect(ids(withProblems("abd_pain"), MALE_40)).not.toContain("tni");
    const withHistory = {
      ...withProblems("abd_pain"),
      [edKey.pmh("cad")]: { on: true },
    };
    expect(ids(withHistory, MALE_40)).toEqual(expect.arrayContaining(["ck", "tni"]));
  });

  it("children never get a CT ticked by default", () => {
    const findings = { ...withProblems("headache"), ...yes("headache_worst") };
    const plan = planOrders(findings, { sex: "男 M", age: "10" });
    const ct = plan.suggestions.find((entry) => entry.order.id === "ct_brain");
    expect(ct?.tier).toBe("ask");
    expect(ct?.selected).toBe(false);
    expect(plan.notes.join("\n")).toContain("未成年");
  });

  it("warns about imaging when pregnancy is possible", () => {
    const findings = { ...withProblems("abd_pain"), ...yes("pregnancy_possible") };
    expect(planOrders(findings, FEMALE_28).notes.join("\n")).toContain("可能懷孕");
    expect(
      planOrders(withProblems("abd_pain"), FEMALE_28).notes.join("\n"),
    ).not.toContain("可能懷孕");
  });
});

describe("chart exchange text with orders", () => {
  it("puts ORDERS last and round-trips through the parser", () => {
    const findings = withProblems("chest_pain");
    const chart = composeChart(findings, MALE_70);
    const orders = planOrders(findings, MALE_70).selected;
    const text = serializeChart(chart, MALE_70, orders);
    const lines = text.split("\n");
    expect(lines.indexOf("ORDERS:")).toBeGreaterThan(
      lines.findIndex((line) => line.startsWith("ICD:")),
    );
    const parsed = parseChartText(text);
    expect(parsed.orders.map((o) => o.pfkey)).toEqual(orders.map((o) => o.pfkey));
    expect(parsed.orders[0]).toMatchObject({ freq: "URGENT" });
    expect(parsed.icd.length).toBeGreaterThan(0);
  });

  it("omits the ORDERS block when nothing is selected", () => {
    const findings = withProblems("chest_pain");
    const text = serializeChart(composeChart(findings, MALE_70), MALE_70, []);
    expect(text).not.toContain("ORDERS");
    expect(parseChartText(text).orders).toEqual([]);
  });

  it("ignores malformed or repeated order lines", () => {
    const parsed = parseChartText(
      [
        "#ERNOTE v1",
        "CC: x",
        "ORDERS:",
        "9071715F|CBC,DC,|LAB0301|Blood|URGENT",
        "9071715F|dup",
        "nonsense",
        "12|short",
      ].join("\n"),
    );
    expect(parsed.orders.map((o) => o.pfkey)).toEqual(["9071715F"]);
  });
});
