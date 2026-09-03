import { describe, expect, it } from "vitest";

import {
  UserBundleTemplateValidationError,
  UserBundleTemplatesFieldSchema,
  createUserBundleField,
  createUserBundleTemplate,
  moveUserBundleField,
  normalizeUserBundleTemplate,
  saveUserBundleTemplate,
  setUserBundleFieldArchived,
  setUserBundleTemplateArchived,
  userBundleTemplateIssues,
} from "../../src/domain/bundle-templates";
import { activateTemplateBundle } from "../../src/domain/bundles";

describe("user bundle templates", () => {
  it("loads legacy-shaped templates with additive archive defaults", () => {
    const templates = UserBundleTemplatesFieldSchema.parse([
      {
        id: "cs-wound",
        name: "傷口換藥",
        fields: [
          {
            id: "field-drainage",
            type: "select",
            label: "滲液量",
            options: ["少量", "大量"],
            futureFieldProperty: "preserved",
          },
        ],
        futureTemplateProperty: "preserved",
      },
    ]);

    expect(templates[0]).toMatchObject({
      id: "cs-wound",
      archived: false,
      futureTemplateProperty: "preserved",
    });
    expect(templates[0]?.fields[0]).toMatchObject({
      archived: false,
      futureFieldProperty: "preserved",
    });
  });

  it("creates stable template and field identities", () => {
    const ids = ["template-1", "field-1"];
    const createId = () => ids.shift() ?? "unexpected";
    const template = createUserBundleTemplate({ createId });
    const field = createUserBundleField({ createId });

    expect(template).toEqual({
      id: "template-1",
      name: "",
      fields: [],
      archived: false,
    });
    expect(field).toEqual({
      id: "field-1",
      type: "toggle",
      label: "",
      options: [],
      archived: false,
    });
  });

  it("validates required names and selectable options", () => {
    const draft = {
      ...createUserBundleTemplate({ createId: () => "template-1" }),
      fields: [
        {
          ...createUserBundleField({ createId: () => "field-1" }),
          type: "select" as const,
        },
      ],
    };

    expect(userBundleTemplateIssues(draft)).toEqual([
      "請輸入組套名稱",
      "請輸入欄位 1 的名稱",
      "欄位 1 至少需要一個選項",
    ]);
    expect(() => saveUserBundleTemplate([], draft)).toThrow(
      UserBundleTemplateValidationError,
    );
    expect(
      userBundleTemplateIssues({ ...draft, id: "sys_dialysis", name: "衝突" }),
    ).toContain("組套識別碼與內建組套重複");
  });

  it("normalizes labels and deduplicates options without changing IDs", () => {
    const template = createUserBundleTemplate({ createId: () => "template-1" });
    const field = createUserBundleField({ createId: () => "field-1" });
    const normalized = normalizeUserBundleTemplate({
      ...template,
      name: "  傷口換藥  ",
      fields: [
        {
          ...field,
          label: "  滲液量  ",
          type: "select",
          options: [" 少量 ", "", "少量", "大量"],
        },
      ],
    });

    expect(normalized).toMatchObject({ id: "template-1", name: "傷口換藥" });
    expect(normalized.fields[0]).toMatchObject({
      id: "field-1",
      label: "滲液量",
      options: ["少量", "大量"],
    });
  });

  it("reorders active fields while retaining archived definitions", () => {
    const template = {
      ...createUserBundleTemplate({ createId: () => "template-1" }),
      name: "傷口換藥",
      fields: [
        {
          ...createUserBundleField({ createId: () => "field-1" }),
          label: "一",
        },
        {
          ...createUserBundleField({ createId: () => "field-old" }),
          label: "舊欄位",
          archived: true,
        },
        {
          ...createUserBundleField({ createId: () => "field-2" }),
          label: "二",
        },
      ],
    };
    const moved = moveUserBundleField(template, "field-2", -1);

    expect(moved.fields.map((field) => field.id)).toEqual([
      "field-2",
      "field-old",
      "field-1",
    ]);
    const restored = setUserBundleFieldArchived(moved, "field-old", false);
    expect(restored.fields.find((field) => field.id === "field-old")?.archived).toBe(
      false,
    );
  });

  it("archives templates recoverably and blocks new activation while archived", () => {
    const template = {
      ...createUserBundleTemplate({ createId: () => "template-1" }),
      name: "疼痛評估",
    };
    const saved = saveUserBundleTemplate([], template);
    expect(activateTemplateBundle({}, saved, "template-1")).toHaveProperty(
      "template-1",
    );

    const archived = setUserBundleTemplateArchived(saved, "template-1", true);
    expect(archived[0]?.archived).toBe(true);
    expect(() => activateTemplateBundle({}, archived, "template-1")).toThrow(
      /unavailable/,
    );
    expect(
      setUserBundleTemplateArchived(archived, "template-1", false)[0]?.archived,
    ).toBe(false);
  });
});
