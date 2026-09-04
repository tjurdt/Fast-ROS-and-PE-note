# Bundle template editor

## Intent

Provide an offline editor for reusable patient bundle templates. Templates retain
stable template and field IDs so editing labels, options, or order does not rewrite
patient-scoped values.

## Non-goals

- Built-in Dialysis and DNR definitions remain generated from the legacy oracle.
- This slice does not add cloud synchronization, import/export, or clinical-note
  export formatting.
- Permanent deletion is intentionally unavailable; templates and fields are
  recoverably archived.

## Data changes

- `PatientDatabase.customBundleTemplates` stores legacy-shaped user templates.
- Missing collections and archive flags receive additive defaults when older v2
  data is loaded.
- Archived definitions stay persisted so existing patient values keep their field
  identity and can be restored.

## Integration points

- Pure validation, normalization, ordering, and archive rules live in
  `src/domain/bundle-templates.ts`.
- The app persists template changes through the existing repository save queue.
- The bundle workspace receives definitions and callbacks; it never reads storage
  or application globals directly.
