# ADR 0002：以 parity gate 進行 v2 架構換代

- 狀態：Accepted
- 日期：2026-09-02

## 背景

專案仍在開發期，沒有需要保留的使用者資料，因此可以採用乾淨的 v2 schema；但現有 legacy 已有可用的 ROS/PE、組套、匯出、列印與 Google 同步行為，直接覆蓋會失去可靠的比較基準。

## 決策

建立 TypeScript、React、Vite、Vitest 與 Playwright 的 v2 軌道：

- domain 不依賴 UI、browser 或 storage。
- application 定義 use cases 與 repository ports。
- infrastructure 實作 localStorage 與 Google Drive adapters；OAuth 組裝與 token 生命週期維持獨立邊界。
- feature 以垂直切片組織 React UI。
- Vite production build 重新內嵌所有 CSS/JavaScript，輸出單一 `dist-v2/index.html`。
- legacy 保持正式入口，直到每一項功能都有 parity/contract coverage 且整體 gate 通過。

## 初始 parity gate

切換正式入口前必須完成：

1. 病人建立、修改、刪除、重載與排序。
2. 全部 ROS/PE 題型、Focus、性別/科別 gate 與陽性計數。
3. Admission、PMH、待辦與所有內建/自訂組套。
4. 完整版、限縮版、TXT 與列印輸出契約。
5. Google 授權、cache、離線、401、衝突與同步中再次編輯。
6. 桌面與手機 viewport 的 Playwright 流程。
7. v2 單檔成品可在沒有本機靜態依賴下啟動。

## 結果

可以大幅重整內部架構，同時保留可執行的舊版 oracle。短期成本是雙軌建置；長期收益是 typed boundaries、可替換 adapters、較小的 feature 變更面積與自動化切換標準。
