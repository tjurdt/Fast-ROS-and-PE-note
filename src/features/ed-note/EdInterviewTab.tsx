import { useState } from "react";

import type { FindingValue } from "../../domain/clinical/finding";
import { selectedComplaints } from "../../domain/ed/complaints";
import {
  buildInterview,
  selectedProblems,
  type EdFindings,
  type EdPatientContext,
  type InterviewBlock,
} from "../../domain/ed/compose";
import { SYSTEM_LABELS, historyItem } from "../../domain/ed/history-library";
import { edKey, type EdSystemKey } from "../../domain/ed/types";
import { CycleSelect, HistoryGrid, type EdFindingChange } from "./ed-controls";

interface EdInterviewTabProps {
  findings: EdFindings;
  patient: EdPatientContext;
  onChange: EdFindingChange;
}

/** 問診深度：精簡＝只問★必問；標準＝特徵＋核心；完整＝全部展開。 */
export type InterviewDepth = "lean" | "standard" | "full";

const DEPTH_KEY = "pe_note_ed_depth";
const DEPTH_OPTIONS: readonly { value: InterviewDepth; label: string }[] = [
  { value: "lean", label: "精簡" },
  { value: "standard", label: "標準" },
  { value: "full", label: "完整" },
];

function loadDepth(): InterviewDepth {
  try {
    const stored = window.localStorage.getItem(DEPTH_KEY);
    if (stored === "lean" || stored === "standard" || stored === "full") return stored;
  } catch {
    /* 無法讀取就用預設 */
  }
  return "lean";
}

function saveDepth(depth: InterviewDepth) {
  try {
    window.localStorage.setItem(DEPTH_KEY, depth);
  } catch {
    /* 只是記住偏好，失敗就算了 */
  }
}

function blockTitle(block: InterviewBlock): string {
  if (block.key.startsWith("char.")) return block.title;
  if (block.key === "conditional") return block.title;
  const system = block.title as EdSystemKey;
  return SYSTEM_LABELS[system] ?? block.title;
}

function answered(finding: FindingValue | undefined): boolean {
  return (
    finding?.on !== undefined || Boolean(finding?.sel) || Boolean(finding?.text?.trim())
  );
}

/** 幾個題組放進同一個格子：題組名（問題或系統）佔一格，後面直接接題目。 */
function Section({
  blocks,
  findings,
  onChange,
  testId,
}: {
  blocks: readonly InterviewBlock[];
  findings: EdFindings;
  onChange: EdFindingChange;
  testId?: string;
}) {
  const groups = blocks
    .filter((block) => block.items.length > 0)
    .map((block) => ({
      key: block.key,
      label: blockTitle(block),
      entries: block.items,
    }));
  if (groups.length === 0) return null;
  return (
    <div className="ed-sec" data-testid={testId}>
      <HistoryGrid
        finding={(id) => findings[edKey.history(id)] ?? {}}
        groups={groups}
        item={historyItem}
        onChange={(id, next) => onChange(edKey.history(id), next)}
      />
    </div>
  );
}

export function EdInterviewTab({ findings, patient, onChange }: EdInterviewTabProps) {
  const [depth, setDepth] = useState<InterviewDepth>(loadDepth);
  const problems = selectedProblems(findings);
  const hasCustomOnly =
    problems.length === 0 && selectedComplaints(findings).length > 0;

  const extra = (
    <label className="ed-line ed-line--area">
      <span>補充</span>
      <textarea
        aria-label="問診補充"
        onChange={(event) =>
          onChange(edKey.ctx("piExtra"), { text: event.target.value })
        }
        placeholder="題庫沒有的內容直接打，寫進 PI 結尾"
        rows={2}
        value={findings[edKey.ctx("piExtra")]?.text ?? ""}
      />
    </label>
  );

  if (problems.length === 0) {
    return (
      <section className="ed-panel">
        <p className="v2-empty">
          {hasCustomOnly
            ? "只有自訂主訴，題庫沒有對應題目；用下方補充寫進 PI。"
            : "請先到「問題」分頁選擇病人的主訴。"}
        </p>
        {hasCustomOnly ? extra : null}
      </section>
    );
  }

  const interview = buildInterview(problems, findings, patient);
  const isAnswered = (id: string) => answered(findings[edKey.history(id)]);

  const setDepthAndSave = (next: InterviewDepth) => {
    setDepth(next);
    saveDepth(next);
  };

  // 精簡：核心題只留★必問與已回答的，其餘收進「其他題目」。特徵題一律保留。
  const keepInLean = (entry: { id: string; must: boolean }) =>
    entry.must || isAnswered(entry.id);
  const split = (blocks: InterviewBlock[]) => {
    const shown: InterviewBlock[] = [];
    const hidden: InterviewBlock[] = [];
    for (const block of blocks) {
      shown.push({ ...block, items: block.items.filter(keepInLean) });
      hidden.push({
        ...block,
        items: block.items.filter((entry) => !keepInLean(entry)),
      });
    }
    return { shown, hidden: hidden.filter((block) => block.items.length > 0) };
  };

  const lean = depth === "lean";
  const core = lean ? split(interview.core) : { shown: interview.core, hidden: [] };
  const conditional = interview.conditional;
  const conditionalSplit =
    lean && conditional
      ? split([conditional])
      : { shown: conditional ? [conditional] : [], hidden: [] };

  const moreBlocks = [...interview.more];
  const otherBlocks = [...core.hidden, ...conditionalSplit.hidden, ...moreBlocks];
  const otherCount = otherBlocks.reduce((n, block) => n + block.items.length, 0);

  return (
    <section className="ed-panel" aria-labelledby="ed-interview-title">
      <div className="ed-bar">
        <h2 id="ed-interview-title">問診・{problems.length} 個問題</h2>
        <CycleSelect
          label="深度"
          onChange={setDepthAndSave}
          options={DEPTH_OPTIONS}
          value={depth}
        />
      </div>
      <Section
        blocks={interview.characterize}
        findings={findings}
        onChange={onChange}
        testId="ed-characterize"
      />
      <Section
        blocks={[...core.shown, ...conditionalSplit.shown]}
        findings={findings}
        onChange={onChange}
        testId="ed-core"
      />
      {otherCount > 0 ? (
        <details className="ed-tri" open={depth === "full"}>
          <summary data-testid="ed-other-summary">其他題目（{otherCount}）</summary>
          <Section blocks={otherBlocks} findings={findings} onChange={onChange} />
        </details>
      ) : null}
      {extra}
    </section>
  );
}
