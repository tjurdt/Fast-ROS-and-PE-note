# Admission history

## Intent

遷移 legacy 入院評估：菸酒檳榔、食物/藥物過敏、TOCC、近期住院、家族史，以及 ADL 與主要照護者。

## Non-goals

- 不推導診斷、不提供過敏原字典或 TOCC 外部查詢。
- Admission 計數不包含 ADL，維持 legacy 定義。
- 不直接讀寫 repository 或其他 feature。

## Data and integration

選項由 frozen legacy oracle 生成；Admission 與 ADL 使用分離的 typed schema，所有更新由 App 經 workspace workflow 儲存。
