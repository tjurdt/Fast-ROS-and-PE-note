import { useState } from "react";

import { hasFinding } from "../../domain/clinical/clinical-rules";
import type {
  ClinicalItem as ClinicalItemDefinition,
  FollowUp,
} from "../../domain/clinical/catalog-schema";
import type { FindingValue } from "../../domain/patient";
import { Button } from "../../ui/Button";
import { CranialNerveWidget } from "./CranialNerveWidget";
import { CustomClinicalWidget } from "./CustomClinicalWidget";

interface ClinicalItemProps {
  item: ClinicalItemDefinition;
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}

function itemLabel(item: ClinicalItemDefinition): string {
  return item.en ? `${item.en}（${item.label}）` : item.label;
}

function FollowUpControl({
  definition,
  finding,
  onChange,
}: {
  definition: FollowUp;
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}) {
  const values = finding.fu ?? {};
  const value = values[definition.id] ?? "";
  const update = (next: string) =>
    onChange({ ...finding, fu: { ...values, [definition.id]: next } });

  if (definition.type === "select") {
    return (
      <label className="v2-follow-up">
        {definition.label}
        <select value={value} onChange={(event) => update(event.target.value)}>
          <option value="">— 選擇 —</option>
          {definition.opts.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.type === "toggle") {
    return (
      <Button
        className={value === "1" ? "v2-finding-toggle is-positive" : ""}
        onClick={() => update(value === "1" ? "" : "1")}
      >
        {definition.label} {value === "1" ? "(+)" : ""}
      </Button>
    );
  }

  return (
    <label className="v2-follow-up">
      {definition.label}
      <textarea
        rows={1}
        value={value}
        onChange={(event) => update(event.target.value)}
      />
    </label>
  );
}

export function ClinicalItem({ item, finding, onChange }: ClinicalItemProps) {
  const positive = hasFinding(item, finding);
  const label = itemLabel(item);
  const hasNote = Boolean(finding.note?.trim());
  const [noteOpen, setNoteOpen] = useState<boolean | null>(null);
  const showNote = noteOpen ?? hasNote;
  const followUps = item.type === "toggle" || item.type === "select" ? item.fu : null;
  const showFollowUps =
    followUps !== null &&
    (item.type === "toggle" ? finding.on === true : finding.sel === item.fuOn);
  const cranialNerves = item.type === "select" ? item.cnPanel : undefined;
  const showCranialNerves = cranialNerves !== undefined && finding.sel === item.cnOn;

  let control;
  if (item.type === "toggle") {
    control = (
      <Button
        aria-label={`${label}：${finding.on ? "陽性" : "陰性"}`}
        className={`v2-finding-toggle ${finding.on ? "is-positive" : ""}`}
        data-testid={`finding-control-${item.id}`}
        onClick={() => onChange({ ...finding, on: !finding.on })}
      >
        {finding.on ? "(+) 陽性" : "(−) 陰性"}
      </Button>
    );
  } else if (item.type === "select") {
    const cycle = ["", ...item.opts];
    const index = cycle.indexOf(finding.sel ?? "");
    const nextValue = cycle[(index + 1) % cycle.length] ?? "";
    control = (
      <Button
        aria-label={`${label}：${finding.sel || "未評估"}`}
        className={`v2-cycle ${positive ? "is-positive" : finding.sel ? "is-normal" : ""}`}
        data-testid={`finding-control-${item.id}`}
        onClick={() => onChange({ ...finding, sel: nextValue })}
      >
        {finding.sel || "未評估"}
      </Button>
    );
  } else if (item.type === "text") {
    control = (
      <textarea
        aria-label={label}
        className="v2-finding-text"
        data-testid={`finding-control-${item.id}`}
        placeholder="輸入"
        rows={1}
        value={finding.text ?? ""}
        onChange={(event) => onChange({ ...finding, text: event.target.value })}
      />
    );
  } else if (item.type === "group") {
    const group = finding.grp ?? {};
    const values = item.fields.map((field) => group[field.id]);
    const total = values.every((value) => value !== undefined && value !== "")
      ? values.reduce((sum, value) => sum + Number(value), 0)
      : null;
    control = (
      <div className="v2-finding-group" data-testid={`finding-control-${item.id}`}>
        {item.fields.map((field) => (
          <label key={field.id}>
            {field.label}
            <select
              value={group[field.id] ?? ""}
              onChange={(event) =>
                onChange({
                  ...finding,
                  grp: { ...group, [field.id]: event.target.value },
                })
              }
            >
              <option value="">—</option>
              {field.opts.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
        {item.total !== null && total !== null ? (
          <strong className={total < item.total ? "is-positive" : ""}>= {total}</strong>
        ) : null}
      </div>
    );
  } else {
    control = (
      <div className="v2-custom-widget" data-testid={`finding-control-${item.id}`}>
        <CustomClinicalWidget item={item} finding={finding} onChange={onChange} />
      </div>
    );
  }

  return (
    <article
      className={`v2-clinical-item ${positive ? "is-positive" : ""} ${item.type === "custom" ? "has-custom-widget" : ""}`}
      data-clinical-item={item.id}
    >
      <div className="v2-clinical-item__row">
        <button
          aria-label={`${label}備註`}
          aria-pressed={showNote}
          className={`v2-item-note-toggle ${hasNote ? "has-note" : ""}`}
          onClick={() => setNoteOpen(!showNote)}
          type="button"
        >
          ✎
        </button>
        <div className="v2-clinical-label">
          <strong>
            {item.en || item.label}
            {"star" in item && item.star ? <span aria-label="重點"> ★</span> : null}
          </strong>
          {item.en ? <small>{item.label}</small> : null}
        </div>
        {control}
      </div>

      {showFollowUps
        ? followUps.map((definition) => (
            <FollowUpControl
              key={definition.id}
              definition={definition}
              finding={finding}
              onChange={onChange}
            />
          ))
        : null}

      {showCranialNerves ? (
        <CranialNerveWidget
          definitions={cranialNerves}
          finding={finding}
          onChange={onChange}
        />
      ) : null}

      {showNote ? (
        <textarea
          aria-label={`${label}備註`}
          className="v2-item-note-text"
          rows={2}
          value={finding.note ?? ""}
          onChange={(event) => onChange({ ...finding, note: event.target.value })}
        />
      ) : null}
    </article>
  );
}
