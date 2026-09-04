import { useEffect, useMemo, useRef, useState } from "react";

import type { PatientRepository } from "../application/patient-repository";
import type {
  CachedCloudAccount,
  CloudAccount,
  CloudRepositoryConnection,
  CloudRepositoryConnector,
} from "../application/cloud-repository-connector";
import {
  isSyncCapablePatientRepository,
  type PatientSyncState,
  type SyncCapablePatientRepository,
} from "../application/synchronized-patient-repository";
import {
  createPatientInDatabase,
  deletePatientInDatabase,
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
import { GoogleDriveConnector } from "../infrastructure/google/google-drive-connector";
import { LocalPatientRepository } from "../infrastructure/storage/local-patient-repository";

type View = "landing" | "list" | "note";

interface AppProps {
  repository?: PatientRepository;
  googleRepository?: SyncCapablePatientRepository;
  cloudConnector?: CloudRepositoryConnector;
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
  cloudConnector: suppliedCloudConnector,
  patientFactory,
}: AppProps) {
  const localRepository = useMemo(
    () => suppliedRepository ?? new LocalPatientRepository(),
    [suppliedRepository],
  );
  const defaultCloudConnector = useMemo(() => new GoogleDriveConnector(), []);
  const cloudConnector = suppliedCloudConnector ?? defaultCloudConnector;
  const googleAvailability = googleRepository
    ? {
        available: true,
        detail: "先開啟此裝置快取，再安全同步遠端版本。",
      }
    : cloudConnector.getAvailability();
  const [repository, setRepository] = useState<PatientRepository>(localRepository);
  const repositoryRef = useRef<PatientRepository>(repository);
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
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null);
  const [cachedCloudAccount, setCachedCloudAccount] =
    useState<CachedCloudAccount | null>(() => cloudConnector.getCachedAccount());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);

  useEffect(() => {
    if (!isSyncCapablePatientRepository(repository)) {
      setSyncState(null);
      return;
    }
    return repository.subscribe(setSyncState);
  }, [repository]);

  useEffect(() => {
    setCachedCloudAccount(cloudConnector.getCachedAccount());
  }, [cloudConnector]);

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
      repositoryRef.current = nextRepository;
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
    if (googleRepository) {
      if (!(await openRepository(googleRepository))) return;
      void syncRepository(googleRepository);
      return;
    }
    await connectGoogle();
  }

  async function openCloudConnection(
    connection: CloudRepositoryConnection,
    synchronize: boolean,
  ): Promise<void> {
    if (!(await openRepository(connection.repository))) return;
    setCloudAccount(connection.account);
    setCachedCloudAccount(cloudConnector.getCachedAccount());
    if (synchronize) void syncRepository(connection.repository);
  }

  async function connectGoogle() {
    setLoading(true);
    setError(null);
    try {
      await openCloudConnection(await cloudConnector.connect(), true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function openCachedGoogle() {
    setLoading(true);
    setError(null);
    try {
      const connection = await cloudConnector.openCached();
      if (!connection) {
        setCachedCloudAccount(null);
        throw new Error("找不到可開啟的 Google 裝置快取。");
      }
      await openCloudConnection(connection, false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function reconnectGoogle() {
    await saveQueue.current;
    await connectGoogle();
  }

  async function leaveGoogle(clearCache: boolean) {
    if (!cloudAccount) return;
    setLoading(true);
    setError(null);
    try {
      await saveQueue.current;
      await cloudConnector.disconnect(cloudAccount.key, { clearCache });
      setCloudAccount(null);
      setCachedCloudAccount(cloudConnector.getCachedAccount());
      setActivePatientId(null);
      setExportOpen(false);
      await openRepository(localRepository);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
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
    await syncRepository(repository);
  }

  async function syncRepository(nextRepository: SyncCapablePatientRepository) {
    try {
      const synced = await nextRepository.sync();
      if (repositoryRef.current === nextRepository) adoptSyncedDatabase(synced);
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

  function deletePatient(patientId: string) {
    const next = deletePatientInDatabase(databaseRef.current, patientId);
    if (next === databaseRef.current) return;
    persist(next);
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
  const syncPanel = syncState ? (
    <SyncStatusPanel
      accountLabel={cloudAccount?.label ?? null}
      disabled={saving || loading}
      state={syncState}
      onClearCache={cloudAccount ? () => void leaveGoogle(true) : null}
      onLeave={cloudAccount ? () => void leaveGoogle(false) : null}
      onReconnect={cloudAccount ? () => void reconnectGoogle() : null}
      onSync={() => void syncNow()}
    />
  ) : null;

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
          cachedAccountLabel={cachedCloudAccount?.account.label ?? null}
          disabled={loading}
          googleAvailable={googleAvailability.available}
          googleDetail={googleAvailability.detail}
          onChooseGoogle={() => void chooseGoogle()}
          onChooseLocal={() => void chooseLocal()}
          onOpenGoogleCache={() => void openCachedGoogle()}
        />
      ) : null}

      {view === "list" ? (
        <PatientList
          patients={database.patients}
          saving={saving}
          onCreate={createNewPatient}
          onDelete={deletePatient}
          onOpen={(patientId) => {
            setActivePatientId(patientId);
            setView("note");
          }}
        >
          {syncPanel}
        </PatientList>
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
          {syncPanel}
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
