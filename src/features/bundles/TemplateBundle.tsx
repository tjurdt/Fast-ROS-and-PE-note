import type { BundleField } from "../../domain/clinical/catalog-schema";
import { calculateElapsedDay } from "../../domain/calendar-day";
import {
  DIALYSIS_BUNDLE_ID,
  DIALYSIS_DAYS,
  DNR_BUNDLE_ID,
  DNR_MASTER_FIELD_ID,
  DNR_OPTIONS,
  DNR_STATES_FIELD_ID,
  cycleDnrState,
  dnrStateMap,
  setBundleField,
  setBundleFieldNote,
  setDnrMaster,
  toggleBundleArrayValue,
  type BundleInstance,
  type RenderableBundleTemplate,
} from "../../domain/bundles";
import { Button } from "../../ui/Button";

interface TemplateBundleProps {
  template: RenderableBundleTemplate;
  instance: BundleInstance;
  onChange: (instance: BundleInstance) => void;
  onRemove: () => void;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

interface FieldControlProps {
  field: BundleField;
  instance: BundleInstance;
  template: RenderableBundleTemplate;
  onChange: (instance: BundleInstance) => void;
}

function FieldControl({ field, instance, template, onChange }: FieldControlProps) {
  const value = instance[field.id];

  if (field.type === "toggle") {
    const enabled = value === true;
    return (
      <Button
        aria-pressed={enabled}
        className={enabled ? "is-positive" : ""}
        data-testid={`bundle-toggle-${field.id}`}
        onClick={() =>
          onChange(
            template.id === DNR_BUNDLE_ID && field.id === DNR_MASTER_FIELD_ID
              ? setDnrMaster(instance, !enabled)
              : setBundleField(instance, field.id, !enabled),
          )
        }
      >
        {template.id === DNR_BUNDLE_ID
          ? enabled
            ? "有 DNR"
            : "無 DNR"
          : enabled
            ? "(+) 是"
            : "(−) 否"}
      </Button>
    );
  }

  if (field.type === "text") {
    return (
      <textarea
        aria-label={`${template.name} ${field.label}`}
        rows={1}
        value={stringValue(value)}
        onChange={(event) =>
          onChange(setBundleField(instance, field.id, event.target.value))
        }
      />
    );
  }

  if (field.type === "date") {
    const date = stringValue(value);
    if (template.id !== DIALYSIS_BUNDLE_ID) {
      return (
        <input
          aria-label={`${template.name} ${field.label}`}
          type="date"
          value={date}
          onChange={(event) =>
            onChange(setBundleField(instance, field.id, event.target.value))
          }
        />
      );
    }
    return (
      <div className="v2-bundle-date">
        <input
          aria-label={`${template.name} ${field.label}`}
          type="date"
          value={date}
          onChange={(event) =>
            onChange(setBundleField(instance, field.id, event.target.value))
          }
        />
        <span>{calculateElapsedDay(date, new Date()).text}</span>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <select
        aria-label={`${template.name} ${field.label}`}
        value={stringValue(value)}
        onChange={(event) =>
          onChange(setBundleField(instance, field.id, event.target.value))
        }
      >
        <option value="">— 選擇 —</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "days") {
    const selected = stringArray(value);
    const order = DIALYSIS_DAYS.map((day) => day.key);
    return (
      <div className="v2-bundle-days">
        {DIALYSIS_DAYS.map((day) => (
          <Button
            aria-label={`星期${day.label} ${day.key}`}
            aria-pressed={selected.includes(day.key)}
            className={selected.includes(day.key) ? "is-selected" : ""}
            data-testid={`bundle-day-${day.key}`}
            key={day.key}
            onClick={() =>
              onChange(toggleBundleArrayValue(instance, field.id, day.key, order))
            }
          >
            {day.key}
            <small>{day.label}</small>
          </Button>
        ))}
      </div>
    );
  }

  if (field.type === "multi" || field.type === "chips") {
    const selected = stringArray(value);
    return (
      <div className="v2-bundle-chips">
        {field.options.map((option) => (
          <Button
            aria-pressed={selected.includes(option)}
            className={selected.includes(option) ? "is-selected" : ""}
            key={option}
            onClick={() => onChange(toggleBundleArrayValue(instance, field.id, option))}
          >
            {option}
          </Button>
        ))}
      </div>
    );
  }

  if (field.type === "dnrstates") {
    const states = dnrStateMap(
      instance[DNR_STATES_FIELD_ID],
      instance[DNR_MASTER_FIELD_ID] === true,
    );
    return (
      <div className="v2-dnr-states">
        {DNR_OPTIONS.map((option) => {
          const state = states[option] ?? "";
          const label =
            state === "agree" ? "同意" : state === "disagree" ? "未同意" : "—";
          return (
            <div className="v2-dnr-state" key={option}>
              <span>{option}</span>
              <Button
                aria-label={`${option}：${label}`}
                className={state ? `is-${state}` : ""}
                data-testid={`dnr-state-${DNR_OPTIONS.indexOf(option)}`}
                onClick={() => onChange(cycleDnrState(instance, option))}
              >
                {label}
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

export function TemplateBundle({
  template,
  instance,
  onChange,
  onRemove,
}: TemplateBundleProps) {
  return (
    <details
      className={`v2-bundle-card${template.id === DNR_BUNDLE_ID ? " v2-dnr" : ""}`}
      data-testid={`bundle-${template.id}`}
      open
    >
      <summary>
        組套 · {template.name}
        {template.archived ? "（已封存範本）" : ""}
      </summary>
      <div className="v2-bundle-card__body">
        <div className="v2-bundle-card__remove">
          <Button onClick={onRemove} tone="ghost">
            刪除組套
          </Button>
        </div>
        {template.id === DNR_BUNDLE_ID ? (
          <p className="v2-dnr__hint">
            請依病人正式意願書、同意書、健保卡註記與醫囑核對；此處為查房提示。
          </p>
        ) : null}
        {template.fields
          .filter((field) => !field.archived)
          .map((field) => {
            const isDnrDetail =
              template.id === DNR_BUNDLE_ID && field.id === DNR_STATES_FIELD_ID;
            if (isDnrDetail && instance[DNR_MASTER_FIELD_ID] !== true) return null;
            const allowNote =
              field.type !== "text" &&
              field.type !== "dnrstates" &&
              !(template.id === DNR_BUNDLE_ID && field.id === DNR_MASTER_FIELD_ID);
            return (
              <div className="v2-bundle-field" key={field.id}>
                {isDnrDetail ? null : <strong>{field.label}</strong>}
                <FieldControl
                  field={field}
                  instance={instance}
                  template={template}
                  onChange={onChange}
                />
                {allowNote ? (
                  <details className="v2-bundle-field__note">
                    <summary>欄位備註</summary>
                    <textarea
                      aria-label={`${template.name} ${field.label} 備註`}
                      rows={1}
                      value={instance.__notes[field.id] ?? ""}
                      onChange={(event) =>
                        onChange(
                          setBundleFieldNote(instance, field.id, event.target.value),
                        )
                      }
                    />
                  </details>
                ) : null}
              </div>
            );
          })}
        <label className="v2-bundle-field">
          <strong>組套註記</strong>
          <textarea
            aria-label={`${template.name} 組套註記`}
            rows={1}
            value={instance.__setNote}
            onChange={(event) =>
              onChange({ ...instance, __setNote: event.target.value })
            }
          />
        </label>
      </div>
    </details>
  );
}
