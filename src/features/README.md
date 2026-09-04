# Feature slices

每個 v2 功能使用獨立目錄：

```text
src/features/<feature-name>/
  README.md       功能契約、非目標、資料與整合點
  Feature.tsx     React UI（需要時）
  feature.css     功能專屬樣式（需要時）
```

Feature 使用 ES module 明確 import，不加入 legacy 的 `config/assets.mjs`。測試放在 `tests/v2/`；既有行為另在 `e2e/` 建立 parity。Feature 只能透過 application workflow/port 存取資料，不可散落讀寫 storage key 或 legacy 全域 `DB`、`CUR`。

不要預先建立空泛的 service、helper 或 utils；domain 規則放 `src/domain/`，跨功能展示元件至少有兩個真實使用者再提升到 `src/ui/`。
