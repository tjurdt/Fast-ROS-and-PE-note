# ED note（急診問題導向）

## Intent

科別選「ED 急診（問題導向）」時，病人頁改用問題導向流程，取代 ROS／PE／組套分頁：

1. **問題**：依病人主訴複選（腹痛、發燒、喘、頭暈…共 31 個），並填主訴時間、NRS。
2. **問診**：每個問題各自列出「特徵題＋核心題＋視情況再問」，多個問題**合併**成一份清單；同一題只問一次並標示「共用」，★ 表示紅旗必問。
3. **PE**：依急診病歷表單欄位（GC／HEENT／NECK／CHEST／ABD／BACK／GU／RECTAL／EXT／NEURO）合併；只輸出有按「正常／異常」的項目。
4. **病史**：PMH 快選（勾選會追加相關問診，例如洗腎 → 最後一次透析）、用藥、過敏、TOCC。
5. **病歷輸出**：即時產生 CC／NRS／PI／PH／各 PE 欄位與 ICD-10，顯示字數上限（對應 ERS 表單 maxlength），可逐欄手動修改，一鍵複製「交換文字」供院內 Tampermonkey 腳本帶入。

題庫與規則在 `src/domain/ed/`（純函式，有單元測試）；本 feature 只負責呈現與回傳 immutable `FindingValue`。

## Non-goals

- 不做檢查／檢驗組套開立（之後依「問題」另外做，所以問題 id 要保持穩定）。
- 不連線 ERS、不讀病人資料；與院內系統的唯一介面是複製出去的純文字（格式見 `src/domain/ed/chart-text.ts`）。
- 不取代通用的 ROS／PE catalog；其他科別維持原狀。

## Data and integration

- **不改 schema**。答案存在 `patient.findings`，key 一律以 `ed.` 開頭（`edKey` 於 `src/domain/ed/types.ts`）：
  `ed.p.*` 已選問題（`note` 為選取順序）、`ed.h.*` 問診、`ed.pe.*` PE、`ed.pmh.*` 病史、`ed.ctx.*` 時間／NRS／過敏／用藥、`ed.tocc.*`、`ed.ov.*` 手動覆寫、`ed.icd` ICD 勾選與自訂代碼。
  因此 local／Google 同步與三方合併沿用既有 finding 機制，legacy 匯出不會讀到這些 key。
- `buildEdNoteTabs` 回傳 `PatientNoteTab[]`，由 `App.tsx` 在 `isEdPatient(patient)` 時取代標準分頁；急診病人隱藏通用「匯出／列印」。
- 批次動作（「此欄全正常」、「TOCC 全部無」）走 `updatePatientFindings`，只存檔一次。
- 性別／年齡閘門：LMP、懷孕、陰道出血只對女性 12–55 歲（年齡空白也算）顯示。

## 設計依據（歷史資料）

題庫與問題對應依 358 筆急診病歷（CC／PI／PH／PE／Dx）整理：

- 前十大症狀 ICD：R50.9、R42、R10.9、R07.9、R06.00、R53.1、R19.7、R31.9、R33.9、R11.2 都有對應問題，且預設使用 unspecified 症狀碼；診斷性代碼只作為可勾選備選。
- PI 實務是「相關陽性＋重要陰性」，例如發燒必問咳嗽／痰、腹痛、噁心嘔吐腹瀉、解尿、喘、胸痛、頭痛；這些在題庫中就是跨問題共用題。
- PE 欄位長度很緊（HEENT／NECK 僅 60 字），所以正常片語有精簡寫法，仍超過時改成總結句；不會用套版充數未檢查的項目。

## 擴充時

新增問題：在 `problems.ts` 加一筆並引用既有題庫 id；`tests/v2/ed-note.test.ts` 會檢查 id 是否存在、紅旗題是否在詢問清單內、ICD 代碼格式、以及該問題「全部正常」的 PE 是否塞得進表單欄位字數。
