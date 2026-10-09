import type { ReactNode } from "react";

import type { FindingValue } from "../../domain/clinical/finding";
import {
  composeChart,
  type EdFindings,
  type EdPatientContext,
} from "../../domain/ed/compose";
import { selectedComplaints } from "../../domain/ed/complaints";
import { planOrders } from "../../domain/ed/order-rules";
import { EdBackgroundTab } from "./EdBackgroundTab";
import { EdChartTab } from "./EdChartTab";
import { EdInterviewTab } from "./EdInterviewTab";
import { EdOrdersTab } from "./EdOrdersTab";
import { EdPhysicalTab } from "./EdPhysicalTab";
import { EdProblemsTab } from "./EdProblemsTab";

/** Same shape as the patient note's tab; declared here so features do not import each other. */
export interface EdNoteTab {
  key: string;
  label: string;
  badge?: number;
  content: ReactNode;
}

interface EdNoteTabsInput {
  findings: EdFindings;
  patient: EdPatientContext;
  onFindingChange: (key: string, finding: FindingValue) => void;
  onFindingsChange: (patch: Record<string, FindingValue>) => void;
}

function answeredCount(findings: EdFindings, prefix: string): number {
  return Object.entries(findings).filter(
    ([key, value]) =>
      key.startsWith(prefix) &&
      (value?.on !== undefined || Boolean(value?.sel) || Boolean(value?.text)),
  ).length;
}

/** 急診模式的分頁：問題 → 問診 → PE → 病史 → 檢查 → 病歷輸出。 */
export function buildEdNoteTabs({
  findings,
  patient,
  onFindingChange,
  onFindingsChange,
}: EdNoteTabsInput): EdNoteTab[] {
  const chart = composeChart(findings, patient);
  const orderCount = planOrders(findings, patient).selected.length;

  return [
    {
      key: "ed-problems",
      label: "問題",
      badge: selectedComplaints(findings).length,
      content: <EdProblemsTab findings={findings} onChange={onFindingChange} />,
    },
    {
      key: "ed-interview",
      label: "問診",
      badge: answeredCount(findings, "ed.h."),
      content: (
        <EdInterviewTab
          findings={findings}
          onChange={onFindingChange}
          patient={patient}
        />
      ),
    },
    {
      key: "ed-pe",
      label: "PE",
      badge: answeredCount(findings, "ed.pe."),
      content: (
        <EdPhysicalTab
          findings={findings}
          onBulkChange={onFindingsChange}
          onChange={onFindingChange}
        />
      ),
    },
    {
      key: "ed-background",
      label: "病史",
      badge: answeredCount(findings, "ed.pmh."),
      content: (
        <EdBackgroundTab
          findings={findings}
          onBulkChange={onFindingsChange}
          onChange={onFindingChange}
        />
      ),
    },
    {
      key: "ed-orders",
      label: "檢查",
      badge: orderCount,
      content: (
        <EdOrdersTab
          findings={findings}
          onBulkChange={onFindingsChange}
          onChange={onFindingChange}
          patient={patient}
        />
      ),
    },
    {
      key: "ed-chart",
      label: "病歷輸出",
      badge: chart.missing.length,
      content: (
        <EdChartTab
          findings={findings}
          onBulkChange={onFindingsChange}
          onChange={onFindingChange}
          patient={patient}
        />
      ),
    },
  ];
}
