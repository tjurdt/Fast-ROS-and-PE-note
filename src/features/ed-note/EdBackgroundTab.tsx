import type { FindingValue } from "../../domain/clinical/finding";
import { composePH, type EdFindings } from "../../domain/ed/compose";
import { PMH_ITEMS } from "../../domain/ed/history-library";
import { edKey, type EdContextKey } from "../../domain/ed/types";
import { Chip, type EdFindingChange } from "./ed-controls";
import { SpecialPicker } from "./SpecialPicker";

const TOCC: readonly { key: "t" | "o" | "c1" | "c2"; label: string }[] = [
  { key: "t", label: "Travel 旅遊" },
  { key: "o", label: "Occupation 職業" },
  { key: "c1", label: "Contact 接觸" },
  { key: "c2", label: "Cluster 群聚" },
];

interface EdBackgroundTabProps {
  findings: EdFindings;
  onChange: EdFindingChange;
  onBulkChange: (patch: Record<string, FindingValue>) => void;
}

export function EdBackgroundTab({
  findings,
  onChange,
  onBulkChange,
}: EdBackgroundTabProps) {
  const ctx = (key: EdContextKey) => findings[edKey.ctx(key)]?.text ?? "";
  const setCtx = (key: EdContextKey, value: string) =>
    onChange(edKey.ctx(key), { text: value });

  const allToccNegative = () => {
    const patch: Record<string, FindingValue> = {};
    for (const { key } of TOCC) patch[edKey.tocc(key)] = { sel: "-" };
    onBulkChange(patch);
  };

  return (
    <section className="v2-card ed-panel" aria-labelledby="ed-background-title">
      <h2 id="ed-background-title">病史・TOCC・過敏（寫進 PH）</h2>

      <h3>過去病史</h3>
      <div className="ed-chips">
        {PMH_ITEMS.map((item) => {
          const finding = findings[edKey.pmh(item.id)] ?? {};
          return (
            <Chip
              active={finding.on === true}
              key={item.id}
              onClick={() =>
                onChange(edKey.pmh(item.id), finding.on ? {} : { ...finding, on: true })
              }
              tone="warning"
            >
              {item.label}
            </Chip>
          );
        })}
      </div>
      {PMH_ITEMS.filter(
        (item) => item.detail && findings[edKey.pmh(item.id)]?.on === true,
      ).map((item) => (
        <label key={item.id}>
          {item.label} 補充
          <input
            aria-label={`${item.label} 補充`}
            onChange={(event) =>
              onChange(edKey.pmh(item.id), { on: true, text: event.target.value })
            }
            placeholder="例 癌別、洗腎方式、手術名稱"
            value={findings[edKey.pmh(item.id)]?.text ?? ""}
          />
        </label>
      ))}
      <p className="ed-help">勾選後會自動追加相關問診題（例如洗腎 → 最後一次透析）。</p>

      <h3>特別情境（寫進 PH）</h3>
      <SpecialPicker findings={findings} onChange={onChange} target="PH" />

      <label>
        目前用藥（抗凝血藥、類固醇、近期新藥等）
        <input
          aria-label="目前用藥"
          onChange={(event) => setCtx("meds", event.target.value)}
          placeholder="例 warfarin, prednisolone"
          value={ctx("meds")}
        />
      </label>

      <h3>藥物過敏</h3>
      <div className="ed-chips">
        <Chip
          active={ctx("allergy") === "nil"}
          onClick={() => setCtx("allergy", ctx("allergy") === "nil" ? "" : "nil")}
        >
          nil（無）
        </Chip>
      </div>
      <label>
        過敏藥物
        <input
          aria-label="過敏藥物"
          onChange={(event) => setCtx("allergy", event.target.value)}
          placeholder="nil 或藥名"
          value={ctx("allergy")}
        />
      </label>

      <h3>TOCC</h3>
      <div className="ed-chips">
        <Chip active={false} onClick={allToccNegative}>
          TOCC 全部無
        </Chip>
      </div>
      {TOCC.map(({ key, label }) => {
        const finding = findings[edKey.tocc(key)] ?? {};
        return (
          <div className="ed-row" key={key}>
            <span className="ed-row__label">{label}</span>
            <span className="ed-row__controls">
              <Chip
                active={finding.sel === "+"}
                label={`${label}：有`}
                onClick={() =>
                  onChange(edKey.tocc(key), finding.sel === "+" ? {} : { sel: "+" })
                }
                tone="warning"
              >
                有
              </Chip>
              <Chip
                active={finding.sel === "-"}
                label={`${label}：無`}
                onClick={() =>
                  onChange(edKey.tocc(key), finding.sel === "-" ? {} : { sel: "-" })
                }
                tone="negative"
              >
                無
              </Chip>
            </span>
            {finding.sel === "+" ? (
              <span className="ed-row__detail">
                <input
                  aria-label={`${label} 細節`}
                  onChange={(event) =>
                    onChange(edKey.tocc(key), { sel: "+", text: event.target.value })
                  }
                  placeholder="細節"
                  value={finding.text ?? ""}
                />
              </span>
            ) : null}
          </div>
        );
      })}

      <div className="ed-preview">
        <strong>PH 預覽</strong>
        <span data-testid="ed-ph-preview">{composePH(findings) || "（尚未填寫）"}</span>
      </div>
    </section>
  );
}
