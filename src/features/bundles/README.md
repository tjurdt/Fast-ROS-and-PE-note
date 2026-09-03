# Bundles

## Intent

Provide the v2 bundle launcher and render typed, patient-scoped bundle instances. The
first parity slices cover repeatable LQQOPERA symptom analysis, the built-in Dialysis
and DNR templates, and postoperative care with repeatable drains.

## Non-goals

- Infection and chemotherapy bundle screens are migrated separately.
- User-defined template authoring is not part of this slice.
- Export formatting and Google synchronization are not owned here.

## Data changes

- `Patient.lqq` stores repeatable symptom-analysis entries using the legacy keys.
- `Patient.customSets` stores template instances under their stable legacy IDs.
- `Patient.autoTriggered` prevents a removed PMH-triggered bundle from reappearing.
- `Patient.postop` stores the singleton postoperative assessment and its drains.

All three fields default safely when an earlier v2 record is loaded. Unknown fields
inside a bundle instance are preserved for forward compatibility.

## Integration points

- Options and built-in template definitions come from the generated legacy oracle.
- Pure creation, DNR state, array selection, and PMH auto-trigger rules live in
  `src/domain/bundles.ts`.
- Persistence flows through `updateBundlesInDatabase`; this feature never accesses
  storage or legacy globals directly.
