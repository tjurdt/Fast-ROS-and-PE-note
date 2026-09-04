# Repository instructions

These rules apply to human and AI-assisted changes in this repository.

## Source of truth

- Since ADR 0005 (2026-09-05), the root `index.html` is the generated **v2** production artifact. Never hand-edit it. `npm run build` (`build:v2` then `promote:v2`) regenerates it from `src/app`, `src/domain`, `src/application`, `src/infrastructure`, `src/features`, and `src/ui`.
- Legacy source (`src/index.template.html`, `src/styles/app.css`, `src/legacy/app.js`) is frozen and no longer the production entry — it is kept as the Phase 2 rollback reference from ADR 0004. Run `npm run build:legacy` to produce `dist-legacy/index.html` for rollback preview/testing; never point it at the root artifact.
- Preserve a single-file offline artifact in both tracks. Do not add external local stylesheet, font, image, or script dependencies to either build.
- Do not delete legacy source, its baseline protection, or its dedicated tests before the ADR 0004 Phase 2 observation period ends and a human confirms Phase 3 (retirement) explicitly.

## Change boundaries

- Treat `src/legacy/app.js` and `src/styles/app.css` as a frozen behavioral reference, not extension points.
- Put each v2 capability in `src/features/<feature-name>/` with a local `README.md` that states intent, non-goals, data changes, and integration points.
- v2 feature code uses ES modules and explicit imports. `config/assets.mjs` and IIFE wrapping apply only to an intentional legacy-track patch.
- `src/domain/clinical/catalog.generated.json` is generated from the frozen legacy oracle, including specialty focus, CN panels, neurological widgets, PMH, admission, and ADL options. Do not hand-edit it; run `npm run sync:clinical-catalog` and keep `check:clinical-catalog` passing.
- Keep dependencies pointing inward: UI/features → application → domain. Infrastructure implements application ports; domain must not import React, browser APIs, storage, or network code.
- Put code in `src/ui/` only when it is genuinely presentation-only and shared. Do not create catch-all utility or service files.
- Add a narrow adapter or port instead of reading legacy globals, DOM fragments, storage keys, or Google synchronization state from v2.
- Keep `npm run check:v2-boundaries` passing; do not bypass layer or cross-feature dependency failures with re-export barrels.

## Compatibility and safety

- Legacy persisted keys stay frozen. v2 uses its own versioned schema and storage namespace (`pe_note_v2`); the one-time `rounding_notes_v1` → v2 import (ADR 0004, `src/infrastructure/legacy-import/`) is the only sanctioned bridge, and it must never write back to or delete the legacy key.
- Validate all data crossing storage/network boundaries at runtime. A failed parse must not overwrite the original stored value.
- Storage or synchronization changes require tests for offline/local behavior, cached Google behavior, and conflict/error recovery as applicable.
- Never include real patient identifiers, OAuth secrets, access tokens, private keys, or production exports in source or fixtures.
- Keep UI text in Traditional Chinese unless the existing clinical term is intentionally bilingual.

## Verification

- Add or update tests for every behavior change.
- Run `npm run verify` before declaring a task complete (it builds and checks both `index.html`/`dist-v2` and `dist-legacy` as part of the chain).
- If an intentional legacy fix changes `src/legacy/app.js` during the Phase 2 rollback window, add regression coverage and update its baseline with `npm run accept:legacy -- --reason "..."`.
- Keep changes small and avoid unrelated cleanup in behavior-changing work.

## Commit messages

- `npm install` sets up Husky hooks (`prepare` script) that run lint/typecheck on commit and structural checks plus unit tests on push. They catch mechanical drift; they do not replace `npm run verify` before finishing a task.
- Every commit message states what changed and why, in one line: `<area>: <what>, because <why or what problem it fixes>`. `area` is a path segment or feature name (`bundles`, `google-drive-connector`, `docs`), not a verb.
- Never commit with a bare label like "improve", "fix", "update", or "WIP". A reviewer or a future AI session reading `git log` alone must be able to tell what the commit did without opening the diff.
- One commit, one purpose. Do not fold an unrelated cleanup, a dependency bump, and a behavior change into the same commit.
- When a commit changes the legacy baseline or a clinical catalog, the message states the accepted reason (matching the `--reason` passed to `accept:legacy` or `sync:clinical-catalog`), not just that the baseline changed.
