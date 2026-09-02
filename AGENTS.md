# Repository instructions

These rules apply to human and AI-assisted changes in this repository.

## Source of truth

- Edit files under `src/`; never hand-edit the generated root `index.html`.
- Run `npm run build` after a runtime source change and commit the generated `index.html`.
- Preserve the single-file offline artifact. Do not add static `src`, stylesheet, font, or image dependencies to the generated HTML.

## Change boundaries

- Treat `src/legacy/app.js` and `src/styles/app.css` as existing behavior, not extension points.
- Put each new capability in `src/features/<feature-name>/` with a local `README.md` that states intent, non-goals, data changes, and integration points.
- Add runtime entries explicitly to `config/assets.mjs`. Wrap browser feature scripts in an IIFE so top-level names cannot collide in the concatenated classic script.
- Put code in `src/core/` only when it defines a stable boundary or is already shared by at least two features. Do not create catch-all utility files.
- Prefer a narrow legacy bridge over direct reads or writes of `DB`, `CUR`, DOM fragments, storage keys, or Google synchronization state.

## Compatibility and safety

- Do not rename or reuse persisted keys. Make data migrations additive, idempotent, and tolerant of unknown fields.
- Storage or synchronization changes require tests for offline/local behavior, cached Google behavior, and conflict/error recovery as applicable.
- Never include real patient identifiers, OAuth secrets, access tokens, private keys, or production exports in source or fixtures.
- Keep UI text in Traditional Chinese unless the existing clinical term is intentionally bilingual.

## Verification

- Add or update tests for every behavior change.
- Run `npm run build` and `npm run verify` before declaring a task complete.
- If an intentional legacy fix changes `src/legacy/app.js`, add regression coverage and update its baseline with `npm run accept:legacy -- --reason "..."`.
- Keep changes small and avoid unrelated cleanup in behavior-changing work.
