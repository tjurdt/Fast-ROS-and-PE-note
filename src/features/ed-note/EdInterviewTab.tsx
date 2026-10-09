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
import { HistoryRow, type EdFindingChange } from "./ed-controls";
import { SpecialPicker } from "./SpecialPicker";

interface EdInterviewTabProps {
  findings: EdFindings;
  patient: EdPatientContext;
  onChange: EdFindingChange;
}

/** 問診深度：精簡＝只問★必問；標準＝特徵＋核心；完整＝全部展開。 */
export type InterviewDepth = "lean" | "standard" | "full";

const DEPTH_KEY = "pe_note_ed_depth";
const DEPTH_LABELS: Record<InterviewDepth, string> = {
  lean: "精簡",
  standard: "標準",
  full: "完整",
};

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
  if (block.key.startsWith("char.")) return `${block.title}・特徵`;
  if (block.key === "conditional") return block.title;
  const system = block.title as EdSystemKey;
  return SYSTEM_LABELS[system] ?? block.title;
}

function answered(finding: FindingValue | undefined): boolean {
  return (
    finding?.on !== undefined || Boolean(finding?.sel) || Boolean(finding?.text?.trim())
  );
}

function Block({
  block,
  findings,
  onChange,
}: {
  block: InterviewBlock;
  findings: EdFindings;
  onChange: EdFindingChange;
}) {
  if (block.items.length === 0) return null;
  return (
    <div className="ed-block" data-testid={`ed-block-${block.key}`}>
      <h3>{blockTitle(block)}</h3>
      {block.items.map((entry) => {
        const item = historyItem(entry.id);
        if (!item) return null;
        const finding: FindingValue = findings[edKey.history(entry.id)] ?? {};
        return (
          <HistoryRow
            finding={finding}
            item={item}
            key={entry.id}
            must={entry.must}
            onChange={(next) => onChange(edKey.history(entry.id), next)}
            reasons={entry.reasons}
          />
        );
      })}
    </div>
  );
}

export function EdInterviewTab({ findings, patient, onChange }: EdInterviewTabProps) {
  const [depth, setDepth] = useState<InterviewDepth>(loadDepth);
  const problems = selectedProblems(findings);
  const hasCustomOnly =
    problems.length === 0 && selectedComplaints(findings).length > 0;

  const extra = (
    <>
      <h3>補充（自由輸入，寫進 PI）</h3>
      <textarea
        aria-label="問診補充"
        onChange={(event) =>
          onChange(edKey.ctx("piExtra"), { text: event.target.value })
        }
        placeholder="題庫沒有的內容都可以直接打，例如：昨晚聚餐後開始、家人也有類似症狀"
        rows={2}
        value={findings[edKey.ctx("piExtra")]?.text ?? ""}
      />
      <h3>本次相關情境</h3>
      <SpecialPicker findings={findings} onChange={onChange} target="PI" />
    </>
  );

  if (problems.length === 0) {
    return (
      <section className="v2-card ed-panel">
        {hasCustomOnly ? (
          <>
            <p className="ed-help">
              目前只有自訂主訴，題庫沒有對應的問診題；請用下方補充欄寫進
              PI，或回到「問題」分頁加選標準症狀。
            </p>
            {extra}
          </>
        ) : (
          <p className="v2-empty">請先到「問題」分頁選擇病人的主訴。</p>
        )}
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
    <section className="v2-card ed-panel" aria-labelledby="ed-interview-title">
      <h2 id="ed-interview-title">問診（已合併 {problems.length} 個問題）</h2>
      <div className="ed-depth" role="group" aria-label="問診深度">
        {(Object.keys(DEPTH_LABELS) as InterviewDepth[]).map((key) => (
          <button
            aria-pressed={depth === key}
            className={`ed-chip ${depth === key ? "is-active" : ""}`}
            key={key}
            onClick={() => setDepthAndSave(key)}
            type="button"
          >
            {DEPTH_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="ed-help">
        {lean
          ? "精簡：只列★必問題；其他收在下方「其他題目」，答過的題目會自動顯示。"
          : depth === "standard"
            ? "標準：特徵題＋核心題；視情況再問的收在下方。"
            : "完整：全部題目展開。"}
        「共用」代表多個問題都需要這一題，只問一次。沒回答的題目不會寫進病歷。
      </p>
      {interview.characterize.map((block) => (
        <Block block={block} findings={findings} key={block.key} onChange={onChange} />
      ))}
      {core.shown.map((block) => (
        <Block block={block} findings={findings} key={block.key} onChange={onChange} />
      ))}
      {conditionalSplit.shown.map((block) => (
        <Block block={block} findings={findings} key={block.key} onChange={onChange} />
      ))}
      {otherCount > 0 ? (
        <details className="ed-more" open={depth === "full"}>
          <summary data-testid="ed-other-summary">其他題目（{otherCount} 題）</summary>
          {otherBlocks.map((block) => (
            <Block
              block={block}
              findings={findings}
              key={`other.${block.key}`}
              onChange={onChange}
            />
          ))}
        </details>
      ) : null}
      {extra}
    </section>
  );
}
