# Repository instructions

These rules apply to human and AI-assisted changes in this repository.

## Source of truth

- The root `index.html` is the generated legacy production artifact. Never hand-edit it.
- Legacy source remains in `src/index.template.html`, `src/styles/app.css`, and `src/legacy/app.js`; run `npm run build` after an intentional legacy runtime change.
- v2 runtime source is TypeScript/React under `src/app`, `src/domain`, `src/application`, `src/infrastructure`, `src/features`, and `src/ui`; run `npm run build:v2` to produce `dist-v2/index.html`.
- Preserve a single-file offline artifact in both tracks. Do not add external local stylesheet, font, image, or script dependencies to either production build.
- Do not replace the root production artifact with v2 until the documented parity gates pass.

## Change boundaries

- Treat `src/legacy/app.js` and `src/styles/app.css` as a frozen behavioral reference, not extension points.
- Put each v2 capability in `src/features/<feature-name>/` with a local `README.md` that states intent, non-goals, data changes, and integration points.
- v2 feature code uses ES modules and explicit imports. `config/assets.mjs` and IIFE wrapping apply only to an intentional legacy-track patch.
- Keep dependencies pointing inward: UI/features → application → domain. Infrastructure implements application ports; domain must not import React, browser APIs, storage, or network code.
- Put code in `src/ui/` only when it is genuinely presentation-only and shared. Do not create catch-all utility or service files.
- Add a narrow adapter or port instead of reading legacy globals, DOM fragments, storage keys, or Google synchronization state from v2.

## Compatibility and safety

- Legacy persisted keys stay frozen. v2 uses its own versioned schema and storage namespace until cutover.
- Validate all data crossing storage/network boundaries at runtime. A failed parse must not overwrite the original stored value.
- Storage or synchronization changes require tests for offline/local behavior, cached Google behavior, and conflict/error recovery as applicable.
- Never include real patient identifiers, OAuth secrets, access tokens, private keys, or production exports in source or fixtures.
- Keep UI text in Traditional Chinese unless the existing clinical term is intentionally bilingual.

## Verification

- Add or update tests for every behavior change.
- Run `npm run build`, `npm run build:v2`, and `npm run verify` before declaring a task complete.
- Any behavior migrated from legacy requires a Playwright parity test or an equivalent deterministic contract test before cutover.
- If an intentional legacy fix changes `src/legacy/app.js`, add regression coverage and update its baseline with `npm run accept:legacy -- --reason "..."`.
- Keep changes small and avoid unrelated cleanup in behavior-changing work.
