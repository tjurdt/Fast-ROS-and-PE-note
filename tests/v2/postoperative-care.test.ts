import { describe, expect, it } from "vitest";

import {
  calculateElapsedDay,
  calculatePostoperativeDay,
} from "../../src/domain/calendar-day";
import {
  POSTOP_CYCLES,
  POSTOP_MULTI,
  PostoperativeCareSchema,
  createPostopDrain,
  createPostoperativeCare,
  cyclePostopValue,
  togglePostopMultiValue,
} from "../../src/domain/postoperative-care";

describe("postoperative care domain", () => {
  it("uses the complete option definitions extracted from legacy", () => {
    expect(Object.keys(POSTOP_CYCLES)).toHaveLength(9);
    expect(Object.keys(POSTOP_MULTI)).toHaveLength(9);
    expect(POSTOP_CYCLES.vitals?.map((option) => option.value)).toEqual([
      "穩定 Stable",
      "需留意 Concern",
      "不穩定 Unstable",
    ]);
    expect(POSTOP_MULTI.redFlags?.options).toHaveLength(9);
    expect(POSTOP_MULTI.drainCharacter?.options).toHaveLength(7);
  });

  it("creates normalized care and drain records with legacy-compatible keys", () => {
    const care = createPostoperativeCare();
    const drain = createPostopDrain({ createId: () => "drain-1" });

    expect(care).toMatchObject({
      notes: {},
      drains: [],
      surgery: "",
      surgeryDate: "",
      pain: "",
      woundFindings: [],
      redFlags: [],
      _multiV37: true,
    });
    expect(drain).toEqual({
      id: "drain-1",
      site: "",
      amount: "",
      period: "",
      patency: "",
      characterFindings: [],
      surroundFindings: [],
      note: "",
    });
    expect(PostoperativeCareSchema.parse({ pain: 8 }).pain).toBe("8");
  });

  it("cycles values through every option and back to unassessed", () => {
    let value = "";
    value = cyclePostopValue(value, "vitals");
    expect(value).toBe("穩定 Stable");
    value = cyclePostopValue(value, "vitals");
    expect(value).toBe("需留意 Concern");
    value = cyclePostopValue(value, "vitals");
    expect(value).toBe("不穩定 Unstable");
    expect(cyclePostopValue(value, "vitals")).toBe("");
  });

  it("keeps normal and abnormal multi-select values mutually exclusive", () => {
    const normal = togglePostopMultiValue([], "無 None", "nauseaSymptoms");
    expect(normal).toEqual(["無 None"]);

    const abnormal = togglePostopMultiValue(normal, "嘔吐 Vomiting", "nauseaSymptoms");
    expect(abnormal).toEqual(["嘔吐 Vomiting"]);

    const combined = togglePostopMultiValue(abnormal, "噁心 Nausea", "nauseaSymptoms");
    expect(combined).toEqual(["嘔吐 Vomiting", "噁心 Nausea"]);
    expect(togglePostopMultiValue(combined, "無 None", "nauseaSymptoms")).toEqual([
      "無 None",
    ]);
  });

  it("matches legacy POD and elapsed-day calendar calculations", () => {
    const now = new Date(2026, 8, 3, 18, 30);

    expect(calculatePostoperativeDay("2026-09-01", now)).toMatchObject({
      text: "POD 2",
      value: "POD 2",
      status: "valid",
      days: 2,
    });
    expect(calculatePostoperativeDay("2026-09-04", now).text).toBe("手術日在未來");
    expect(calculatePostoperativeDay("2026-02-30", now).text).toBe("日期錯誤");
    expect(calculateElapsedDay("2026-09-03", now).text).toBe("今天");
    expect(calculateElapsedDay("2026-09-01", now).text).toBe("距今 2 天");
  });
});
