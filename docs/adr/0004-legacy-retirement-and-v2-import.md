# ADR 0004:一次性 legacy import 與 legacy 退場計畫

- 狀態:Accepted
- 日期:2026-09-05

## 背景

`docs/ARCHITECTURE.md` 的「資料策略」原本把兩件事都留到「正式切換前再決定」:

1. 是否需要一個一次性的 legacy → v2 資料轉換。
2. legacy 雙軌何時、如何真正退場。

雙軌策略(ADR 0002)本身沒有終點條件,只要這兩題一直懸而未決,雙軌就有可能無限期拖下去,變成永久的維護稅而非過渡期。7 個 v2 parity gate(`config/v2-parity.mjs`)目前皆有對應測試證據,`npm run verify` 端到端可通過,是時候把這兩題釘死。

## 決策一:建立一次性 import,預設保守

雖然 `ARCHITECTURE.md` 寫「目前沒有正式使用者資料」,但 legacy `index.html` 本身就是一個可離線使用、已上線一段時間的工具,任何人(包含維護者自己)都可能已經用它記錄過真實查房筆記,存在瀏覽器的 `localStorage`(key:`rounding_notes_v1`)。這件事無法從程式碼本身確認或排除。

沒有 import 的代價(有真實資料時,使用者切換到 v2 等於資料消失)遠高於多做一個沒人用到的 import 功能的代價,因此決策為:**做,但保持最小、明確、唯讀**。

要求:

- 放在 `src/infrastructure/legacy-import/`,是一個 infrastructure adapter,不進 domain——domain 不得認識 legacy 的資料形狀。
- 純函式轉換:讀取 `rounding_notes_v1` 的既有 JSON 結構,輸出通過既有 v2 Zod schema 驗證的 `Patient`/`PatientDatabase`;驗證失敗必須明確報錯,不得生出半殘資料。
- 絕不寫回、絕不刪除、絕不修改 legacy 的 `rounding_notes_v1`。這是單向、可重複執行、無副作用的讀取。
- 使用者顯式觸發,不自動執行、不靜默匯入。UI 只在偵測到 `rounding_notes_v1` 存在且 v2 資料庫為空時,提示「偵測到本機舊版資料,是否匯入」之類的一次性動作。
- 需要與 clinical catalog 生成腳本一樣等級的測試覆蓋:至少涵蓋每個大區塊(病人基本資料、25 區塊 ROS/PE、Admission/PMH/ADL、待辦、內建與自訂組套)各一個代表性 fixture 的轉換正確性。

實作本身不在本 ADR 範圍內,列為後續獨立工作。

## 決策二:legacy 退場採分階段、有觸發條件的計畫

退場不是切換 v2 正式入口那一刻就刪 legacy,而是分四階段:

**Phase 0(現況)**:雙軌繼續,legacy 維持正式入口,`src/legacy/app.js` 凍結不擴充。

**Phase 1(切換)**:待下列全部成立才把正式入口從 legacy 換成 v2:

1. `config/v2-parity.mjs` 列的 7 個 gate 全部有測試證據(`check:v2-parity` 通過)。
2. 決策一的一次性 import 已實作並有測試覆蓋。
3. `npm run verify` 全綠,含 `test:e2e`。

執行方式:調整 build pipeline,讓根目錄正式 `index.html` 改由 v2 build 產出,而不是目前 `scripts/build.mjs` 組出的 legacy 版本。**Legacy 原始碼在這個階段仍完整留在 repo,不刪除**,作為回退路徑。

**Phase 2(觀察期)**:Phase 1 切換後,保留 legacy 原始碼與 `check:legacy` baseline 保護至少一段實際使用 v2 的觀察期(建議至少 2–4 週,或由你確認穩定為止),期間不對 legacy 做任何開發,只作為回退用。

**Phase 3(退場)**:觀察期滿、確認不需要回退後,才真正刪除:

- `src/legacy/app.js`、`src/styles/app.css`、`src/index.template.html`
- `config/legacy-baseline.json`、`scripts/check-legacy-baseline.mjs`、`scripts/update-legacy-baseline.mjs`
- `tests/app.smoke.test.mjs`、`e2e/legacy-parity.spec.ts`(其中仍有效的回歸斷言先搬進 v2 對應測試)
- `npm run verify` 中的 `check:generated`/`check:legacy`/`test:legacy` 步驟與對應 `package.json` script
- 更新 README、AGENTS.md、CONTRIBUTING.md,移除雙軌相關規則
- 將 ADR 0002 標記為 Superseded,指回本 ADR

Phase 3 的觸發是人為判斷(由你確認觀察期已滿、可以退場),不是自動化條件。

## 結果

兩個原本無限期懸置的問題都有了明確答案與觸發條件,雙軌策略因此是有終點的過渡狀態,不會變成常態。代價是多一個(目前尚未實作的)一次性 import 功能,以及退場前要多等一段觀察期——這是刻意的保守選擇,換取不會在真的有人已經用 legacy 記錄真實資料時,把資料弄丟。
