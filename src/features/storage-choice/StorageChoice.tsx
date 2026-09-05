import { Button } from "../../ui/Button";

interface StorageChoiceProps {
  disabled: boolean;
  googleAvailable: boolean;
  googleDetail: string;
  cachedAccountLabel: string | null;
  onChooseLocal: () => void;
  onChooseGoogle: () => void;
  onOpenGoogleCache: () => void;
}

export function StorageChoice({
  disabled,
  googleAvailable,
  googleDetail,
  cachedAccountLabel,
  onChooseLocal,
  onChooseGoogle,
  onOpenGoogleCache,
}: StorageChoiceProps) {
  return (
    <main className="v2-gate" aria-labelledby="v2-title">
      <section className="v2-card v2-gate__card">
        <span className="v2-eyebrow">PE Note</span>
        <h1 id="v2-title">查房快速紀錄</h1>
        <p>可離線使用的單檔查房筆記。選擇儲存方式開始。</p>

        <div className="v2-storage-grid">
          <Button
            data-testid="choose-local-v2"
            disabled={disabled}
            onClick={onChooseLocal}
            tone="primary"
          >
            <strong>💻 單機使用</strong>
            <span>資料保存在此瀏覽器的 v2 獨立空間。</span>
          </Button>
          <Button
            aria-disabled={!googleAvailable}
            data-testid="choose-google-v2"
            disabled={disabled || !googleAvailable}
            onClick={onChooseGoogle}
          >
            <strong>☁ Google 帳號</strong>
            <span>{googleDetail}</span>
          </Button>
          {cachedAccountLabel ? (
            <Button
              className="v2-storage-grid__cached"
              data-testid="open-google-cache-v2"
              disabled={disabled}
              onClick={onOpenGoogleCache}
            >
              <strong>📦 離線開啟 Google 裝置快取</strong>
              <span>{cachedAccountLabel} · 不需登入或網路，可稍後再同步。</span>
            </Button>
          ) : null}
        </div>

        <p className="v2-privacy">
          請使用床號或虛構代碼，避免輸入姓名、病歷號等直接識別資訊。
        </p>
      </section>
    </main>
  );
}
