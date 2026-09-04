import { isAdlDependent, sortTodos } from "../note-workspace";
import type { Patient } from "../patient";
import { summaryLine, type ClinicalSummarySection } from "./model";

function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildAdmissionSummarySection(patient: Patient): ClinicalSummarySection {
  const admission = patient.admission;
  const lines = [
    summaryLine(
      "菸酒檳榔",
      admission.habits.length > 0 ? admission.habits.join("、") : "無 / 未填",
      admission.habits.length > 0,
    ),
  ];
  if (admission.foodAllergy || admission.foodAllergyNote.trim()) {
    lines.push(
      summaryLine(
        "食物過敏",
        admission.foodAllergy ? "有" : "無",
        admission.foodAllergy,
        admission.foodAllergyNote,
      ),
    );
  }
  if (admission.drugAllergy || admission.drugAllergyNote.trim()) {
    lines.push(
      summaryLine(
        "藥物過敏",
        admission.drugAllergy ? "有" : "無",
        admission.drugAllergy,
        admission.drugAllergyNote,
      ),
    );
  }
  const tocc = [
    admission.tocc.t.trim() ? `旅遊 ${admission.tocc.t.trim()}` : "",
    admission.tocc.o.trim() ? `職業 ${admission.tocc.o.trim()}` : "",
    admission.tocc.c.trim() ? `接觸 ${admission.tocc.c.trim()}` : "",
    admission.tocc.cl.trim() ? `群聚 ${admission.tocc.cl.trim()}` : "",
  ].filter(Boolean);
  if (tocc.length > 0) lines.push(summaryLine("TOCC", tocc.join("；"), true));
  if (admission.recentAdm || admission.recentAdmNote.trim()) {
    lines.push(
      summaryLine(
        "近期住院史",
        admission.recentAdm ? "有" : "—",
        admission.recentAdm,
        admission.recentAdmNote,
      ),
    );
  }
  if (admission.familyHx.trim()) {
    lines.push(summaryLine("家族史", admission.familyHx));
  }

  const dependent = isAdlDependent(patient.adl);
  lines.push(summaryLine("ADL 日常生活功能", patient.adl.level, dependent));
  if (dependent) {
    const caregivers: string[] = [];
    if (patient.adl.foreign) caregivers.push("外籍看護 Foreign");
    if (patient.adl.domestic) caregivers.push("本國看護 Domestic");
    if (patient.adl.institution) {
      caregivers.push(
        `機構 Institution${patient.adl.instName.trim() ? `（${patient.adl.instName.trim()}）` : ""}`,
      );
    }
    if (patient.adl.family) {
      caregivers.push(
        `家人 Family${patient.adl.famName.trim() ? `（${patient.adl.famName.trim()}）` : ""}`,
      );
    }
    lines.push(
      summaryLine(
        "主要照護者 Caregiver",
        caregivers.length > 0 ? caregivers.join("、") : "（未填）",
        true,
      ),
    );
  }
  if (patient.adl.note.trim()) {
    lines.push(summaryLine("ADL 備註", patient.adl.note));
  }

  return {
    id: "admission-history-adl",
    title: "入院評估・病史・ADL Admission / History / ADL",
    note: "",
    lines,
  };
}

export function buildPmhSummarySection(
  patient: Patient,
): ClinicalSummarySection | null {
  const entries = patient.pmh.map((entry) => entry.text.trim()).filter(Boolean);
  if (entries.length === 0) return null;
  return {
    id: "past-medical-history",
    title: "過去病史 Past medical history",
    note: "",
    lines: entries.map((entry) => summaryLine("•", entry)),
  };
}

export function buildAdditionalNotesSection(patient: Patient): ClinicalSummarySection {
  return {
    id: "additional-notes",
    title: "其他備註 Additional notes",
    note: "",
    lines: [summaryLine("", patient.globalNote.trim() || "（無）")],
  };
}

export function buildTodoSummarySection(patient: Patient): ClinicalSummarySection {
  const todos = sortTodos(patient.todos);
  return {
    id: "todo-list",
    title: "待辦事項 To-do",
    note: "",
    lines:
      todos.length === 0
        ? [summaryLine("", "（無）")]
        : todos.map((todo) => {
            const status = todo.status === "done" ? "[✓完成]" : "[待辦]";
            const important = todo.important ? "★" : "";
            return summaryLine(
              `${important}${status}`,
              `${todo.text.trim() || "（未填）"} (${formatShortDate(todo.createdAt)})`,
              todo.status !== "done",
            );
          }),
  };
}
