import type { LqqEntry } from "../../domain/bundles";
import { LQQ_ONSETS, LQQ_QUALITIES } from "../../domain/bundles";
import { Button } from "../../ui/Button";

interface LqqBundleProps {
  entry: LqqEntry;
  index: number;
  onChange: (entry: LqqEntry) => void;
  onRemove: () => void;
}

type TextField = "name" | "L" | "qnote" | "onsetText" | "P" | "E" | "R" | "A";

const TEXT_FIELDS: readonly {
  key: Exclude<TextField, "name" | "qnote" | "onsetText">;
  label: string;
  placeholder: string;
}[] = [
  { key: "L", label: "L｜位置 Location", placeholder: "部位／位置" },
  { key: "P", label: "P｜誘發／加重 Provoke", placeholder: "加重因素" },
  { key: "E", label: "E｜緩解 Ease", placeholder: "緩解因素" },
  { key: "R", label: "R｜放射 Radiation", placeholder: "放射部位" },
  { key: "A", label: "A｜伴隨 Associated", placeholder: "伴隨症狀" },
];

export function LqqBundle({ entry, index, onChange, onRemove }: LqqBundleProps) {
  function setText(field: TextField, value: string) {
    onChange({ ...entry, [field]: value });
  }

  function toggleQuality(quality: string) {
    onChange({
      ...entry,
      quality: entry.quality.includes(quality)
        ? entry.quality.filter((value) => value !== quality)
        : [...entry.quality, quality],
    });
  }

  return (
    <details className="v2-bundle-card v2-lqq" open data-testid={`lqq-${entry.id}`}>
      <summary>
        症狀分析 LQQOPERA · {entry.name.trim() || `未命名 ${index + 1}`}
      </summary>
      <div className="v2-bundle-card__body">
        <button className="v2-bundle-card__delete" onClick={onRemove} type="button">
          ✕ 刪除
        </button>
        <label className="v2-bundle-field">
          <span>症狀名稱</span>
          <textarea
            aria-label={`症狀分析 ${index + 1} 名稱`}
            rows={1}
            placeholder="例：胸痛 Chest pain"
            value={entry.name}
            onChange={(event) => setText("name", event.target.value)}
          />
        </label>

        {TEXT_FIELDS.slice(0, 1).map((field) => (
          <label className="v2-bundle-field" key={field.key}>
            <span>{field.label}</span>
            <textarea
              aria-label={`症狀分析 ${index + 1} ${field.label}`}
              rows={1}
              placeholder={field.placeholder}
              value={entry[field.key]}
              onChange={(event) => setText(field.key, event.target.value)}
            />
          </label>
        ))}

        <fieldset className="v2-bundle-field">
          <legend>Q｜性質 Quality</legend>
          <div className="v2-bundle-chips">
            {LQQ_QUALITIES.map((quality) => (
              <Button
                aria-pressed={entry.quality.includes(quality)}
                className={entry.quality.includes(quality) ? "is-selected" : ""}
                key={quality}
                onClick={() => toggleQuality(quality)}
              >
                {quality}
              </Button>
            ))}
          </div>
          <textarea
            aria-label={`症狀分析 ${index + 1} 其他性質描述`}
            rows={1}
            placeholder="其他性質描述"
            value={entry.qnote}
            onChange={(event) => setText("qnote", event.target.value)}
          />
        </fieldset>

        <label className="v2-bundle-field">
          <span>Q｜嚴重度 Severity</span>
          <div className="v2-lqq__severity">
            <input
              aria-label={`症狀分析 ${index + 1} 嚴重度`}
              max={10}
              min={0}
              type="range"
              value={entry.sev ?? 0}
              onChange={(event) =>
                onChange({ ...entry, sev: Number(event.target.value) })
              }
            />
            <output>{entry.sev === null ? "—" : `${entry.sev} /10`}</output>
            <Button onClick={() => onChange({ ...entry, sev: null })} tone="ghost">
              清除
            </Button>
          </div>
        </label>

        <label className="v2-bundle-field">
          <span>O｜發作 Onset</span>
          <select
            aria-label={`症狀分析 ${index + 1} 發作型態`}
            value={entry.onset}
            onChange={(event) => onChange({ ...entry, onset: event.target.value })}
          >
            <option value="">—</option>
            {LQQ_ONSETS.map((onset) => (
              <option key={onset} value={onset}>
                {onset}
              </option>
            ))}
          </select>
          <textarea
            aria-label={`症狀分析 ${index + 1} 發作時間病程`}
            rows={1}
            placeholder="何時開始／病程"
            value={entry.onsetText}
            onChange={(event) => setText("onsetText", event.target.value)}
          />
        </label>

        {TEXT_FIELDS.slice(1).map((field) => (
          <label className="v2-bundle-field" key={field.key}>
            <span>{field.label}</span>
            <textarea
              aria-label={`症狀分析 ${index + 1} ${field.label}`}
              rows={1}
              placeholder={field.placeholder}
              value={entry[field.key]}
              onChange={(event) => setText(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
