import type { ReactNode } from "react";

import {
  CHEMO_FLAGS,
  CHEMO_MULTI,
  NEUROPATHY_ROWS,
  NEUROPATHY_SITES,
  calculateChemotherapyDay,
  chemotherapyOptionTone,
  chemotherapyTemperatureState,
  cycleChemotherapyValue,
  cycleNeuropathyStatus,
  toggleChemotherapyMultiValue,
  toggleNeuropathyCell,
  type ChemoCycleField,
  type ChemoMultiField,
  type ChemotherapyFollowup as ChemotherapyFollowupValue,
} from "../../domain/chemotherapy-followup";
import { Button } from "../../ui/Button";

interface ChemotherapyFollowupProps {
  followup: ChemotherapyFollowupValue;
  onChange: (followup: ChemotherapyFollowupValue) => void;
  onRemove: () => void;
}

interface ChemoFieldProps {
  children: ReactNode;
  fieldKey: string;
  followup: ChemotherapyFollowupValue;
  full?: boolean;
  label: string;
  onChange: (followup: ChemotherapyFollowupValue) => void;
}

function ChemoField({
  children,
  fieldKey,
  followup,
  full = false,
  label,
  onChange,
}: ChemoFieldProps) {
  return (
    <div className={`v2-chemo-field${full ? " is-full" : ""}`}>
      <strong>{label}</strong>
      {children}
      <details className="v2-bundle-field__note">
        <summary>欄位備註</summary>
        <textarea
          aria-label={`化療副作用 ${label} 備註`}
          rows={1}
          value={followup.notes[fieldKey] ?? ""}
          onChange={(event) =>
            onChange({
              ...followup,
              notes: { ...followup.notes, [fieldKey]: event.target.value },
            })
          }
        />
      </details>
    </div>
  );
}

interface CycleControlProps {
  field: ChemoCycleField;
  followup: ChemotherapyFollowupValue;
  label: string;
  onChange: (followup: ChemotherapyFollowupValue) => void;
}

function CycleControl({ field, followup, label, onChange }: CycleControlProps) {
  const current = followup[field];
  const tone = chemotherapyOptionTone(field, current);
  return (
    <Button
      aria-label={`化療副作用 ${label}：${current || "未評估"}`}
      className={tone ? `is-${tone}` : ""}
      data-testid={`chemo-cycle-${field}`}
      onClick={() =>
        onChange({
          ...followup,
          [field]: cycleChemotherapyValue(current, field),
        })
      }
    >
      {current || "— 未評估 —"}
    </Button>
  );
}

interface MultiControlProps {
  field: ChemoMultiField;
  followup: ChemotherapyFollowupValue;
  label: string;
  onChange: (followup: ChemotherapyFollowupValue) => void;
}

function MultiControl({ field, followup, label, onChange }: MultiControlProps) {
  const options =
    field === "flags"
      ? CHEMO_FLAGS.map((value) => ({ value, tone: "danger" as const }))
      : (CHEMO_MULTI[field]?.options ?? []);
  return (
    <div aria-label={`化療副作用 ${label}`} className="v2-chemo-options" role="group">
      {options.map((option) => {
        const selected = followup[field].includes(option.value);
        return (
          <Button
            aria-pressed={selected}
            className={selected ? `is-selected is-${option.tone || "plain"}` : ""}
            key={option.value}
            onClick={() =>
              onChange({
                ...followup,
                [field]: toggleChemotherapyMultiValue(
                  followup[field],
                  option.value,
                  field,
                ),
              })
            }
          >
            {option.value}
          </Button>
        );
      })}
    </div>
  );
}

interface NeuropathyMatrixProps {
  followup: ChemotherapyFollowupValue;
  onChange: (followup: ChemotherapyFollowupValue) => void;
}

function NeuropathyMatrix({ followup, onChange }: NeuropathyMatrixProps) {
  return (
    <div className="v2-chemo-neuropathy">
      <div className="v2-chemo-neuropathy__status">
        <Button
          aria-label={`周邊神經狀態：${followup.neuropathyStatus || "未評估"}`}
          className={
            followup.neuropathyStatus === "無明顯異常 None"
              ? "is-norm"
              : followup.neuropathyStatus === "有異常 Present"
                ? "is-warn"
                : ""
          }
          data-testid="chemo-neuropathy-status"
          onClick={() => onChange(cycleNeuropathyStatus(followup))}
        >
          {followup.neuropathyStatus || "— 未評估 —"}
        </Button>
        <span>可依四肢分別勾選多種異常；精細動作與步態影響亦可同時存在</span>
      </div>
      <div className="v2-chemo-neuropathy__scroll">
        <div className="v2-chemo-neuropathy__matrix">
          <div className="v2-chemo-neuropathy__row is-header">
            <span>異常種類</span>
            {NEUROPATHY_SITES.map((site) => (
              <span key={site.key}>{site.label}</span>
            ))}
          </div>
          {NEUROPATHY_ROWS.map((row) => (
            <div className="v2-chemo-neuropathy__row" key={row.key}>
              <span>{row.label}</span>
              {NEUROPATHY_SITES.map((site) => {
                const disabled =
                  row.sites !== undefined && !row.sites.includes(site.key);
                const selected = (followup.neuropathyMatrix[row.key] ?? []).includes(
                  site.key,
                );
                return (
                  <Button
                    aria-label={`${row.label}${site.label}`}
                    aria-pressed={selected}
                    className={selected ? "is-selected" : ""}
                    data-testid={`chemo-neuro-${row.key}-${site.key}`}
                    disabled={disabled}
                    key={site.key}
                    onClick={() =>
                      onChange(toggleNeuropathyCell(followup, row.key, site.key))
                    }
                  >
                    {selected ? "✓" : ""}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChemotherapyFollowup({
  followup,
  onChange,
  onRemove,
}: ChemotherapyFollowupProps) {
  const treatmentDay = calculateChemotherapyDay(followup.chemoDate, new Date());
  const temperature = chemotherapyTemperatureState(followup.temperature);

  return (
    <details className="v2-bundle-card v2-chemo" data-testid="bundle-chemo" open>
      <summary>組套 · 化療／標靶治療副作用</summary>
      <div className="v2-bundle-card__body">
        <div className="v2-bundle-card__remove">
          <Button onClick={onRemove} tone="ghost">
            刪除組套
          </Button>
        </div>
        <div className="v2-chemo-grid">
          <ChemoField
            fieldKey="regimen"
            followup={followup}
            full
            label="療程"
            onChange={onChange}
          >
            <textarea
              aria-label="化療副作用 療程"
              placeholder="Regimen / Cycle / 標靶藥物"
              rows={1}
              value={followup.regimen}
              onChange={(event) =>
                onChange({ ...followup, regimen: event.target.value })
              }
            />
          </ChemoField>
          <ChemoField
            fieldKey="chemoDate"
            followup={followup}
            full
            label="日期／Day"
            onChange={onChange}
          >
            <div className="v2-bundle-date">
              <input
                aria-label="化療副作用 治療日期"
                type="date"
                value={followup.chemoDate}
                onChange={(event) =>
                  onChange({ ...followup, chemoDate: event.target.value })
                }
              />
              <span className={`is-${treatmentDay.status}`} data-testid="chemo-day">
                {treatmentDay.text}
              </span>
            </div>
          </ChemoField>
          <ChemoField
            fieldKey="temperature"
            followup={followup}
            full
            label="體溫"
            onChange={onChange}
          >
            <div className="v2-chemo-temperature">
              <input
                aria-label="化療副作用 體溫"
                inputMode="decimal"
                max={43}
                min={34}
                placeholder="體溫 °C"
                step={0.1}
                type="number"
                value={followup.temperature}
                onChange={(event) =>
                  onChange({ ...followup, temperature: event.target.value })
                }
              />
              <span className={`is-${temperature.tone}`}>{temperature.label}</span>
            </div>
          </ChemoField>
          <ChemoField
            fieldKey="nauseaSymptoms"
            followup={followup}
            full
            label="噁心嘔吐"
            onChange={onChange}
          >
            <MultiControl
              field="nauseaSymptoms"
              followup={followup}
              label="噁心嘔吐"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="giImpact"
            followup={followup}
            label="腸胃影響"
            onChange={onChange}
          >
            <CycleControl
              field="giImpact"
              followup={followup}
              label="腸胃影響"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="intakeImpact"
            followup={followup}
            label="進食程度"
            onChange={onChange}
          >
            <CycleControl
              field="intakeImpact"
              followup={followup}
              label="進食程度"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="oralSymptoms"
            followup={followup}
            full
            label="口腔症狀"
            onChange={onChange}
          >
            <MultiControl
              field="oralSymptoms"
              followup={followup}
              label="口腔症狀"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="bowelSymptoms"
            followup={followup}
            full
            label="排便／腹部"
            onChange={onChange}
          >
            <MultiControl
              field="bowelSymptoms"
              followup={followup}
              label="排便／腹部"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="fatigue"
            followup={followup}
            full
            label="疲倦／活動"
            onChange={onChange}
          >
            <CycleControl
              field="fatigue"
              followup={followup}
              label="疲倦／活動"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="neuropathySymptoms"
            followup={followup}
            full
            label="周邊神經"
            onChange={onChange}
          >
            <NeuropathyMatrix followup={followup} onChange={onChange} />
          </ChemoField>
          <ChemoField
            fieldKey="skinFindings"
            followup={followup}
            full
            label="皮膚／管路"
            onChange={onChange}
          >
            <MultiControl
              field="skinFindings"
              followup={followup}
              label="皮膚／管路"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="infectionSigns"
            followup={followup}
            full
            label="感染徵象"
            onChange={onChange}
          >
            <MultiControl
              field="infectionSigns"
              followup={followup}
              label="感染徵象"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="bleedingSigns"
            followup={followup}
            full
            label="出血徵象"
            onChange={onChange}
          >
            <MultiControl
              field="bleedingSigns"
              followup={followup}
              label="出血徵象"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="labs"
            followup={followup}
            full
            label="CBC／ANC"
            onChange={onChange}
          >
            <textarea
              aria-label="化療副作用 CBC／ANC"
              placeholder="WBC / ANC / Hb / Plt；必要時 Cr、LFT"
              rows={1}
              value={followup.labs}
              onChange={(event) => onChange({ ...followup, labs: event.target.value })}
            />
          </ChemoField>
          <ChemoField
            fieldKey="flags"
            followup={followup}
            full
            label="需立即注意"
            onChange={onChange}
          >
            <MultiControl
              field="flags"
              followup={followup}
              label="需立即注意"
              onChange={onChange}
            />
          </ChemoField>
          <ChemoField
            fieldKey="plan"
            followup={followup}
            full
            label="處置／Plan"
            onChange={onChange}
          >
            <textarea
              aria-label="化療副作用 處置／Plan"
              placeholder="補液、止吐、培養、抗生素、追蹤抽血或回診…"
              rows={1}
              value={followup.plan}
              onChange={(event) => onChange({ ...followup, plan: event.target.value })}
            />
          </ChemoField>
        </div>
      </div>
    </details>
  );
}
