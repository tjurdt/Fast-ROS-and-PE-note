# Past medical history

## Intent

提供可重複的 PMH 文字列、legacy 常見疾病選單、新增、編輯與刪除。

## Non-goals

- 不在此 feature 自動套用組套；PMH 觸發組套會隨組套功能另行遷移。
- 不直接讀寫 repository。

## Data and integration

常見疾病選項由 frozen legacy oracle 生成；元件回傳完整 typed PMH 陣列，由 App 持久化。
