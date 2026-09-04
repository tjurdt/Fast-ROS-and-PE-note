import { useEffect, useMemo, useRef, useState } from "react";

import type { PatientRepository } from "../application/patient-repository";
import {
  isSyncCapablePatientRepository,
  type PatientSyncState,
  type SyncCapablePatientRepository,
} from "../application/synchronized-patient-repository";
import {
  createPatientInDatabase,
  updateBundlesInDatabase,
  updateFindingInDatabase,
  updatePatientInDatabase,
  updateWorkspaceInDatabase,
} from "../application/patient-workflows";
import type {
  FindingValue,
  PatientBundleFields,
  PatientDraft,
  PatientEditableFields,
  PatientFactoryDependencies,
  PatientWorkspaceFields,
} from "../domain/patient";
import {
  addAntibioticOption,
  archiveCustomBundleTemplate,
  emptyPatientDatabase,
  upsertCustomBundleTemplate,
  type PatientDatabase,
} from "../domain/patient-database";
import type { UserBundleTemplate } from "../domain/bundle-templates";
import { AdditionalNotes } from "../features/additional-notes/AdditionalNotes";
import { AdmissionHistory } from "../features/admission-history/AdmissionHistory";
import { BundleWorkspace } from "../features/bundles/BundleWorkspace";
import { BundleTemplateEditor } from "../features/bundle-template-editor/BundleTemplateEditor";
import { ClinicalNote } from "../features/clinical-note/ClinicalNote";
import { ClinicalExportPreview } from "../features/export-preview/ClinicalExportPreview";
import { PastMedicalHistory } from "../features/past-medical-history/PastMedicalHistory";
import { PatientList } from "../features/patient-list/PatientList";
import { PatientNote } from "../features/patient-note/PatientNote";
import { StorageChoice } from "../features/storage-choice/StorageChoice";
import { SyncStatusPanel } from "../features/sync-status/SyncStatusPanel";
import { TodoList } from "../features/todo-list/TodoList";
import { LocalPatientRepository } from "../infrastructure/storage/local-patient-repository";

type View = "landing" | "list" | "note";

interface AppProps {
  repository?: PatientRepository;
  googleRepository?: SyncCapablePatientRepository;
  patientFactory?: PatientFactoryDependencies;
}

const DEFAULT_PATIENT_FACTORY: PatientFactoryDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => Date.now(),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "發生未預期的錯誤。";
}

export function App({
  repository: suppliedRepository,
  googleRepository,
  patientFactory,
}: AppProps) {
  const localRepository = useMemo(
    () => suppliedRepository ?? new LocalPatientRepository(),
    [suppliedRepository],
  );
  const [repository, setRepository] = useState<PatientRepository>(localRepository);
  const factory = patientFactory ?? DEFAULT_PATIENT_FACTORY;
  const [view, setView] = useState<View>("landing");
  const [database, setDatabase] = useState<PatientDatabase>(emptyPatientDatabase);
  const databaseRef = useRef(database);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [syncState, setSyncState] = useState<PatientSyncState | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);

  useEffect(() => {
    if (!isSyncCapablePatientRepository(repository)) {
      setSyncState(null);
      return;
    }
    return repository.subscribe(setSyncState);
  }, [repository]);

  function adoptDatabase(next: PatientDatabase) {
    databaseRef.current = next;
    setDatabase(next);
  }

  function persist(next: PatientDatabase) {
    adoptDatabase(next);
    setError(null);
    setSaving(true);
    const revision = ++saveRevision.current;
    const operation = saveQueue.current.then(() => repository.save(next));
    saveQueue.current = operation.catch(() => undefined);
    void operation
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => {
        if (saveRevision.current === revision) setSaving(false);
      });
  }

  async function openRepository(nextRepository: PatientRepository): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const loaded = await nextRepository.load();
      saveQueue.current = Promise.resolve();
      saveRevision.current = 0;
      setRepository(nextRepository);
      adoptDatabase(loaded);
      setView("list");
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function chooseLocal() {
    await openRepository(localRepository);
  }

  async function chooseGoogle() {
    if (!googleRepository) return;
    if (!(await openRepository(googleRepository))) return;
    void googleRepository
      .sync()
      .then((synced) => adoptSyncedDatabase(synced))
      .catch(() => undefined);
  }

  function adoptSyncedDatabase(next: PatientDatabase) {
    adoptDatabase(next);
    if (
      activePatientId !== null &&
      !next.patients.some((patient) => patient.id === activePatientId)
    ) {
      setExportOpen(false);
      setActivePatientId(null);
      setView("list");
    }
  }

  async function syncNow() {
    if (!isSyncCapablePatientRepository(repository)) return;
    await saveQueue.current;
    try {
      adoptSyncedDatabase(await repository.sync());
    } catch {
      // The repository exposes a recoverable state and retains its local cache.
    }
  }

  function createNewPatient(draft: PatientDraft) {
    const result = createPatientInDatabase(databaseRef.current, draft, factory);
    persist(result.database);
    setActivePatientId(result.patient.id);
    setView("note");
  }

  function updateActivePatient(patch: Partial<PatientEditableFields>) {
    if (activePatientId === null) return;
    const patient = databaseRef.current.patients.find(
      (candidate) => candidate.id === activePatientId,
    );
    if (!patient) return;

    const result = updatePatientInDatabase(
      databaseRef.current,
      patient,
      patch,
      factory.now(),
    );
    persist(result.database);
  }

  function updateActiveFinding(itemId: string, finding: FindingValue) {
    if (activePatientId === null) return;
    const patient = databaseRef.current.patients.find(
      (candidate) => candidate.id === activePatientId,
    );
    if (!patient) return;

    const result = updateFindingInDatabase(
      databaseRef.current,
      patient,
      itemId,
      finding,
      factory.now(),
    );
    persist(result.database);
  }

  function updateActiveWorkspace(patch: Partial<PatientWorkspaceFields>) {
    if (activePatientId === null) return;
    const patient = databaseRef.current.patients.find(
      (candidate) => candidate.id === activePatientId,
    );
    if (!patient) return;

    const result = updateWorkspaceInDatabase(
      databaseRef.current,
      patient,
      patch,
      factory.now(),
    );
    persist(result.database);
  }

  function updateActiveBundles(
    patch: Partial<PatientBundleFields>,
    customAntibioticOption?: string,
  ) {
    if (activePatientId === null) return;
    const sourceDatabase = customAntibioticOption
      ? addAntibioticOption(databaseRef.current, customAntibioticOption)
      : databaseRef.current;
    const patient = sourceDatabase.patients.find(
      (candidate) => candidate.id === activePatientId,
    );
    if (!patient) return;

    const result = updateBundlesInDatabase(
      sourceDatabase,
      patient,
      patch,
      factory.now(),
    );
    persist(result.database);
  }

  function updateActiveBlockNote(sectionKey: string, note: string) {
    if (activePatientId === null) return;
    const patient = databaseRef.current.patients.find(
      (candidate) => candidate.id === activePatientId,
    );
    if (!patient) return;
    updateActiveWorkspace({
      blockNotes: { ...patient.blockNotes, [sectionKey]: note },
    });
  }

  function saveCustomBundleTemplate(template: UserBundleTemplate) {
    persist(upsertCustomBundleTemplate(databaseRef.current, template));
  }

  function setCustomBundleTemplateArchived(templateId: string, archived: boolean) {
    persist(archiveCustomBundleTemplate(databaseRef.current, templateId, archived));
  }

  const activePatient =
    activePatientId === null
      ? undefined
      : database.patients.find((patient) => patient.id === activePatientId);

  return (
    <>
      {error ? (
        <div className="v2-error" role="alert">
          {error}
        </div>
      ) : null}

      {templateEditorOpen ? (
        <BundleTemplateEditor
          createId={factory.createId}
          templates={database.customBundleTemplates}
          onArchive={setCustomBundleTemplateArchived}
          onClose={() => setTemplateEditorOpen(false)}
          onSave={saveCustomBundleTemplate}
        />
      ) : null}

      {exportOpen && activePatient ? (
        <ClinicalExportPreview
          patient={activePatient}
          templates={database.customBundleTemplates}
          onClose={() => setExportOpen(false)}
        />
      ) : null}

      {view === "landing" ? (
        <StorageChoice
          disabled={loading}
          googleAvailable={Boolean(googleRepository)}
          onChooseGoogle={() => void chooseGoogle()}
          onChooseLocal={() => void chooseLocal()}
        />
      ) : null}

      {view === "list" ? (
        <PatientList
          patients={database.patients}
          saving={saving}
          onCreate={createNewPatient}
          onOpen={(patientId) => {
            setActivePatientId(patientId);
            setView("note");
          }}
        />
      ) : null}

      {view === "note" && activePatient ? (
        <PatientNote
          patient={activePatient}
          saving={saving}
          onBack={() => {
            setExportOpen(false);
            setActivePatientId(null);
            setView("list");
          }}
          onChange={updateActivePatient}
          onExport={() => setExportOpen(true)}
        >
          {syncState ? (
            <SyncStatusPanel
              disabled={saving}
              state={syncState}
              onSync={() => void syncNow()}
            />
          ) : null}
          <TodoList
            createId={factory.createId}
            now={factory.now}
            todos={activePatient.todos}
            onChange={(todos) => updateActiveWorkspace({ todos })}
          />
          <AdditionalNotes
            value={activePatient.globalNote}
            onChange={(globalNote) => updateActiveWorkspace({ globalNote })}
          />
          <BundleWorkspace
            antibioticOptions={database.antibioticOptions}
            chemo={activePatient.chemo}
            createId={factory.createId}
            customBundleTemplates={database.customBundleTemplates}
            customSets={activePatient.customSets}
            infections={activePatient.infections}
            lqq={activePatient.lqq}
            onChange={updateActiveBundles}
            onManageTemplates={() => setTemplateEditorOpen(true)}
            patientAge={activePatient.age}
            postop={activePatient.postop}
          />
          <AdmissionHistory
            admission={activePatient.admission}
            adl={activePatient.adl}
            onAdmissionChange={(admission) => updateActiveWorkspace({ admission })}
            onAdlChange={(adl) => updateActiveWorkspace({ adl })}
          />
          <PastMedicalHistory
            createId={factory.createId}
            entries={activePatient.pmh}
            onChange={(pmh) => updateActiveWorkspace({ pmh })}
          />
          <ClinicalNote
            patient={activePatient}
            onBlockNoteChange={updateActiveBlockNote}
            onFindingChange={updateActiveFinding}
          />
        </PatientNote>
      ) : null}
    </>
  );
}
