import { useState } from "react";

import {
  CURB65_CRITERIA,
  INFECTION_MULTI,
  QSOFA_CRITERIA,
  calculateAntibioticDay,
  createAntibioticCourse,
  cycleAntibioticRoute,
  cycleScoreState,
  infectionScoreAdvice,
  infectionScoreInfo,
  infectionTemperatureState,
  setInfectionScoreState,
  toggleInfectionMultiValue,
  type AntibioticCourse,
  type InfectionRecord,
  type InfectionScoreKind,
  type ScoreState,
} from "../../domain/infection-workup";
import { Button } from "../../ui/Button";

interface InfectionWorkupProps {
  antibioticOptions: string[];
  createId: () => string;
  index: number;
  infection: InfectionRecord;
  onAddCustomAntibiotic: (infection: InfectionRecord, name: string) => void;
  onChange: (infection: InfectionRecord) => void;
  onRemove: () => void;
}

interface ScorePanelProps {
  infection: InfectionRecord;
  kind: InfectionScoreKind;
  onChange: (infection: InfectionRecord) => void;
}

function ScorePanel({ infection, kind, onChange }: ScorePanelProps) {
  const score = infection[kind];
  const criteria = kind === "qsofa" ? QSOFA_CRITERIA : CURB65_CRITERIA;
  const info = infectionScoreInfo(kind, score);
  const advice = infectionScoreAdvice(kind, score);
  const title = kind === "qsofa" ? "qSOFA" : "CURB-65";
  const record = score as unknown as Record<string, unknown>;
  return (
    <details
      className="v2-infection-score"
      onToggle={(event) => {
        const open = event.currentTarget.open;
        if (open !== score.open) {
          onChange({ ...infection, [kind]: { ...score, open } });
        }
      }}
      open={score.open}
    >
      <summary>
        <strong>{title} 評分</strong>
        <span>
          {info.score}/{info.total}
          {info.complete ? "" : " · 待完成"}
        </span>
      </summary>
      <div className="v2-infection-score__body">
        {criteria.map((criterion) => {
          const state = (record[criterion.key] ?? "") as ScoreState;
          const label = state === "yes" ? "是 +1" : state === "no" ? "否 0" : "未評估";
          return (
            <div className="v2-infection-score__row" key={criterion.key}>
              <span>{criterion.label}</span>
              <Button
                aria-label={`${title} ${criterion.label}：${label}`}
                className={state ? `is-${state}` : ""}
                data-testid={`infection-${infection.id}-${kind}-${criterion.key}`}
                onClick={() =>
                  onChange(
                    setInfectionScoreState(
                      infection,
                      kind,
                      criterion.key,
                      cycleScoreState(state),
                    ),
                  )
                }
              >
                {label}
              </Button>
            </div>
          );
        })}
        <p className={advice.tone ? `is-${advice.tone}` : ""}>{advice.text}</p>
        <small>
          {kind === "qsofa"
            ? "僅作床邊風險提示，不取代完整敗血症評估或院內處置流程。"
            : "CURB-65 用於社區型肺炎嚴重度分層，須配合臨床判斷。"}
        </small>
      </div>
    </details>
  );
}

interface MultiOptionsProps {
  field: "sources" | "cultures";
  infection: InfectionRecord;
  label: string;
  onChange: (infection: InfectionRecord) => void;
}

function MultiOptions({ field, infection, label, onChange }: MultiOptionsProps) {
  const definition = INFECTION_MULTI[field];
  if (!definition) return null;
  return (
    <fieldset className="v2-infection-field is-full">
      <legend>{label}</legend>
      <div aria-label={`感染組套 ${label}`} className="v2-bundle-chips" role="group">
        {definition.options.map((option) => {
          const selected = infection[field].includes(option);
          return (
            <Button
              aria-pressed={selected}
              className={selected ? "is-selected" : ""}
              key={option}
              onClick={() =>
                onChange({
                  ...infection,
                  [field]: toggleInfectionMultiValue(infection[field], option, field),
                })
              }
            >
              {option}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface AntibioticRowProps {
  antibiotic: AntibioticCourse;
  index: number;
  options: string[];
  onChange: (antibiotic: AntibioticCourse) => void;
  onRemove: () => void;
}

function AntibioticRow({
  antibiotic,
  index,
  options,
  onChange,
  onRemove,
}: AntibioticRowProps) {
  const day = calculateAntibioticDay(antibiotic.startDate, new Date());
  const drugOptions = antibiotic.drug
    ? [...new Set([...options, antibiotic.drug])]
    : options;
  return (
    <section className="v2-antibiotic" data-testid={`antibiotic-${index + 1}`}>
      <header>
        <strong>抗生素 {index + 1}</strong>
        <Button onClick={onRemove} tone="ghost">
          刪除
        </Button>
      </header>
      <div className="v2-antibiotic__grid">
        <label>
          藥物
          <select
            aria-label={`抗生素 ${index + 1} 藥物`}
            value={antibiotic.drug}
            onChange={(event) => onChange({ ...antibiotic, drug: event.target.value })}
          >
            <option value="">— 選擇 —</option>
            {drugOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          開始使用日
          <div className="v2-bundle-date">
            <input
              aria-label={`抗生素 ${index + 1} 開始使用日`}
              type="date"
              value={antibiotic.startDate}
              onChange={(event) =>
                onChange({ ...antibiotic, startDate: event.target.value })
              }
            />
            <span data-testid={`antibiotic-${index + 1}-day`}>{day.text}</span>
          </div>
        </label>
        <div className="v2-antibiotic__field">
          <span>給藥方式（循環點選，可回未定）</span>
          <Button
            aria-label={`抗生素 ${index + 1} 給藥方式：${antibiotic.route || "未定"}`}
            data-testid={`antibiotic-${index + 1}-route`}
            onClick={() =>
              onChange({
                ...antibiotic,
                route: cycleAntibioticRoute(antibiotic.route),
              })
            }
          >
            {antibiotic.route || "— 未定 —"}
          </Button>
        </div>
        <label>
          劑量／頻次／註記
          <textarea
            aria-label={`抗生素 ${index + 1} 劑量頻次註記`}
            placeholder="例：4.5 g q8h；renal dose adjusted"
            rows={1}
            value={antibiotic.note}
            onChange={(event) => onChange({ ...antibiotic, note: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

export function InfectionWorkup({
  antibioticOptions,
  createId,
  index,
  infection,
  onAddCustomAntibiotic,
  onChange,
  onRemove,
}: InfectionWorkupProps) {
  const [customAntibiotic, setCustomAntibiotic] = useState("");
  const temperatureState = infectionTemperatureState(infection.temperature);

  function updateAntibiotic(id: string, next: AntibioticCourse) {
    onChange({
      ...infection,
      antibiotics: infection.antibiotics.map((candidate) =>
        candidate.id === id ? next : candidate,
      ),
    });
  }

  return (
    <details
      className="v2-bundle-card v2-infection"
      data-testid={`infection-${index + 1}`}
      onToggle={(event) => {
        const collapsed = !event.currentTarget.open;
        if (collapsed !== infection.collapsed) onChange({ ...infection, collapsed });
      }}
      open={!infection.collapsed}
    >
      <summary>
        感染／敗血症 Sepsis workup · {infection.name.trim() || `#${index + 1}`}
      </summary>
      <div className="v2-bundle-card__body">
        <div className="v2-bundle-card__actions">
          <label>
            感染項目
            <textarea
              aria-label={`感染組套 ${index + 1} 名稱`}
              placeholder="例：肺炎 Pneumonia"
              rows={1}
              value={infection.name}
              onChange={(event) => onChange({ ...infection, name: event.target.value })}
            />
          </label>
          <Button onClick={onRemove} tone="ghost">
            刪除組套
          </Button>
        </div>

        <div className="v2-infection-grid">
          <div className="v2-infection-field">
            <strong>qSOFA</strong>
            <ScorePanel infection={infection} kind="qsofa" onChange={onChange} />
          </div>
          <label className="v2-infection-field">
            <strong>體溫</strong>
            <div className="v2-infection-temperature">
              <input
                aria-label={`感染組套 ${index + 1} 體溫`}
                inputMode="decimal"
                max={45}
                min={30}
                placeholder="體溫 °C"
                step={0.1}
                type="number"
                value={infection.temperature}
                onChange={(event) =>
                  onChange({ ...infection, temperature: event.target.value })
                }
              />
              <span className={`is-${temperatureState.tone}`}>
                {temperatureState.label}
              </span>
            </div>
          </label>
          <MultiOptions
            field="sources"
            infection={infection}
            label="感染源評估"
            onChange={onChange}
          />
          <MultiOptions
            field="cultures"
            infection={infection}
            label="已送培養"
            onChange={onChange}
          />
          <div className="v2-infection-field is-full">
            <strong>CURB-65</strong>
            <ScorePanel infection={infection} kind="curb65" onChange={onChange} />
          </div>
        </div>

        <div className="v2-infection-antibiotics__header">
          <strong>抗生素（可新增多筆）</strong>
          <Button
            data-testid={`infection-${index + 1}-add-antibiotic`}
            onClick={() =>
              onChange({
                ...infection,
                antibiotics: [
                  ...infection.antibiotics,
                  createAntibioticCourse({ createId }),
                ],
              })
            }
            tone="primary"
          >
            ＋ 新增一列
          </Button>
        </div>
        {infection.antibiotics.length === 0 ? (
          <p className="v2-workspace-empty">尚無抗生素紀錄。</p>
        ) : (
          <div className="v2-infection-antibiotics">
            {infection.antibiotics.map((antibiotic, antibioticIndex) => (
              <AntibioticRow
                antibiotic={antibiotic}
                index={antibioticIndex}
                key={antibiotic.id}
                onChange={(next) => updateAntibiotic(antibiotic.id, next)}
                onRemove={() =>
                  onChange({
                    ...infection,
                    antibiotics: infection.antibiotics.filter(
                      (candidate) => candidate.id !== antibiotic.id,
                    ),
                  })
                }
                options={antibioticOptions}
              />
            ))}
          </div>
        )}

        <div className="v2-infection-custom-antibiotic">
          <input
            aria-label={`感染組套 ${index + 1} 自訂抗生素`}
            placeholder="新增自訂抗生素名稱（會加入選單）"
            value={customAntibiotic}
            onChange={(event) => setCustomAntibiotic(event.target.value)}
          />
          <Button
            onClick={() => {
              const name = customAntibiotic.trim();
              if (!name) return;
              onAddCustomAntibiotic(
                {
                  ...infection,
                  antibiotics: [
                    ...infection.antibiotics,
                    createAntibioticCourse({ createId }, name),
                  ],
                },
                name,
              );
              setCustomAntibiotic("");
            }}
          >
            加入選單
          </Button>
        </div>
        <textarea
          aria-label={`感染組套 ${index + 1} 整體註記`}
          className="v2-infection-note"
          placeholder="感染組套整體註記…"
          rows={1}
          value={infection.note}
          onChange={(event) => onChange({ ...infection, note: event.target.value })}
        />
      </div>
    </details>
  );
}
