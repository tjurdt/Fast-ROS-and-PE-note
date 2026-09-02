# ADR 0001：保留單檔成品，建立來源與 legacy 邊界

- 狀態：Accepted
- 日期：2026-09-02

## 背景

應用原本完全位於單一 `index.html`，可直接離線開啟，但 CSS、畫面、臨床規則與兩種儲存模式互相交織。直接改成框架或多檔部署會同時增加功能回歸、資料相容與離線交付風險。

## 決策

保留 `index.html` 作為唯一發布成品，但改由 HTML template、ordered asset manifest 與拆出的來源重建。原始 JavaScript 放在受 hash baseline 保護的 `src/legacy/app.js`；新功能放在 feature slices，未來以窄 bridge 漸進抽離。

## 結果

- 使用者端部署方式與離線能力不變。
- 開發者可以分檔、測試、lint 並由 CI 驗證生成結果。
- 初期仍保留 legacy 全域耦合；跨越此邊界需顯式說明與測試。
- `index.html` 需要一併提交，讓無 Node 環境仍可直接取得成品。
