# History workspace

## Intent

把「病史」頂層分頁整合成 ROS/PE 式的子分頁：入院評估、ADL、TOCC、過去病史，一次展開一個面板。承接原 `admission-history` 與 `past-medical-history` 兩個 feature 的 UI。

## Non-goals

- 不推導診斷、不提供過敏原字典或 TOCC 外部查詢。
- 不決定「病史」在病人筆記頁面的頂層導覽位置（由 `App.tsx` / `PatientNote` 決定）。
- 不直接讀寫 repository；元件只回傳 typed `Admission` / `Adl` / `PastMedicalHistoryEntry[]`，持久化由 App workflow 負責。
- 沿用 legacy 定義：入院評估計數不含 TOCC，也不含 ADL。

## Data and integration

選項（菸酒檳榔、ADL 等級、常見過去病史）由 frozen legacy oracle 生成並以 Zod 驗證。四個子分頁各自顯示一個進度徽章，彼此互斥展開，展開狀態於重新掛載時重置。
