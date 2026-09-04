# Legacy import

## Intent

Offer the one-time legacy(`rounding_notes_v1`)→ v2 import ADR 0004 decided on, as an
explicit, user-triggered action shown on the local patient list only while it is
empty. Presentational only: `LegacyImportBanner` renders the offer and the
after-import result; `App` orchestration owns detection, conversion, and persistence
via `src/infrastructure/legacy-import/legacy-patient-import.ts`.

## Non-goals

- Does not read `localStorage`, convert data, or decide when to offer — it only
  renders whatever state `App` hands it and calls back on import/dismiss.
- Does not cover Google/synced mode. Legacy data is a device-local concept
  (`rounding_notes_v1`); importing it into a cloud-synced database raises cross-device
  questions ADR 0004 did not decide, so the offer only appears when choosing local
  storage.
- Does not remember a dismissal across reloads. Dismissing only hides the banner for
  the current session; if the v2 database is still empty next time local mode is
  opened, it is offered again. Deliberately simple for a one-time action taken at
  most once per real user.

## Data and integration

`App.chooseLocal` detects and converts legacy data (via `convertLegacyDatabase`)
right after opening an empty local v2 database. A successful, non-empty conversion
becomes an "offer" banner; confirming persists the converted database through the
normal save path (the same one every other patient edit uses) and switches the
banner to a "done" summary with imported/skipped counts. Skipped-patient details are
logged to the console, not shown in the UI, to keep the banner readable — a skipped
patient is not lost, it is left untouched in the legacy record for closer review.
