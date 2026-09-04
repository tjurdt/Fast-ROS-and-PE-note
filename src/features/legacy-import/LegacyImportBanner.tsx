import { Button } from "../../ui/Button";

export type LegacyImportBannerState =
  | { phase: "offer"; patientCount: number }
  | { phase: "done"; imported: number; skipped: number };

interface LegacyImportBannerProps {
  disabled: boolean;
  onDismiss: () => void;
  onImport: () => void;
  state: LegacyImportBannerState;
}

export function LegacyImportBanner({
  disabled,
  onDismiss,
  onImport,
  state,
}: LegacyImportBannerProps) {
  if (state.phase === "offer") {
    return (
      <section
        aria-label="匯入舊版本機資料"
        className="v2-card v2-legacy-import"
        data-testid="legacy-import-offer"
      >
        <p>
          偵測到本機舊版資料，共 <strong>{state.patientCount}</strong> 位病人。要匯入到
          v2 嗎？舊版資料不會被刪除或修改。
        </p>
        <div className="v2-legacy-import__actions">
          <Button disabled={disabled} onClick={onDismiss} tone="ghost">
            不用了
          </Button>
          <Button disabled={disabled} onClick={onImport} tone="primary">
            匯入
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="舊版資料匯入結果"
      className="v2-card v2-legacy-import"
      data-testid="legacy-import-done"
      role="status"
    >
      <p>
        已匯入 <strong>{state.imported}</strong> 位病人
        {state.skipped > 0
          ? `，${state.skipped} 筆因格式問題略過（詳見瀏覽器主控台）`
          : ""}
        。
      </p>
      <div className="v2-legacy-import__actions">
        <Button onClick={onDismiss} tone="ghost">
          知道了
        </Button>
      </div>
    </section>
  );
}
