import type { FindingValue } from "../../domain/clinical/finding";
import type { EdFindings, EdPatientContext } from "../../domain/ed/compose";
import { selectedComplaints } from "../../domain/ed/complaints";
import { selectedProblems } from "../../domain/ed/compose";
import {
  planOrders,
  type OrderSuggestion,
  type OrderTier,
} from "../../domain/ed/order-rules";
import {
  ED_ORDER_GROUP_LABELS,
  ED_ORDER_GROUP_ORDER,
  type EdOrderGroup,
} from "../../domain/ed/orders";
import { edKey } from "../../domain/ed/types";
import { Button } from "../../ui/Button";
import type { EdFindingChange } from "./ed-controls";

interface EdOrdersTabProps {
  findings: EdFindings;
  patient: EdPatientContext;
  onChange: EdFindingChange;
  onBulkChange: (patch: Record<string, FindingValue>) => void;
}

const TIER_LABEL: Record<OrderTier, string> = {
  core: "標準",
  plus: "加開",
  ask: "需討論",
};

function OrderCell({
  entry,
  onToggle,
}: {
  entry: OrderSuggestion;
  onToggle: (id: string, on: boolean) => void;
}) {
  const { order } = entry;
  return (
    <label
      className={`ed-order ${entry.selected ? "is-selected" : ""} is-${entry.tier}`}
      data-testid={`ed-order-${order.id}`}
    >
      <input
        aria-label={`${order.name}（${order.pfkey}）`}
        checked={entry.selected}
        onChange={(event) => onToggle(order.id, event.target.checked)}
        type="checkbox"
      />
      <span className="ed-order__body">
        <span className="ed-order__name">
          {order.name}
          {entry.reasons.length > 0 ? (
            <span className={`ed-order__tier is-${entry.tier}`}>
              {TIER_LABEL[entry.tier]}
            </span>
          ) : null}
        </span>
        {entry.reasons.length > 0 ? (
          <small className="ed-order__why">{entry.reasons.join("；")}</small>
        ) : null}
      </span>
    </label>
  );
}

function groupEntries(entries: readonly OrderSuggestion[]) {
  const byGroup = new Map<EdOrderGroup, OrderSuggestion[]>();
  for (const entry of entries) {
    const list = byGroup.get(entry.order.group) ?? [];
    list.push(entry);
    byGroup.set(entry.order.group, list);
  }
  return ED_ORDER_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    entries: byGroup.get(group) ?? [],
  }));
}

export function EdOrdersTab({
  findings,
  patient,
  onChange,
  onBulkChange,
}: EdOrdersTabProps) {
  const problems = selectedProblems(findings);
  if (selectedComplaints(findings).length === 0) {
    return (
      <section className="v2-card ed-panel">
        <p className="v2-empty">請先到「問題」分頁選擇病人的主訴，才能建議檢查。</p>
      </section>
    );
  }

  const plan = planOrders(findings, patient);
  const toggle = (id: string, on: boolean) => onChange(edKey.order(id), { on });
  const hasOverride = Object.keys(findings).some(
    (key) => key.startsWith("ed.ord.") && findings[key]?.on !== undefined,
  );
  const resetAll = () => {
    const patch: Record<string, FindingValue> = {};
    for (const key of Object.keys(findings)) {
      if (key.startsWith("ed.ord.")) patch[key] = {};
    }
    onBulkChange(patch);
  };

  return (
    <section className="v2-card ed-panel" aria-labelledby="ed-orders-title">
      <h2 id="ed-orders-title">
        建議檢查（已合併 {problems.length} 個問題、去除重複）
      </h2>
      <p className="ed-help">
        名稱與 ERS 檢查驗系統一致。<strong>標準</strong>與<strong>加開</strong>
        預設勾選（寧可合理多開）；
        <strong>需討論</strong>
        （高輻射、要會診或 VS 同意）預設不勾。勾選的項目會隨病歷一併帶到 ERS
        檢查驗系統， 只填入待送出的格子，不會自動送出。
      </p>

      <div className="ed-actions">
        <span className="ed-order__count" data-testid="ed-order-count">
          已選 {plan.selected.length} 項
        </span>
        {hasOverride ? (
          <Button onClick={resetAll} tone="ghost">
            還原建議
          </Button>
        ) : null}
      </div>

      {plan.notes.length > 0 ? (
        <div className="ed-alert" role="note" data-testid="ed-order-notes">
          <strong>提醒（不在檢查清單內）</strong>
          <ul>
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {groupEntries(plan.suggestions).map(({ group, entries }) => (
        <div className="ed-order-group" key={group}>
          <h3>{ED_ORDER_GROUP_LABELS[group]}</h3>
          <div className="ed-order-grid">
            {entries.map((entry) => (
              <OrderCell entry={entry} key={entry.order.id} onToggle={toggle} />
            ))}
          </div>
        </div>
      ))}

      {plan.suggestions.length === 0 ? (
        <p className="v2-empty">這些問題沒有預設建議的檢查，可從下方手動加入。</p>
      ) : null}

      <details className="ed-more">
        <summary>其他常用檢查（手動加入，共 {plan.extras.length} 項）</summary>
        {groupEntries(plan.extras).map(({ group, entries }) => (
          <div className="ed-order-group" key={group}>
            <h3>{ED_ORDER_GROUP_LABELS[group]}</h3>
            <div className="ed-order-grid">
              {entries.map((entry) => (
                <OrderCell entry={entry} key={entry.order.id} onToggle={toggle} />
              ))}
            </div>
          </div>
        ))}
      </details>
    </section>
  );
}
