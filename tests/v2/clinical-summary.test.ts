import { describe, expect, it } from "vitest";

import type { UserBundleTemplate } from "../../src/domain/bundle-templates";
import { buildClinicalSummary } from "../../src/domain/clinical-summary/build";
import { clinicalItemSummaryLine } from "../../src/domain/clinical-summary/findings";
import {
  clinicalSummaryFilename,
  renderClinicalSummaryText,
} from "../../src/domain/clinical-summary/text";
import { clinicalItemIndex } from "../../src/domain/clinical/catalog";
import type { FindingValue } from "../../src/domain/clinical/finding";
import { createPatient, PatientSchema, type Patient } from "../../src/domain/patient";

const NOW = new Date(2026, 8, 4, 10, 5);

function patientFixture(specialty = "general"): Patient {
  return createPatient(
    {
      code: "EXPORT-01",
      specialty,
      sex: "女 F",
      age: "72",
      problem: "Pneumonia",
    },
    { createId: () => "patient-1", now: () => 100 },
  );
}

function sectionText(patient: Patient, mode: "limited" | "full"): string {
  return renderClinicalSummaryText(
    buildClinicalSummary(patient, [], { mode, now: NOW }),
  );
}

describe("clinical summary", () => {
  it("keeps focus, abnormal findings, notes, and always-on sections in limited mode", () => {
    const patient = PatientSchema.parse({
      ...patientFixture("cms"),
      findings: {
        cough: { on: true },
        rash: { on: true, note: "new eruption" },
      },
      blockNotes: { ros_gi: "腹部症狀需持續追蹤" },
    });

    const limited = sectionText(patient, "limited");
    const full = sectionText(patient, "full");

    expect(limited).toContain("★ Focus ROS");
    expect(limited).toContain("Cough（咳嗽）");
    expect(limited).toContain("Rash（皮疹）");
    expect(limited).toContain("new eruption");
    expect(limited).toContain("腹部症狀需持續追蹤");
    expect(limited).toContain("Constitutional（一般全身） · ROS");
    expect(limited).not.toContain("Pruritus（搔癢）");
    expect(full).toContain("Pruritus（搔癢）");
  });

  it("renders postoperative, infection, chemotherapy, LQQ, and dialysis values", () => {
    const patient = PatientSchema.parse({
      ...patientFixture(),
      lqq: [
        {
          id: "lqq-1",
          name: "胸痛",
          quality: ["壓迫 pressure"],
          sev: 8,
          onset: "突發 sudden",
        },
      ],
      postop: {
        surgery: "Laparoscopic colectomy",
        surgeryDate: "2026-09-02",
        pain: "8",
        vitals: "需留意 Concern",
        drains: [
          {
            id: "drain-1",
            site: "JP, RUQ",
            amount: "120",
            period: "24 h",
            patency: "疑阻塞 Blocked?",
            characterFindings: ["膿性 Purulent"],
            surroundFindings: ["滲漏"],
            note: "持續觀察",
          },
        ],
      },
      infections: [
        {
          id: "infection-1",
          name: "肺炎",
          temperature: "38.2",
          sources: ["肺部 Pulmonary"],
          qsofa: { sbp: "yes", rr: "yes", mentation: "no" },
          curb65: {
            confusion: "no",
            urea: "no",
            rr: "no",
            bp: "no",
            age: "yes",
          },
          antibiotics: [
            {
              id: "antibiotic-1",
              drug: "Cefepime",
              startDate: "2026-09-02",
              route: "IV 靜脈",
              note: "2 g q8h",
            },
          ],
        },
      ],
      chemo: {
        regimen: "FOLFOX C3",
        chemoDate: "2026-09-02",
        temperature: "38",
        nauseaSymptoms: ["嘔吐 Vomiting"],
        neuropathyStatus: "有異常 Present",
        neuropathyMatrix: { numbness: ["LH", "RH"] },
        flags: ["呼吸困難/胸痛"],
      },
      customSets: {
        sys_dialysis: {
          f_sys_dialysis_0: "血液透析 HD",
          f_sys_dialysis_1: ["W1", "W3"],
          f_sys_dialysis_4: "2026-09-03",
        },
      },
    });

    const text = sectionText(patient, "limited");

    expect(text).toContain("症狀分析 LQQOPERA · 胸痛");
    expect(text).toContain("Q 嚴重度：8 /10");
    expect(text).toContain("手術日期 / POD：2026-09-02 · POD 2");
    expect(text).toContain("Drain 1：JP, RUQ｜120 mL / 24 h｜膿性 Purulent");
    expect(text).toContain("qSOFA：2/3");
    expect(text).toContain("Cefepime · 2026-09-02 · Day 3 · IV 靜脈");
    expect(text).toContain("FOLFOX C3");
    expect(text).toContain("D+2");
    expect(text).toContain("麻木 Numbness：左手、右手");
    expect(text).toContain("最後透析日：2026-09-03 · 距今 1 天");
    expect(text).not.toContain("[object Object]");
  });

  it("serializes structured neurological and scored clinical findings", () => {
    const line = (itemId: string, finding: FindingValue) => {
      const item = clinicalItemIndex.get(itemId)?.item;
      if (!item) throw new Error(`Missing clinical item ${itemId}.`);
      return clinicalItemSummaryLine(item, finding);
    };

    expect(line("fever", { on: true, fu: { fever_t: "38.5°C" } })).toMatchObject({
      positive: true,
      value: expect.stringContaining("38.5°C"),
    });
    expect(line("gcs", { grp: { E: "3", V: "5", M: "6" } })).toMatchObject({
      positive: true,
      value: expect.stringContaining("(14)"),
    });
    expect(line("pe_dtr", { dtr: { biceps_L: "3+", biceps_R: "2+" } })).toEqual(
      expect.objectContaining({
        positive: true,
        value: expect.stringContaining("L3+/R2+"),
      }),
    );
    expect(
      line("pe_plantar", { plantar: { L: "伸直↑ Babinski(+)", R: "屈曲↓ (正常)" } }),
    ).toMatchObject({ positive: true, value: expect.stringContaining("Babinski(+)") });
    expect(
      line("pe_sensory", {
        sensory: {
          status: "異常 Abnormal",
          findings: [
            {
              id: "sensory-1",
              side: "左下肢 LLE",
              change: "感覺減退 Hypoesthesia",
              modalities: ["輕觸 Light touch"],
              pattern: "皮節 Dermatomal",
              location: "L4",
              note: "distal",
            },
          ],
        },
      }),
    ).toMatchObject({ positive: true, value: expect.stringContaining("L4") });
    expect(
      line("pe_cn", {
        sel: "大致正常 Intact",
        cn: {
          cn1: {
            abn: true,
            grid: { anosmia_L: true },
            mono: [],
            note: "左側嗅覺下降",
          },
        },
      }),
    ).toMatchObject({ positive: true, value: expect.stringContaining("左側嗅覺下降") });
  });

  it("serializes every custom template field type through one stable adapter", () => {
    const template: UserBundleTemplate = {
      id: "custom-all-types",
      name: "全部欄位",
      archived: false,
      fields: [
        { id: "toggle", type: "toggle", label: "是非", options: [], archived: false },
        {
          id: "select",
          type: "select",
          label: "單選",
          options: ["A", "B"],
          archived: false,
        },
        {
          id: "multi",
          type: "multi",
          label: "多選",
          options: ["甲", "乙"],
          archived: false,
        },
        {
          id: "chips",
          type: "chips",
          label: "複選",
          options: ["左", "右"],
          archived: false,
        },
        { id: "days", type: "days", label: "星期", options: [], archived: false },
        { id: "text", type: "text", label: "文字", options: [], archived: false },
        { id: "date", type: "date", label: "日期", options: [], archived: false },
      ],
    };
    const patient = PatientSchema.parse({
      ...patientFixture(),
      customSets: {
        "custom-all-types": {
          toggle: true,
          select: "B",
          multi: ["甲", "乙"],
          chips: ["右"],
          days: ["W2", "W4"],
          text: "自由文字",
          date: "2026-09-04",
          __notes: { text: "文字備註" },
        },
      },
    });

    const text = renderClinicalSummaryText(
      buildClinicalSummary(patient, [template], { mode: "limited", now: NOW }),
    );

    expect(text).toContain("是非：(+) 是");
    expect(text).toContain("單選：B");
    expect(text).toContain("多選：甲、乙");
    expect(text).toContain("複選：右");
    expect(text).toContain("星期：W2、W4");
    expect(text).toContain("文字：自由文字　※文字備註");
    expect(text).toContain("日期：2026-09-04");
  });

  it("retains active archived templates and archived fields that contain patient data", () => {
    const templates: UserBundleTemplate[] = [
      {
        id: "custom-wound",
        name: "傷口換藥",
        archived: true,
        fields: [
          {
            id: "field-present",
            type: "select",
            label: "滲液量",
            options: ["少量", "大量"],
            archived: true,
          },
          {
            id: "field-empty",
            type: "text",
            label: "未使用欄位",
            options: [],
            archived: true,
          },
        ],
      },
    ];
    const patient = PatientSchema.parse({
      ...patientFixture(),
      customSets: {
        "custom-wound": {
          "field-present": "大量",
          __setNote: "每日評估",
        },
      },
    });

    const text = renderClinicalSummaryText(
      buildClinicalSummary(patient, templates, { mode: "limited", now: NOW }),
    );

    expect(text).toContain("組套 · 傷口換藥（已封存範本）");
    expect(text).toContain("滲液量（已封存欄位）：大量");
    expect(text).toContain("§ 區塊備註：每日評估");
    expect(text).not.toContain("未使用欄位");
  });

  it("includes workspace content in deterministic order without mutating the patient", () => {
    const original = PatientSchema.parse({
      ...patientFixture(),
      globalNote: "家屬已知情",
      admission: {
        habits: ["菸 Smoking"],
        drugAllergy: true,
        drugAllergyNote: "Penicillin rash",
      },
      adl: {
        level: "Partially dependent 部分依賴",
        family: true,
        famName: "女兒",
      },
      pmh: [{ id: "pmh-1", text: "高血壓 Hypertension" }],
      todos: [
        {
          id: "todo-2",
          text: "一般待辦",
          status: "todo",
          important: false,
          createdAt: 200,
        },
        {
          id: "todo-1",
          text: "優先追蹤",
          status: "todo",
          important: true,
          createdAt: 300,
        },
      ],
    });
    const snapshot = structuredClone(original);

    const document = buildClinicalSummary(original, [], {
      mode: "limited",
      now: NOW,
    });
    const text = renderClinicalSummaryText(document);

    expect(document.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "admission-history-adl",
        "past-medical-history",
        "additional-notes",
        "todo-list",
      ]),
    );
    expect(text).toContain("藥物過敏：有");
    expect(text).toContain("Penicillin rash");
    expect(text).toContain("家人 Family（女兒）");
    expect(text).toContain("高血壓 Hypertension");
    expect(text).toContain("家屬已知情");
    expect(text.indexOf("優先追蹤")).toBeLessThan(text.indexOf("一般待辦"));
    expect(original).toEqual(snapshot);
  });

  it("renders a stable header, disclaimer, and filesystem-safe filename", () => {
    const patient = PatientSchema.parse({
      ...patientFixture(),
      code: "A/01 : ward",
    });
    const document = buildClinicalSummary(patient, [], {
      mode: "full",
      now: NOW,
    });
    const text = renderClinicalSummaryText(document);

    expect(text).toContain("病人代號：A/01 : ward");
    expect(text).toContain("基本資料：女 F · 72 歲");
    expect(text).toContain("匯出時間：2026/09/04 10:05");
    expect(text).toContain("（完整版：全部項目）");
    expect(text).toMatch(/※ 本紀錄為臨床輔助草稿/);
    expect(clinicalSummaryFilename(document)).toBe(
      "ROS_PE_A_01_ward_202609041005_full.txt",
    );
  });
});
