import {
  nextCycleValue,
  SENSORY_CHANGE_OPTIONS,
  SENSORY_MODALITY_OPTIONS,
  SENSORY_PATTERN_OPTIONS,
  SENSORY_SIDE_OPTIONS,
  SENSORY_STATUS_OPTIONS,
  type FindingValue,
  type SensoryFinding,
  type SensoryState,
} from "../../domain/clinical/finding";
import { Button } from "../../ui/Button";

interface SensoryWidgetProps {
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}

let sensoryFindingSequence = 0;

function createSensoryFinding(): SensoryFinding {
  sensoryFindingSequence += 1;
  return {
    id: `sf-${Date.now().toString(36)}-${sensoryFindingSequence.toString(36)}`,
    side: "",
    change: "",
    pattern: "",
    modalities: [],
    location: "",
    note: "",
  };
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="v2-sensory-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SensoryWidget({ finding, onChange }: SensoryWidgetProps) {
  const sensory: SensoryState = finding.sensory ?? {
    status: finding.sel ?? "",
    findings: [],
  };
  const abnormal = sensory.status === "異常 Abnormal";
  const commit = (next: SensoryState) => onChange({ ...finding, sensory: next });
  const updateEntry = (index: number, patch: Partial<SensoryFinding>) =>
    commit({
      ...sensory,
      findings: sensory.findings.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    });

  function updateStatus() {
    const status = nextCycleValue(SENSORY_STATUS_OPTIONS, sensory.status);
    commit({
      ...sensory,
      status,
      findings:
        status === "異常 Abnormal" && sensory.findings.length === 0
          ? [createSensoryFinding()]
          : sensory.findings,
    });
  }

  function addEntry() {
    commit({
      ...sensory,
      status: "異常 Abnormal",
      findings: [...sensory.findings, createSensoryFinding()],
    });
  }

  return (
    <div className="v2-sensory" data-testid="sensory-widget">
      <div className="v2-sensory__top">
        <Button
          aria-label={`感覺狀態：${sensory.status || "未評估"}`}
          className={`v2-cycle ${abnormal ? "is-positive" : sensory.status ? "is-normal" : ""}`}
          data-testid="sensory-status"
          onClick={updateStatus}
        >
          {sensory.status || "未評估"}
        </Button>
        <span>異常時可分筆記錄側別、性質、模態與分布。</span>
        <Button className="v2-sensory__add" onClick={addEntry} tone="primary">
          ＋ 新增異常
        </Button>
      </div>

      {abnormal ? (
        <div className="v2-sensory__list">
          {sensory.findings.length === 0 ? (
            <p className="v2-sensory__empty">尚無異常紀錄。</p>
          ) : null}
          {sensory.findings.map((entry, index) => (
            <section className="v2-sensory-entry" key={entry.id || index}>
              <div className="v2-sensory-entry__header">
                <strong>異常 {index + 1}</strong>
                <Button
                  aria-label={`刪除感覺異常 ${index + 1}`}
                  className="v2-sensory__delete"
                  onClick={() =>
                    commit({
                      ...sensory,
                      findings: sensory.findings.filter(
                        (_candidate, candidateIndex) => candidateIndex !== index,
                      ),
                    })
                  }
                >
                  刪除
                </Button>
              </div>
              <div className="v2-sensory-entry__grid">
                <SelectField
                  label="側別 / 部位"
                  options={SENSORY_SIDE_OPTIONS}
                  value={entry.side}
                  onChange={(value) => updateEntry(index, { side: value })}
                />
                <SelectField
                  label="異常性質"
                  options={SENSORY_CHANGE_OPTIONS}
                  value={entry.change}
                  onChange={(value) => updateEntry(index, { change: value })}
                />
                <SelectField
                  label="分布型態"
                  options={SENSORY_PATTERN_OPTIONS}
                  value={entry.pattern}
                  onChange={(value) => updateEntry(index, { pattern: value })}
                />
                <fieldset className="v2-sensory-field v2-sensory-field--full">
                  <legend>感覺模態（可複選）</legend>
                  <div className="v2-choice-chips">
                    {SENSORY_MODALITY_OPTIONS.map((modality) => {
                      const selected = entry.modalities.includes(modality);
                      return (
                        <Button
                          aria-pressed={selected}
                          className={selected ? "is-selected" : ""}
                          key={modality}
                          onClick={() =>
                            updateEntry(index, {
                              modalities: selected
                                ? entry.modalities.filter((value) => value !== modality)
                                : [...entry.modalities, modality],
                            })
                          }
                        >
                          {modality}
                        </Button>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="v2-sensory-field v2-sensory-field--full">
                  <span>精確分布 / 皮節 / 周邊神經</span>
                  <textarea
                    aria-label={`感覺異常 ${index + 1} 精確分布`}
                    placeholder="例：左 L4 輕觸減退；左 S1 震動覺消失"
                    rows={1}
                    value={entry.location}
                    onChange={(event) =>
                      updateEntry(index, { location: event.target.value })
                    }
                  />
                </label>
                <label className="v2-sensory-field v2-sensory-field--full">
                  <span>此筆註記</span>
                  <textarea
                    aria-label={`感覺異常 ${index + 1} 註記`}
                    placeholder="比較基準、遠近端差異、檢查限制…"
                    rows={1}
                    value={entry.note}
                    onChange={(event) =>
                      updateEntry(index, { note: event.target.value })
                    }
                  />
                </label>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
