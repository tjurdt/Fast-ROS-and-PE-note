import { z } from "zod";

import { calculateElapsedDay, type CalendarDayResult } from "./calendar-day";
import { clinicalCatalog } from "./clinical/catalog";

export const INFECTION_MULTI = clinicalCatalog.bundles.infection.multi;
export const QSOFA_CRITERIA = clinicalCatalog.bundles.infection.qsofaCriteria;
export const CURB65_CRITERIA = clinicalCatalog.bundles.infection.curb65Criteria;
export const SCORE_STATES = clinicalCatalog.bundles.infection.scoreStates;
export const DEFAULT_ANTIBIOTICS = clinicalCatalog.bundles.infection.defaultAntibiotics;
export const ANTIBIOTIC_ROUTES = clinicalCatalog.bundles.infection.antibioticRoutes;

export const ScoreStateSchema = z.enum(["", "no", "yes"]);

const QsofaScoreSchema = z
  .object({
    open: z.boolean().default(false),
    sbp: ScoreStateSchema.default(""),
    rr: ScoreStateSchema.default(""),
    mentation: ScoreStateSchema.default(""),
  })
  .passthrough();

const Curb65ScoreSchema = z
  .object({
    open: z.boolean().default(false),
    confusion: ScoreStateSchema.default(""),
    urea: ScoreStateSchema.default(""),
    rr: ScoreStateSchema.default(""),
    bp: ScoreStateSchema.default(""),
    age: ScoreStateSchema.default(""),
  })
  .passthrough();

const StringFieldSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : (value ?? "")),
  z.string(),
);

const StringArrayFieldSchema = z.preprocess(
  (value) => value ?? [],
  z.array(z.string()),
);

export const AntibioticCourseSchema = z
  .object({
    id: z.string().min(1),
    drug: StringFieldSchema,
    startDate: StringFieldSchema,
    route: StringFieldSchema,
    note: StringFieldSchema,
  })
  .passthrough();

export const InfectionRecordSchema = z
  .object({
    id: z.string().min(1),
    name: StringFieldSchema,
    collapsed: z.boolean().default(false),
    temperature: StringFieldSchema,
    sources: StringArrayFieldSchema,
    cultures: StringArrayFieldSchema,
    qsofa: z.preprocess((value) => value ?? {}, QsofaScoreSchema),
    curb65: z.preprocess((value) => value ?? {}, Curb65ScoreSchema),
    antibiotics: z.array(AntibioticCourseSchema).default([]),
    note: StringFieldSchema,
  })
  .passthrough();

export const InfectionRecordsFieldSchema = z.preprocess(
  (value) => value ?? [],
  z.array(InfectionRecordSchema),
);

export type ScoreState = z.infer<typeof ScoreStateSchema>;
export type QsofaScore = z.infer<typeof QsofaScoreSchema>;
export type Curb65Score = z.infer<typeof Curb65ScoreSchema>;
export type AntibioticCourse = z.infer<typeof AntibioticCourseSchema>;
export type InfectionRecord = z.infer<typeof InfectionRecordSchema>;
export type InfectionRecords = z.infer<typeof InfectionRecordsFieldSchema>;
export type InfectionScoreKind = "qsofa" | "curb65";

export interface InfectionFactoryDependencies {
  createId: () => string;
}

export function createInfectionRecord(
  patientAge: string,
  dependencies: InfectionFactoryDependencies,
): InfectionRecord {
  const numericAge = /^\d+(\.\d+)?$/.test(patientAge) ? Number(patientAge) : null;
  return InfectionRecordSchema.parse({
    id: dependencies.createId(),
    curb65: {
      age: numericAge === null ? "" : numericAge >= 65 ? "yes" : "no",
    },
  });
}

export function createAntibioticCourse(
  dependencies: InfectionFactoryDependencies,
  drug = "",
): AntibioticCourse {
  return AntibioticCourseSchema.parse({ id: dependencies.createId(), drug });
}

export function cycleScoreState(current: ScoreState): ScoreState {
  const index = SCORE_STATES.indexOf(current);
  return SCORE_STATES[(index + 1) % SCORE_STATES.length] ?? "";
}

export interface ScoreInfo {
  score: number;
  done: number;
  total: number;
  complete: boolean;
}

function scoreRecord(score: QsofaScore | Curb65Score): Record<string, unknown> {
  return score as unknown as Record<string, unknown>;
}

export function infectionScoreInfo(
  kind: InfectionScoreKind,
  score: QsofaScore | Curb65Score,
): ScoreInfo {
  const criteria = kind === "qsofa" ? QSOFA_CRITERIA : CURB65_CRITERIA;
  const record = scoreRecord(score);
  const values = criteria.map((criterion) => record[criterion.key]);
  const points = values.filter((value) => value === "yes").length;
  const done = values.filter((value) => value === "yes" || value === "no").length;
  return {
    score: points,
    done,
    total: criteria.length,
    complete: done === criteria.length,
  };
}

export interface ScoreAdvice {
  tone: "" | "warn" | "danger";
  text: string;
}

export function infectionScoreAdvice(
  kind: InfectionScoreKind,
  score: QsofaScore | Curb65Score,
): ScoreAdvice {
  const info = infectionScoreInfo(kind, score);
  if (!info.complete) {
    return {
      tone: "",
      text:
        kind === "qsofa"
          ? `目前 ${info.score} 分；尚有 ${info.total - info.done} 項未評估。完成後顯示分層；qSOFA 不可單獨用來排除敗血症。`
          : `目前 ${info.score} 分；尚有 ${info.total - info.done} 項未評估。完成後顯示分層。`,
    };
  }
  if (kind === "qsofa") {
    return info.score >= 2
      ? {
          tone: "danger",
          text: `qSOFA ${info.score}/3：高風險提示。立即評估器官功能、升級監測與治療，並依院內流程考慮重症評估。`,
        }
      : {
          tone: "",
          text: `qSOFA ${info.score}/3：未達 ≥2 高風險門檻；仍須結合臨床、器官功能與其他警示評估。`,
        };
  }
  if (info.score >= 3) {
    return {
      tone: "danger",
      text: `CURB-65 ${info.score}/5：高風險（3–5 分）。儘速資深醫師與重症照護評估，並依臨床狀況決定照護層級。`,
    };
  }
  if (info.score === 2) {
    return {
      tone: "warn",
      text: "CURB-65 2/5：中度風險。建議住院與密切監測評估，並結合共病及臨床判斷。",
    };
  }
  return {
    tone: "",
    text: `CURB-65 ${info.score}/5：低風險分層（0–1 分）；仍依臨床與共病決定照護層級。`,
  };
}

export function setInfectionScoreState(
  infection: InfectionRecord,
  kind: InfectionScoreKind,
  criterionKey: string,
  state: ScoreState,
): InfectionRecord {
  const criteria = kind === "qsofa" ? QSOFA_CRITERIA : CURB65_CRITERIA;
  if (!criteria.some((criterion) => criterion.key === criterionKey)) {
    throw new Error(`Unknown ${kind} criterion ${criterionKey}.`);
  }
  return InfectionRecordSchema.parse({
    ...infection,
    [kind]: { ...infection[kind], [criterionKey]: state },
  });
}

export function toggleInfectionMultiValue(
  current: readonly string[],
  value: string,
  field: "sources" | "cultures",
): string[] {
  const definition = INFECTION_MULTI[field];
  if (!definition?.options.includes(value)) {
    throw new Error(`Unknown infection ${field} option ${value}.`);
  }
  const values = [...new Set(current.filter(Boolean))];
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function cycleAntibioticRoute(current: string): string {
  const index = ANTIBIOTIC_ROUTES.indexOf(current);
  if (index < 0) return ANTIBIOTIC_ROUTES[0] ?? "";
  return index === ANTIBIOTIC_ROUTES.length - 1
    ? ""
    : (ANTIBIOTIC_ROUTES[index + 1] ?? "");
}

export function allAntibioticOptions(customOptions: readonly string[]): string[] {
  return [...new Set([...DEFAULT_ANTIBIOTICS, ...customOptions].filter(Boolean))];
}

export function calculateAntibioticDay(date: string, now: Date): CalendarDayResult {
  const elapsed = calculateElapsedDay(date, now);
  if (elapsed.days === undefined) return elapsed;
  const day = elapsed.days + 1;
  return { ...elapsed, text: `Day ${day}`, value: `Day ${day}`, days: day };
}

export interface TemperatureState {
  tone: "empty" | "norm" | "danger";
  label: string;
}

export function infectionTemperatureState(value: string): TemperatureState {
  if (value === "" || Number.isNaN(Number(value))) {
    return { tone: "empty", label: "未評估" };
  }
  const temperature = Number(value);
  if (temperature >= 38) return { tone: "danger", label: "發燒 ≥38°C" };
  if (temperature < 36) return { tone: "danger", label: "低體溫 <36°C" };
  return { tone: "norm", label: "已測量" };
}
