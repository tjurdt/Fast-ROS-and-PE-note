import { Button } from "../../ui/Button";

interface StorageChoiceProps {
  disabled: boolean;
  googleAvailable: boolean;
  onChooseLocal: () => void;
  onChooseGoogle: () => void;
}

export function StorageChoice({
  disabled,
  googleAvailable,
  onChooseLocal,
  onChooseGoogle,
}: StorageChoiceProps) {
  return (
    <main className="v2-gate" aria-labelledby="v2-title">
      <section className="v2-card v2-gate__card">
        <span className="v2-eyebrow">PE Note v2 · parity development build</span>
        <h1 id="v2-title">查房快速紀錄</h1>
        <p>新版架構驗證中。正式入口仍使用既有版本。</p>

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
            <span>
              {googleAvailable
                ? "先開啟此裝置快取，再安全同步遠端版本。"
                : "同步核心已就緒；完成 OAuth 連線後開放。"}
            </span>
          </Button>
        </div>

        <p className="v2-privacy">
          請使用床號或虛構代碼，避免輸入姓名、病歷號等直接識別資訊。
        </p>
      </section>
    </main>
  );
}
