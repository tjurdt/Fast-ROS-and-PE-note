import type { ReactNode } from "react";

import type { FindingValue } from "../../domain/clinical/finding";
import type { HistoryItem, PeItem } from "../../domain/ed/types";

export type EdFindingChange = (key: string, finding: FindingValue) => void;

export function Chip({
  active,
  tone = "default",
  onClick,
  children,
  label,
}: {
  active: boolean;
  tone?: "default" | "positive" | "negative" | "warning";
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`ed-chip ${active ? `is-active is-${tone}` : ""}`.trim()}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MustMark({ reasons }: { reasons: readonly string[] }) {
  return (
    <span className="ed-must" title={`不可漏問／漏做：${reasons.join("、")}`}>
      ★
    </span>
  );
}

function ReasonTags({ reasons }: { reasons: readonly string[] }) {
  if (reasons.length < 2) return null;
  return (
    <span className="ed-reasons" title="多個問題共用這一題，只需問一次">
      共用 ×{reasons.length}
    </span>
  );
}

export function HistoryRow({
  item,
  finding,
  must,
  reasons,
  onChange,
}: {
  item: HistoryItem;
  finding: FindingValue;
  must: boolean;
  reasons: readonly string[];
  onChange: (finding: FindingValue) => void;
}) {
  const heading = (
    <span className="ed-row__label">
      {must ? <MustMark reasons={reasons} /> : null}
      {item.label}
      <ReasonTags reasons={reasons} />
    </span>
  );

  if (item.type === "yn") {
    const detail = item.detail;
    return (
      <div className="ed-row" data-testid={`ed-h-${item.id}`}>
        {heading}
        <span className="ed-row__controls">
          <Chip
            active={finding.on === true}
            label={`${item.label}：有`}
            onClick={() =>
              onChange(finding.on === true ? {} : { ...finding, on: true })
            }
            tone="warning"
          >
            有
          </Chip>
          <Chip
            active={finding.on === false}
            label={`${item.label}：無`}
            onClick={() => onChange(finding.on === false ? {} : { on: false })}
            tone="negative"
          >
            無
          </Chip>
        </span>
        {finding.on === true && detail ? (
          <span className="ed-row__detail">
            {(detail.chips ?? []).map((chip) => (
              <Chip
                active={finding.text === chip}
                key={chip}
                onClick={() =>
                  onChange({ ...finding, text: finding.text === chip ? "" : chip })
                }
              >
                {chip}
              </Chip>
            ))}
            <input
              aria-label={`${item.label} 細節`}
              onChange={(event) => onChange({ ...finding, text: event.target.value })}
              placeholder={detail.placeholder ?? "細節"}
              value={finding.text ?? ""}
            />
          </span>
        ) : null}
      </div>
    );
  }

  if (item.type === "pick") {
    return (
      <div className="ed-row" data-testid={`ed-h-${item.id}`}>
        {heading}
        <span className="ed-row__controls">
          {item.options.map((option) => (
            <Chip
              active={finding.sel === option.label}
              key={option.label}
              onClick={() =>
                onChange(finding.sel === option.label ? {} : { sel: option.label })
              }
              tone="warning"
            >
              {option.label}
            </Chip>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div className="ed-row" data-testid={`ed-h-${item.id}`}>
      {heading}
      <span className="ed-row__controls">
        <input
          aria-label={item.label}
          onChange={(event) => onChange({ text: event.target.value })}
          placeholder={item.placeholder ?? ""}
          value={finding.text ?? ""}
        />
      </span>
    </div>
  );
}

export function PeRow({
  item,
  finding,
  must,
  reasons,
  onChange,
}: {
  item: PeItem;
  finding: FindingValue;
  must: boolean;
  reasons: readonly string[];
  onChange: (finding: FindingValue) => void;
}) {
  const chosen = finding.fu ?? {};
  return (
    <div className="ed-row" data-testid={`ed-pe-${item.id}`}>
      <span className="ed-row__label">
        {must ? <MustMark reasons={reasons} /> : null}
        {item.label}
        <ReasonTags reasons={reasons} />
      </span>
      <span className="ed-row__controls">
        <Chip
          active={finding.sel === "normal"}
          label={`${item.label}：正常`}
          onClick={() => onChange(finding.sel === "normal" ? {} : { sel: "normal" })}
          tone="positive"
        >
          正常
        </Chip>
        <Chip
          active={finding.sel === "abn"}
          label={`${item.label}：異常`}
          onClick={() =>
            onChange(finding.sel === "abn" ? {} : { ...finding, sel: "abn" })
          }
          tone="warning"
        >
          異常
        </Chip>
      </span>
      {finding.sel === "normal" ? (
        <span className="ed-row__hint">{item.normal}</span>
      ) : null}
      {finding.sel === "abn" ? (
        <span className="ed-row__detail">
          {item.abnormal.map((phrase) => (
            <Chip
              active={chosen[phrase] === "1"}
              key={phrase}
              onClick={() =>
                onChange({
                  ...finding,
                  fu: { ...chosen, [phrase]: chosen[phrase] === "1" ? "0" : "1" },
                })
              }
              tone="warning"
            >
              {phrase}
            </Chip>
          ))}
          <input
            aria-label={`${item.label} 補充`}
            onChange={(event) => onChange({ ...finding, note: event.target.value })}
            placeholder="補充（例 MP: LA 4）"
            value={finding.note ?? ""}
          />
        </span>
      ) : null}
    </div>
  );
}
