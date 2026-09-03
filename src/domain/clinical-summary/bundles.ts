import {
  BUILTIN_BUNDLE_TEMPLATES,
  DIALYSIS_BUNDLE_ID,
  DNR_BUNDLE_ID,
  DNR_MASTER_FIELD_ID,
  DNR_OPTIONS,
  dnrStateMap,
  type RenderableBundleField,
  type RenderableBundleTemplate,
} from "../bundles";
import type { UserBundleTemplate } from "../bundle-templates";
import {
  calculateChemotherapyDay,
  chemotherapyHasNeuropathy,
  CHEMO_MULTI,
  NEUROPATHY_ROWS,
  NEUROPATHY_SITES,
} from "../chemotherapy-followup";
import {
  calculateAntibioticDay,
  infectionScoreAdvice,
  infectionScoreInfo,
} from "../infection-workup";
import type { Patient } from "../patient";
import { calculateElapsedDay, calculatePostoperativeDay } from "../calendar-day";
import {
  summaryLine,
  type ClinicalSummaryLine,
  type ClinicalSummarySection,
} from "./model";

function joinMulti(values: readonly string[]): string {
  return values.filter(Boolean).join("、");
}

function hasAbnormal(values: readonly string[], normal: string): boolean {
  return values.some((value) => value !== normal);
}

function addPopulatedLine(
  lines: ClinicalSummaryLine[],
  label: string,
  value: unknown,
  positive = false,
  note = "",
): void {
  const normalized = String(value ?? "").trim();
  if (!normalized && !note.trim()) return;
  lines.push(summaryLine(label, normalized, positive, note));
}

function buildLqqSections(patient: Patient): ClinicalSummarySection[] {
  return patient.lqq.flatMap((entry) => {
    const lines: ClinicalSummaryLine[] = [];
    addPopulatedLine(lines, "L 位置", entry.L);
    addPopulatedLine(
      lines,
      "Q 性質",
      [...entry.quality, entry.qnote.trim()].filter(Boolean).join("、"),
    );
    if (entry.sev !== null) {
      lines.push(summaryLine("Q 嚴重度", `${entry.sev} /10`, entry.sev >= 7));
    }
    addPopulatedLine(
      lines,
      "O 發作",
      [entry.onset, entry.onsetText.trim()].filter(Boolean).join(" "),
    );
    addPopulatedLine(lines, "P 誘發/加重", entry.P);
    addPopulatedLine(lines, "E 緩解", entry.E);
    addPopulatedLine(lines, "R 放射", entry.R);
    addPopulatedLine(lines, "A 伴隨症狀", entry.A);
    if (lines.length === 0 && !entry.name.trim()) return [];
    return [
      {
        id: `lqq-${entry.id}`,
        title: `症狀分析 LQQOPERA · ${entry.name.trim() || "（未命名）"}`,
        note: "",
        lines,
      },
    ];
  });
}

function buildPostoperativeSection(
  patient: Patient,
  now: Date,
): ClinicalSummarySection | null {
  const postoperative = patient.postop;
  if (!postoperative) return null;
  const lines: ClinicalSummaryLine[] = [];
  const note = (key: string) => postoperative.notes[key] ?? "";
  const add = (key: string, label: string, value: unknown, positive = false) =>
    addPopulatedLine(lines, label, value, positive, note(key));

  add("surgery", "手術種類 / Procedure", postoperative.surgery);
  add(
    "surgeryDate",
    "手術日期 / POD",
    [
      postoperative.surgeryDate,
      calculatePostoperativeDay(postoperative.surgeryDate, now).value,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  add(
    "pain",
    "疼痛 0–10",
    postoperative.pain ? `${postoperative.pain} /10` : "",
    Number(postoperative.pain) >= 7,
  );
  add(
    "vitals",
    "生命徵象 / 循環",
    postoperative.vitals,
    Boolean(postoperative.vitals && postoperative.vitals !== "穩定 Stable"),
  );
  add("fever", "發燒", postoperative.fever, postoperative.fever === "有 Febrile");
  add("oralDiet", "口服飲食", postoperative.oralDiet);
  add(
    "nutritionSupport",
    "營養支持",
    joinMulti(postoperative.nutritionSupport),
    hasAbnormal(postoperative.nutritionSupport, "無額外支持 None"),
  );
  add(
    "nauseaSymptoms",
    "噁心 / 嘔吐",
    joinMulti(postoperative.nauseaSymptoms),
    hasAbnormal(postoperative.nauseaSymptoms, "無 None"),
  );
  add(
    "activity",
    "下床活動",
    postoperative.activity,
    postoperative.activity === "臥床 Bed rest",
  );
  add("flatus", "排氣", postoperative.flatus, postoperative.flatus === "未排 No");
  add("voidingMethod", "排尿方式", postoperative.voidingMethod);
  add(
    "urinaryConcerns",
    "排尿異常",
    joinMulti(postoperative.urinaryConcerns),
    hasAbnormal(postoperative.urinaryConcerns, "無異常 None"),
  );
  add(
    "respiratorySupport",
    "呼吸支持",
    postoperative.respiratorySupport,
    Boolean(
      postoperative.respiratorySupport &&
      postoperative.respiratorySupport !== "RA 室內空氣",
    ),
  );
  add(
    "respiratoryConcerns",
    "呼吸問題",
    joinMulti(postoperative.respiratoryConcerns),
    hasAbnormal(postoperative.respiratoryConcerns, "無異常 None"),
  );
  add(
    "woundFindings",
    "傷口",
    joinMulti(postoperative.woundFindings),
    hasAbnormal(postoperative.woundFindings, "乾淨乾燥完整 CDI"),
  );
  add(
    "vteMeasures",
    "VTE 預防",
    joinMulti(postoperative.vteMeasures),
    postoperative.vteMeasures.includes("未執行 None"),
  );
  add(
    "redFlags",
    "術後警訊",
    joinMulti(postoperative.redFlags),
    hasAbnormal(postoperative.redFlags, "無明顯警訊 None"),
  );
  add("plan", "今日計畫 / Plan", postoperative.plan);

  postoperative.drains.forEach((drain, index) => {
    const values = [
      drain.site,
      drain.amount
        ? `${drain.amount} mL${drain.period ? ` / ${drain.period}` : ""}`
        : "",
      joinMulti(drain.characterFindings),
      drain.patency,
      joinMulti(drain.surroundFindings),
    ].filter(Boolean);
    if (values.length === 0 && !drain.note.trim()) return;
    lines.push(
      summaryLine(
        `Drain ${index + 1}`,
        values.join("｜"),
        drain.characterFindings.some((value) => /血性|膽汁|膿性|乳糜/.test(value)) ||
          drain.patency === "疑阻塞 Blocked?" ||
          hasAbnormal(drain.surroundFindings, "周圍乾淨"),
        drain.note,
      ),
    );
  });

  return {
    id: "postoperative-care",
    title: "外科術後照護 Postoperative care",
    note: "",
    lines,
  };
}

function neuropathyText(patient: Patient): string {
  const followup = patient.chemo;
  if (!followup) return "";
  const siteLabels = new Map(NEUROPATHY_SITES.map((site) => [site.key, site.label]));
  return NEUROPATHY_ROWS.flatMap((row) => {
    const sites = (followup.neuropathyMatrix[row.key] ?? [])
      .map((site) => siteLabels.get(site))
      .filter((site): site is string => Boolean(site));
    return sites.length > 0 ? [`${row.label}：${sites.join("、")}`] : [];
  }).join("；");
}

function buildChemotherapySection(
  patient: Patient,
  now: Date,
): ClinicalSummarySection | null {
  const followup = patient.chemo;
  if (!followup) return null;
  const lines: ClinicalSummaryLine[] = [];
  const note = (key: string) => followup.notes[key] ?? "";
  const add = (key: string, label: string, value: unknown, positive = false) =>
    addPopulatedLine(lines, label, value, positive, note(key));

  add("regimen", "化療／標靶療程", followup.regimen);
  add(
    "chemoDate",
    "最近治療日期 / Day",
    [followup.chemoDate, calculateChemotherapyDay(followup.chemoDate, now).value]
      .filter(Boolean)
      .join(" · "),
  );
  add(
    "temperature",
    "體溫",
    followup.temperature ? `${followup.temperature} °C` : "",
    Number(followup.temperature) >= 38,
  );
  add(
    "nauseaSymptoms",
    "噁心 / 嘔吐",
    joinMulti(followup.nauseaSymptoms),
    hasAbnormal(followup.nauseaSymptoms, "無 None"),
  );
  add(
    "giImpact",
    "腸胃症狀對進食影響",
    followup.giImpact,
    Boolean(followup.giImpact && followup.giImpact !== "不影響進食 Mild"),
  );
  add(
    "oralSymptoms",
    "口腔症狀",
    joinMulti(followup.oralSymptoms),
    hasAbnormal(followup.oralSymptoms, "無明顯症狀 None"),
  );
  add(
    "intakeImpact",
    "進食程度",
    followup.intakeImpact,
    Boolean(followup.intakeImpact && followup.intakeImpact !== "正常攝取 Normal"),
  );
  add(
    "bowelSymptoms",
    "排便 / 腹部",
    joinMulti(followup.bowelSymptoms),
    hasAbnormal(followup.bowelSymptoms, "正常 None"),
  );
  add(
    "fatigue",
    "疲倦 / 活動",
    followup.fatigue,
    Boolean(followup.fatigue && followup.fatigue !== "基準狀態 Baseline"),
  );
  const neuropathy = [followup.neuropathyStatus, neuropathyText(patient)]
    .filter(Boolean)
    .join("｜");
  add(
    "neuropathySymptoms",
    "周邊神經四肢矩陣",
    neuropathy,
    followup.neuropathyStatus === "有異常 Present" ||
      chemotherapyHasNeuropathy(followup),
  );
  for (const [key, label] of [
    ["skinFindings", "皮膚 / 管路"],
    ["infectionSigns", "感染徵象"],
    ["bleedingSigns", "出血徵象"],
  ] as const) {
    const definition = CHEMO_MULTI[key];
    add(
      key,
      label,
      joinMulti(followup[key]),
      Boolean(definition?.normal && hasAbnormal(followup[key], definition.normal)),
    );
  }
  add("labs", "CBC / ANC", followup.labs);
  add("flags", "需立即注意", joinMulti(followup.flags), followup.flags.length > 0);
  add("plan", "處置 / Plan", followup.plan);

  return {
    id: "chemotherapy-followup",
    title: "化療／標靶治療副作用 Chemo/targeted therapy follow-up",
    note: "",
    lines,
  };
}

function buildInfectionSections(patient: Patient, now: Date): ClinicalSummarySection[] {
  return patient.infections.map((infection, index) => {
    const qsofa = infectionScoreInfo("qsofa", infection.qsofa);
    const qsofaAdvice = infectionScoreAdvice("qsofa", infection.qsofa);
    const curb65 = infectionScoreInfo("curb65", infection.curb65);
    const curb65Advice = infectionScoreAdvice("curb65", infection.curb65);
    const lines = [
      summaryLine(
        "qSOFA",
        `${qsofa.score}/3${qsofa.complete ? "" : "（未完成）"}｜${qsofaAdvice.text}`,
        qsofa.complete && qsofa.score >= 2,
      ),
    ];
    if (infection.temperature) {
      const value = Number(infection.temperature);
      lines.push(
        summaryLine(
          "體溫",
          `${infection.temperature} °C`,
          !Number.isNaN(value) && (value >= 38 || value < 36),
        ),
      );
    }
    if (infection.sources.length > 0) {
      lines.push(summaryLine("感染源評估", joinMulti(infection.sources), true));
    }
    if (infection.cultures.length > 0) {
      lines.push(summaryLine("已送培養", joinMulti(infection.cultures)));
    }
    lines.push(
      summaryLine(
        "CURB-65",
        `${curb65.score}/5${curb65.complete ? "" : "（未完成）"}｜${curb65Advice.text}`,
        curb65.complete && curb65.score >= 2,
      ),
    );
    infection.antibiotics.forEach((antibiotic, antibioticIndex) => {
      const day = calculateAntibioticDay(antibiotic.startDate, now);
      const values = [
        antibiotic.drug,
        antibiotic.startDate,
        day.value,
        antibiotic.route,
      ].filter(Boolean);
      if (values.length === 0 && !antibiotic.note.trim()) return;
      lines.push(
        summaryLine(
          `抗生素 ${antibioticIndex + 1}`,
          values.join(" · "),
          true,
          antibiotic.note,
        ),
      );
    });
    return {
      id: `infection-${infection.id}`,
      title: `感染／敗血症 Sepsis workup · ${infection.name.trim() || `#${index + 1}`}`,
      note: infection.note.trim(),
      lines,
    };
  });
}

function hasStoredValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function templateFieldLine(
  template: RenderableBundleTemplate,
  field: RenderableBundleField,
  data: Record<string, unknown>,
  now: Date,
): ClinicalSummaryLine | null {
  const notes = data.__notes as Record<string, string> | undefined;
  const note = notes?.[field.id]?.trim() ?? "";
  const rawValue = data[field.id];
  if (field.archived && !hasStoredValue(rawValue) && !note) return null;

  let value = "";
  let positive = false;
  if (field.type === "toggle") {
    positive = rawValue === true;
    value =
      template.id === DNR_BUNDLE_ID
        ? positive
          ? "有 DNR"
          : "無 DNR"
        : positive
          ? "(+) 是"
          : "(−) 否";
  } else if (field.type === "dnrstates") {
    const states = dnrStateMap(rawValue, data[DNR_MASTER_FIELD_ID] === true);
    value = DNR_OPTIONS.map((option) => {
      const state = states[option];
      return `${option}：${state === "agree" ? "同意" : state === "disagree" ? "未同意" : "—"}`;
    }).join("；");
    positive = Object.values(states).some(Boolean);
  } else if (
    field.type === "multi" ||
    field.type === "days" ||
    field.type === "chips"
  ) {
    const values = Array.isArray(rawValue)
      ? rawValue.filter((item): item is string => typeof item === "string")
      : [];
    value = joinMulti(values) || "—";
    positive = values.length > 0;
  } else if (field.type === "select") {
    value = typeof rawValue === "string" && rawValue ? rawValue : "未選擇";
    positive = Boolean(rawValue);
  } else {
    const text = String(rawValue ?? "").trim();
    value = text || "—";
    positive = Boolean(text);
    if (field.type === "date" && template.id === DIALYSIS_BUNDLE_ID && text) {
      value = [text, calculateElapsedDay(text, now).value].filter(Boolean).join(" · ");
    }
  }
  return summaryLine(
    `${field.label || "（欄位）"}${field.archived ? "（已封存欄位）" : ""}`,
    value,
    positive || Boolean(note),
    note,
  );
}

function buildTemplateSections(
  patient: Patient,
  userTemplates: readonly UserBundleTemplate[],
  now: Date,
): ClinicalSummarySection[] {
  const builtinIds = new Set(BUILTIN_BUNDLE_TEMPLATES.map((template) => template.id));
  const templates: RenderableBundleTemplate[] = [
    ...BUILTIN_BUNDLE_TEMPLATES,
    ...userTemplates.filter((template) => !builtinIds.has(template.id)),
  ];
  return templates.flatMap((template) => {
    const instance = patient.customSets[template.id];
    if (!instance) return [];
    const data = instance as Record<string, unknown>;
    const lines = template.fields.flatMap((field) => {
      const line = templateFieldLine(template, field, data, now);
      return line ? [line] : [];
    });
    return [
      {
        id: `bundle-${template.id}`,
        title: `組套 · ${template.name || "自訂組套"}${template.archived ? "（已封存範本）" : ""}`,
        note: instance.__setNote.trim(),
        lines,
      },
    ];
  });
}

export function buildBundleSummarySections(
  patient: Patient,
  userTemplates: readonly UserBundleTemplate[],
  now: Date,
): ClinicalSummarySection[] {
  const sections = buildLqqSections(patient);
  const postoperative = buildPostoperativeSection(patient, now);
  if (postoperative) sections.push(postoperative);
  const chemotherapy = buildChemotherapySection(patient, now);
  if (chemotherapy) sections.push(chemotherapy);
  sections.push(...buildInfectionSections(patient, now));
  sections.push(...buildTemplateSections(patient, userTemplates, now));
  return sections;
}
