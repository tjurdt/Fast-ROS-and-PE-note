import type { ReactNode } from "react";

import { calculatePostoperativeDay } from "../../domain/calendar-day";
import {
  POSTOP_MULTI,
  createPostopDrain,
  cyclePostopValue,
  postoperativeOptionTone,
  togglePostopMultiValue,
  type PostopDrain,
  type PostopMultiField,
  type PostopStringField,
  type PostoperativeCare as PostoperativeCareValue,
} from "../../domain/postoperative-care";
import { Button } from "../../ui/Button";

interface PostoperativeCareProps {
  care: PostoperativeCareValue;
  createId: () => string;
  onChange: (care: PostoperativeCareValue) => void;
  onRemove: () => void;
}

interface PostopFieldProps {
  care: PostoperativeCareValue;
  children: ReactNode;
  fieldKey: string;
  full?: boolean;
  label: string;
  onChange: (care: PostoperativeCareValue) => void;
}

function PostopField({
  care,
  children,
  fieldKey,
  full = false,
  label,
  onChange,
}: PostopFieldProps) {
  return (
    <div className={`v2-postop-field${full ? " is-full" : ""}`}>
      <strong>{label}</strong>
      {children}
      <details className="v2-bundle-field__note">
        <summary>欄位備註</summary>
        <textarea
          aria-label={`術後照護 ${label} 備註`}
          rows={1}
          value={care.notes[fieldKey] ?? ""}
          onChange={(event) =>
            onChange({
              ...care,
              notes: { ...care.notes, [fieldKey]: event.target.value },
            })
          }
        />
      </details>
    </div>
  );
}

interface CycleControlProps {
  care: PostoperativeCareValue;
  cycleKey: string;
  fieldKey: PostopStringField;
  label: string;
  onChange: (care: PostoperativeCareValue) => void;
}

function CycleControl({
  care,
  cycleKey,
  fieldKey,
  label,
  onChange,
}: CycleControlProps) {
  const current = care[fieldKey];
  const tone = postoperativeOptionTone(cycleKey, current, "cycle");
  return (
    <Button
      aria-label={`術後照護 ${label}：${current || "未評估"}`}
      className={tone ? `is-${tone}` : ""}
      data-testid={`postop-cycle-${fieldKey}`}
      onClick={() =>
        onChange({
          ...care,
          [fieldKey]: cyclePostopValue(current, cycleKey),
        })
      }
    >
      {current || "— 未評估 —"}
    </Button>
  );
}

interface MultiControlProps {
  care: PostoperativeCareValue;
  fieldKey: PostopMultiField;
  label: string;
  onChange: (care: PostoperativeCareValue) => void;
}

function MultiControl({ care, fieldKey, label, onChange }: MultiControlProps) {
  const definition = POSTOP_MULTI[fieldKey];
  if (!definition) return null;
  return (
    <div aria-label={`術後照護 ${label}`} className="v2-postop-options" role="group">
      {definition.options.map((option) => {
        const selected = care[fieldKey].includes(option.value);
        return (
          <Button
            aria-pressed={selected}
            className={selected ? `is-selected is-${option.tone || "plain"}` : ""}
            key={option.value}
            onClick={() =>
              onChange({
                ...care,
                [fieldKey]: togglePostopMultiValue(
                  care[fieldKey],
                  option.value,
                  fieldKey,
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

interface DrainCardProps {
  drain: PostopDrain;
  index: number;
  onChange: (drain: PostopDrain) => void;
  onRemove: () => void;
}

function DrainCard({ drain, index, onChange, onRemove }: DrainCardProps) {
  function setText(key: "site" | "amount" | "note", value: string): void {
    onChange({ ...drain, [key]: value });
  }

  function drainCycle(fieldKey: "period" | "patency", cycleKey: string) {
    onChange({
      ...drain,
      [fieldKey]: cyclePostopValue(drain[fieldKey], cycleKey),
    });
  }

  function drainMulti(
    fieldKey: "characterFindings" | "surroundFindings",
    definitionKey: "drainCharacter" | "drainSurround",
    value: string,
  ) {
    onChange({
      ...drain,
      [fieldKey]: togglePostopMultiValue(drain[fieldKey], value, definitionKey),
    });
  }

  return (
    <section className="v2-postop-drain" data-testid={`postop-drain-${index + 1}`}>
      <header>
        <strong>Drain {index + 1}</strong>
        <Button onClick={onRemove} tone="ghost">
          刪除
        </Button>
      </header>
      <div className="v2-postop-drain__grid">
        <label className="is-full">
          種類／位置
          <textarea
            aria-label={`Drain ${index + 1} 種類位置`}
            placeholder="例：JP, RUQ"
            rows={1}
            value={drain.site}
            onChange={(event) => setText("site", event.target.value)}
          />
        </label>
        <label>
          量
          <input
            aria-label={`Drain ${index + 1} 量`}
            min={0}
            placeholder="mL"
            type="number"
            value={drain.amount}
            onChange={(event) => setText("amount", event.target.value)}
          />
        </label>
        <div className="v2-postop-drain__field">
          <span>期間</span>
          <Button
            aria-label={`Drain ${index + 1} 期間：${drain.period || "未評估"}`}
            data-testid={`postop-drain-${index + 1}-period`}
            onClick={() => drainCycle("period", "drainPeriod")}
          >
            {drain.period || "— 未評估 —"}
          </Button>
        </div>
        <fieldset className="is-full">
          <legend>顏色／性狀（可複選）</legend>
          <div className="v2-postop-options">
            {POSTOP_MULTI.drainCharacter?.options.map((option) => (
              <Button
                aria-pressed={drain.characterFindings.includes(option.value)}
                className={
                  drain.characterFindings.includes(option.value)
                    ? `is-selected is-${option.tone || "plain"}`
                    : ""
                }
                key={option.value}
                onClick={() =>
                  drainMulti("characterFindings", "drainCharacter", option.value)
                }
              >
                {option.value}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="v2-postop-drain__field">
          <span>通暢</span>
          <Button
            aria-label={`Drain ${index + 1} 通暢：${drain.patency || "未評估"}`}
            className={
              drain.patency
                ? `is-${postoperativeOptionTone("drainPatency", drain.patency, "cycle")}`
                : ""
            }
            data-testid={`postop-drain-${index + 1}-patency`}
            onClick={() => drainCycle("patency", "drainPatency")}
          >
            {drain.patency || "— 未評估 —"}
          </Button>
        </div>
        <fieldset className="is-full">
          <legend>周圍狀況（可複選）</legend>
          <div className="v2-postop-options">
            {POSTOP_MULTI.drainSurround?.options.map((option) => (
              <Button
                aria-pressed={drain.surroundFindings.includes(option.value)}
                className={
                  drain.surroundFindings.includes(option.value)
                    ? `is-selected is-${option.tone || "plain"}`
                    : ""
                }
                key={option.value}
                onClick={() =>
                  drainMulti("surroundFindings", "drainSurround", option.value)
                }
              >
                {option.value}
              </Button>
            ))}
          </div>
        </fieldset>
        <label className="is-full">
          註記
          <textarea
            aria-label={`Drain ${index + 1} 註記`}
            placeholder="趨勢、氣味、漏液或拔除條件…"
            rows={1}
            value={drain.note}
            onChange={(event) => setText("note", event.target.value)}
          />
        </label>
      </div>
    </section>
  );
}

export function PostoperativeCare({
  care,
  createId,
  onChange,
  onRemove,
}: PostoperativeCareProps) {
  const pod = calculatePostoperativeDay(care.surgeryDate, new Date());
  const assessedPain = care.pain !== "" && Number.isFinite(Number(care.pain));
  const pain = assessedPain ? Math.max(0, Math.min(10, Number(care.pain))) : 0;
  const cycleFields: readonly {
    key: PostopStringField;
    label: string;
    cycle: string;
  }[] = [
    { key: "vitals", label: "循環", cycle: "vitals" },
    { key: "fever", label: "發燒", cycle: "fever" },
    { key: "oralDiet", label: "口服飲食", cycle: "oralDiet" },
    { key: "activity", label: "活動", cycle: "activity" },
    { key: "flatus", label: "排氣", cycle: "flatus" },
    { key: "voidingMethod", label: "排尿方式", cycle: "voidingMethod" },
    {
      key: "respiratorySupport",
      label: "呼吸支持",
      cycle: "respiratorySupport",
    },
  ];
  const multiFields: readonly { key: PostopMultiField; label: string }[] = [
    { key: "nutritionSupport", label: "營養支持" },
    { key: "nauseaSymptoms", label: "噁心嘔吐" },
    { key: "urinaryConcerns", label: "排尿異常" },
    { key: "respiratoryConcerns", label: "呼吸問題" },
    { key: "woundFindings", label: "傷口" },
    { key: "vteMeasures", label: "VTE 預防" },
    { key: "redFlags", label: "術後警訊" },
  ];

  return (
    <details className="v2-bundle-card v2-postop" data-testid="bundle-postop" open>
      <summary>組套 · 外科術後照護 Postoperative care</summary>
      <div className="v2-bundle-card__body">
        <button className="v2-bundle-card__delete" onClick={onRemove} type="button">
          ✕ 刪除
        </button>
        <div className="v2-postop-grid">
          <PostopField
            care={care}
            fieldKey="surgery"
            full
            label="手術"
            onChange={onChange}
          >
            <textarea
              aria-label="術後照護 手術"
              placeholder="手術種類／Procedure"
              rows={1}
              value={care.surgery}
              onChange={(event) => onChange({ ...care, surgery: event.target.value })}
            />
          </PostopField>
          <PostopField
            care={care}
            fieldKey="surgeryDate"
            full
            label="日期／POD"
            onChange={onChange}
          >
            <div className="v2-bundle-date">
              <input
                aria-label="術後照護 手術日期"
                type="date"
                value={care.surgeryDate}
                onChange={(event) =>
                  onChange({ ...care, surgeryDate: event.target.value })
                }
              />
              <span className={`is-${pod.status}`} data-testid="postop-pod">
                {pod.text}
              </span>
            </div>
          </PostopField>
          <PostopField
            care={care}
            fieldKey="pain"
            full
            label="疼痛"
            onChange={onChange}
          >
            <div className="v2-lqq__severity">
              <input
                aria-label="術後照護 疼痛"
                max={10}
                min={0}
                type="range"
                value={pain}
                onChange={(event) => onChange({ ...care, pain: event.target.value })}
              />
              <output className={pain >= 7 ? "is-warning" : ""}>
                {assessedPain ? `${pain} /10` : "—"}
              </output>
              <Button onClick={() => onChange({ ...care, pain: "" })} tone="ghost">
                清除
              </Button>
            </div>
          </PostopField>

          {cycleFields.slice(0, 3).map((field) => (
            <PostopField
              care={care}
              fieldKey={field.key}
              key={field.key}
              label={field.label}
              onChange={onChange}
            >
              <CycleControl
                care={care}
                cycleKey={field.cycle}
                fieldKey={field.key}
                label={field.label}
                onChange={onChange}
              />
            </PostopField>
          ))}
          {multiFields.slice(0, 2).map((field) => (
            <PostopField
              care={care}
              fieldKey={field.key}
              full={field.key === "nauseaSymptoms"}
              key={field.key}
              label={field.label}
              onChange={onChange}
            >
              <MultiControl
                care={care}
                fieldKey={field.key}
                label={field.label}
                onChange={onChange}
              />
            </PostopField>
          ))}
          {cycleFields.slice(3).map((field) => (
            <PostopField
              care={care}
              fieldKey={field.key}
              key={field.key}
              label={field.label}
              onChange={onChange}
            >
              <CycleControl
                care={care}
                cycleKey={field.cycle}
                fieldKey={field.key}
                label={field.label}
                onChange={onChange}
              />
            </PostopField>
          ))}
          {multiFields.slice(2).map((field) => (
            <PostopField
              care={care}
              fieldKey={field.key}
              full
              key={field.key}
              label={field.label}
              onChange={onChange}
            >
              <MultiControl
                care={care}
                fieldKey={field.key}
                label={field.label}
                onChange={onChange}
              />
            </PostopField>
          ))}
          <PostopField
            care={care}
            fieldKey="plan"
            full
            label="今日計畫"
            onChange={onChange}
          >
            <textarea
              aria-label="術後照護 今日計畫"
              placeholder="檢查、拔管、進食、活動或出院目標…"
              rows={1}
              value={care.plan}
              onChange={(event) => onChange({ ...care, plan: event.target.value })}
            />
          </PostopField>
        </div>

        <div className="v2-postop-drains__header">
          <strong>Drain（可新增多支）</strong>
          <Button
            data-testid="postop-add-drain"
            onClick={() =>
              onChange({
                ...care,
                drains: [...care.drains, createPostopDrain({ createId })],
              })
            }
            tone="primary"
          >
            ＋ 新增
          </Button>
        </div>
        {care.drains.length === 0 ? (
          <p className="v2-workspace-empty">無 Drain；需要時再新增。</p>
        ) : (
          <div className="v2-postop-drains">
            {care.drains.map((drain, index) => (
              <DrainCard
                drain={drain}
                index={index}
                key={drain.id}
                onChange={(next) =>
                  onChange({
                    ...care,
                    drains: care.drains.map((candidate) =>
                      candidate.id === drain.id ? next : candidate,
                    ),
                  })
                }
                onRemove={() =>
                  onChange({
                    ...care,
                    drains: care.drains.filter(
                      (candidate) => candidate.id !== drain.id,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
