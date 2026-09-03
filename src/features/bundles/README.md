# Bundles

## Intent

Provide the v2 bundle launcher and render typed, patient-scoped bundle instances. The
parity slices cover repeatable LQQOPERA symptom analysis, the built-in Dialysis and
DNR templates, postoperative care with repeatable drains, and infection/sepsis
workups with repeatable antibiotic courses, and chemotherapy/targeted-therapy adverse
effect follow-up with a limb-specific neuropathy matrix.

## Non-goals

- Template authoring UI is owned by the adjacent `bundle-template-editor` feature.
- Export formatting and Google synchronization are not owned here.

## Data changes

- `Patient.lqq` stores repeatable symptom-analysis entries using the legacy keys.
- `Patient.customSets` stores template instances under their stable legacy IDs.
- `Patient.autoTriggered` prevents a removed PMH-triggered bundle from reappearing.
- `Patient.postop` stores the singleton postoperative assessment and its drains.
- `Patient.infections` stores repeatable infection assessments and antibiotics.
- Database-level `antibioticOptions` stores user-added choices without coupling them
  to one patient.
- Database-level `customBundleTemplates` stores reusable user-authored definitions.
- `Patient.chemo` stores the singleton chemotherapy/targeted-therapy follow-up.

New patient and database fields default safely when an earlier v2 record is loaded.
Unknown fields inside a bundle instance or user-authored definition are preserved for
forward compatibility.

## Integration points

- Options and built-in template definitions come from the generated legacy oracle.
- User-authored definitions enter through props and are rendered by the same field
  engine without direct storage access.
- Pure creation, DNR state, array selection, and PMH auto-trigger rules live in
  `src/domain/bundles.ts`.
- Persistence flows through `updateBundlesInDatabase`; this feature never accesses
  storage or legacy globals directly.
