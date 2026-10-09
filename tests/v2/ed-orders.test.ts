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

const yes = (id: string): Findings => ({ [edKey.history(id)]: { on: true } });

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
      "onetouch",
    ]) {
      expect(list).toContain(id);
    }
  });

  it("adds urine culture for the fever risk groups only", () => {
    const list = ids({ ...withProblems("fever"), ...yes("dysuria") }, MALE_40);
    expect(list).toContain("urine_cx");
    expect(list).toContain("bcx");
    expect(ids(withProblems("fever"), MALE_40)).not.toContain("urine_cx");
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

  it("reminds about nurse-drawn tubes and the culture specimen dialog", () => {
    const notes = planOrders(withProblems("fever", "urinary"), MALE_40).notes.join(
      "\n",
    );
    expect(notes).toContain("護理師");
    expect(notes).toContain("ORDINARY CULTURE-A");
  });

  it("every problem produces at least one suggestion or a note", () => {
    for (const problem of ED_PROBLEMS) {
      const plan = planOrders(withProblems(problem.id), FEMALE_28);
      expect(plan.suggestions.length + plan.notes.length).toBeGreaterThan(0);
    }
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
