import { describe, expect, it } from "vitest";

import {
  BUILTIN_BUNDLE_TEMPLATES,
  DIALYSIS_BUNDLE_ID,
  DNR_BUNDLE_ID,
  DNR_MASTER_FIELD_ID,
  DNR_OPTIONS,
  DNR_STATES_FIELD_ID,
  LQQ_ONSETS,
  LQQ_QUALITIES,
  activateBundle,
  applyPmhAutoBundles,
  createLqqEntry,
  cycleDnrState,
  removeBundle,
  setDnrMaster,
  toggleBundleArrayValue,
  type BundleInstance,
} from "../../src/domain/bundles";

describe("bundle domain", () => {
  it("uses stable definitions extracted from the frozen legacy oracle", () => {
    expect(LQQ_QUALITIES).toHaveLength(7);
    expect(LQQ_QUALITIES).toContain("刺痛 sharp");
    expect(LQQ_ONSETS).toEqual(["突發 sudden", "漸進 gradual", "波動 fluctuating"]);
    expect(DNR_OPTIONS).toHaveLength(8);
    expect(BUILTIN_BUNDLE_TEMPLATES.map((template) => template.id)).toEqual([
      DIALYSIS_BUNDLE_ID,
      DNR_BUNDLE_ID,
    ]);
    expect(BUILTIN_BUNDLE_TEMPLATES[0]?.fields.map((field) => field.id)).toEqual([
      "f_sys_dialysis_0",
      "f_sys_dialysis_1",
      "f_sys_dialysis_2",
      "f_sys_dialysis_3",
      "f_sys_dialysis_4",
      "f_sys_dialysis_5",
    ]);
  });

  it("creates a legacy-compatible LQQOPERA entry", () => {
    expect(createLqqEntry({ createId: () => "lqq-1" })).toEqual({
      id: "lqq-1",
      name: "",
      L: "",
      quality: [],
      qnote: "",
      sev: null,
      onset: "",
      onsetText: "",
      P: "",
      E: "",
      R: "",
      A: "",
    });
  });

  it("activates DNR with the legacy default states and cycles each decision", () => {
    const active = activateBundle({}, DNR_BUNDLE_ID);
    const instance = active[DNR_BUNDLE_ID];
    expect(instance).toBeDefined();

    const enabled = setDnrMaster(instance as BundleInstance, true);
    expect(enabled[DNR_MASTER_FIELD_ID]).toBe(true);
    expect(Object.values(enabled[DNR_STATES_FIELD_ID] as object)).toEqual(
      DNR_OPTIONS.map(() => "agree"),
    );

    const disagreed = cycleDnrState(enabled, DNR_OPTIONS[0] ?? "");
    expect(
      (disagreed[DNR_STATES_FIELD_ID] as Record<string, string>)[DNR_OPTIONS[0] ?? ""],
    ).toBe("disagree");
    const cleared = cycleDnrState(disagreed, DNR_OPTIONS[0] ?? "");
    expect(
      (cleared[DNR_STATES_FIELD_ID] as Record<string, string>)[DNR_OPTIONS[0] ?? ""],
    ).toBe("");
  });

  it("sorts dialysis days in W1-W7 order", () => {
    const fieldId = "f_sys_dialysis_1";
    const friday = toggleBundleArrayValue(
      { __notes: {}, __setNote: "" },
      fieldId,
      "W5",
      ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
    );
    const monday = toggleBundleArrayValue(friday, fieldId, "W1", [
      "W1",
      "W2",
      "W3",
      "W4",
      "W5",
      "W6",
      "W7",
    ]);

    expect(monday[fieldId]).toEqual(["W1", "W5"]);
  });

  it("auto-adds dialysis once and does not re-add it after removal", () => {
    const first = applyPmhAutoBundles({}, {}, [{ text: "ESRD on regular HD" }]);

    expect(first.addedIds).toEqual([DIALYSIS_BUNDLE_ID]);
    expect(first.instances[DIALYSIS_BUNDLE_ID]).toBeDefined();
    expect(first.triggered[DIALYSIS_BUNDLE_ID]).toBe(true);

    const afterRemoval = applyPmhAutoBundles(
      removeBundle(first.instances, DIALYSIS_BUNDLE_ID),
      first.triggered,
      [{ text: "ESRD on regular HD" }],
    );
    expect(afterRemoval.addedIds).toEqual([]);
    expect(afterRemoval.instances[DIALYSIS_BUNDLE_ID]).toBeUndefined();
  });
});
