import type { FindingValue } from "../../domain/clinical/finding";
import { composePH, type EdFindings } from "../../domain/ed/compose";
import { PMH_ITEMS } from "../../domain/ed/history-library";
import { SPECIAL_ITEMS, appendSituation } from "../../domain/ed/special";
import { edKey, type EdContextKey } from "../../domain/ed/types";
import { Chip, CycleChip, type EdFindingChange } from "./ed-controls";

const TOCC: readonly { key: "t" | "o" | "c1" | "c2"; letter: string; label: string }[] =
  [
    { key: "t", letter: "T", label: "Travel 旅遊" },
    { key: "o", letter: "O", label: "Occupation 職業" },
    { key: "c1", letter: "C", label: "Contact 接觸" },
    { key: "c2", letter: "C", label: "Cluster 群聚" },
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
  // 舊版逐項勾選的情境仍會輸出；這裡列出來，讓使用者知道它們還在。
  const legacySituations = SPECIAL_ITEMS.filter(
    (item) => findings[edKey.special(item.id)]?.on === true,
  );

  return (
    <section className="ed-panel" aria-labelledby="ed-background-title">
      <h2 className="ed-sr" id="ed-background-title">
        病史・TOCC・過敏（寫進 PH）
      </h2>

      <div className="ed-grid">
        <span className="ed-grid__label">病史</span>
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
        <label className="ed-line" key={item.id}>
          <span>{item.label}</span>
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

      <label className="ed-line">
        <span>用藥</span>
        <input
          aria-label="目前用藥"
          onChange={(event) => setCtx("meds", event.target.value)}
          placeholder="抗凝血、類固醇、近期新藥…"
          value={ctx("meds")}
        />
      </label>

      <div className="ed-line">
        <span>過敏</span>
        <Chip
          active={ctx("allergy") === "nil"}
          onClick={() => setCtx("allergy", ctx("allergy") === "nil" ? "" : "nil")}
        >
          nil
        </Chip>
        <input
          aria-label="過敏藥物"
          onChange={(event) => setCtx("allergy", event.target.value)}
          placeholder="nil 或藥名"
          value={ctx("allergy")}
        />
      </div>

      <div className="ed-grid ed-grid--tocc" data-testid="ed-tocc">
        <span className="ed-grid__label">TOCC</span>
        {TOCC.map(({ key, letter, label }) => {
          const finding = findings[edKey.tocc(key)] ?? {};
          const positive = finding.sel === "+";
          return (
            <CycleChip
              key={key}
              label={letter}
              mark={positive ? "(+)" : "(−)"}
              onClick={() =>
                onChange(edKey.tocc(key), positive ? { sel: "-" } : { sel: "+" })
              }
              stateLabel={positive ? `${label} 有` : `${label} 無`}
              title={label}
              tone={positive ? "pos" : "neg"}
            />
          );
        })}
      </div>
      {TOCC.filter(({ key }) => findings[edKey.tocc(key)]?.sel === "+").map(
        ({ key, label }) => (
          <label className="ed-line" key={key}>
            <span>{label.split(" ")[0]}</span>
            <input
              aria-label={`${label} 細節`}
              onChange={(event) =>
                onChange(edKey.tocc(key), { sel: "+", text: event.target.value })
              }
              placeholder="細節"
              value={findings[edKey.tocc(key)]?.text ?? ""}
            />
          </label>
        ),
      )}

      <label className="ed-line ed-line--area">
        <span>特別情境</span>
        <textarea
          aria-label="特別情境"
          onChange={(event) => setCtx("situation", event.target.value)}
          placeholder="自由輸入，寫進 PH 的 Situation:"
          rows={2}
          value={ctx("situation")}
        />
      </label>
      <div className="ed-line">
        <span />
        <select
          aria-label="插入常用情境"
          onChange={(event) => {
            const phrase = event.target.value;
            if (phrase) setCtx("situation", appendSituation(ctx("situation"), phrase));
            event.target.value = "";
          }}
          value=""
        >
          <option value="">＋插入常用情境…</option>
          {SPECIAL_ITEMS.map((item) => (
            <option key={item.id} value={item.text}>
              {item.label}（{item.text}）
            </option>
          ))}
        </select>
      </div>
      {legacySituations.length > 0 ? (
        <div className="ed-line">
          <span>舊勾選</span>
          <span className="ed-hint">
            {legacySituations.map((item) => item.label).join("、")}
            <button
              className="ed-link"
              onClick={() =>
                onBulkChange(
                  Object.fromEntries(
                    legacySituations.map((item) => [edKey.special(item.id), {}]),
                  ),
                )
              }
              type="button"
            >
              清除
            </button>
          </span>
        </div>
      ) : null}

      <div className="ed-preview">
        <b>PH</b>
        <span data-testid="ed-ph-preview">{composePH(findings) || "（尚未填寫）"}</span>
      </div>
    </section>
  );
}
