import type { FindingValue } from "../../domain/clinical/finding";
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

interface EdInterviewTabProps {
  findings: EdFindings;
  patient: EdPatientContext;
  onChange: EdFindingChange;
}

function blockTitle(block: InterviewBlock): string {
  if (block.key.startsWith("char.")) return `${block.title}・特徵`;
  if (block.key === "conditional") return block.title;
  const system = block.title as EdSystemKey;
  return SYSTEM_LABELS[system] ?? block.title;
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
  const problems = selectedProblems(findings);
  if (problems.length === 0) {
    return (
      <section className="v2-card ed-panel">
        <p className="v2-empty">請先到「問題」分頁選擇病人的主訴。</p>
      </section>
    );
  }
  const interview = buildInterview(problems, findings, patient);
  const hasMore = interview.more.length > 0;

  return (
    <section className="v2-card ed-panel" aria-labelledby="ed-interview-title">
      <h2 id="ed-interview-title">問診（已合併 {problems.length} 個問題）</h2>
      <p className="ed-help">
        ★ =
        不可漏問。「共用」代表多個問題都需要這一題，只問一次。沒回答的題目不會寫進病歷。
      </p>
      {interview.characterize.map((block) => (
        <Block block={block} findings={findings} key={block.key} onChange={onChange} />
      ))}
      {interview.core.map((block) => (
        <Block block={block} findings={findings} key={block.key} onChange={onChange} />
      ))}
      {interview.conditional ? (
        <Block block={interview.conditional} findings={findings} onChange={onChange} />
      ) : null}
      {hasMore ? (
        <details className="ed-more">
          <summary>
            視情況再問（{interview.more.reduce((n, b) => n + b.items.length, 0)} 題）
          </summary>
          {interview.more.map((block) => (
            <Block
              block={block}
              findings={findings}
              key={block.key}
              onChange={onChange}
            />
          ))}
        </details>
      ) : null}
    </section>
  );
}
