# Feature slices

每個新功能使用獨立目錄：

```text
src/features/<feature-name>/
  README.md       功能契約、非目標、資料與整合點
  index.js        瀏覽器進入點（需要時）
  feature.css     功能專屬樣式（需要時）
```

進入點需明確登錄於 `config/assets.mjs`，並以 IIFE 隔離頂層名稱。測試放在 `tests/<feature-name>.*.test.mjs`。若功能需要既有狀態，先建立最窄的 core/legacy bridge，不可散落讀寫全域 `DB`、`CUR` 或 storage key。

不要預先建立空泛的 service、helper 或 utils；同一抽象至少有兩個真實使用者再提升到 `src/core/`。
