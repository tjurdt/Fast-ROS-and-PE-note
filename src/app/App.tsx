import { useMemo, useRef, useState } from "react";

import type { PatientRepository } from "../application/patient-repository";
import {
  createPatientInDatabase,
  updateFindingInDatabase,
  updatePatientInDatabase,
} from "../application/patient-workflows";
import type {
  FindingValue,
  PatientDraft,
  PatientEditableFields,
  PatientFactoryDependencies,
} from "../domain/patient";
import { emptyPatientDatabase, type PatientDatabase } from "../domain/patient-database";
import { ClinicalNote } from "../features/clinical-note/ClinicalNote";
import { PatientList } from "../features/patient-list/PatientList";
import { PatientNote } from "../features/patient-note/PatientNote";
import { StorageChoice } from "../features/storage-choice/StorageChoice";
import { LocalPatientRepository } from "../infrastructure/storage/local-patient-repository";

type View = "landing" | "list" | "note";

interface AppProps {
  repository?: PatientRepository;
  patientFactory?: PatientFactoryDependencies;
}

const DEFAULT_PATIENT_FACTORY: PatientFactoryDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => Date.now(),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "發生未預期的錯誤。";
}

export function App({ repository: suppliedRepository, patientFactory }: AppProps) {
  const repository = useMemo(
    () => suppliedRepository ?? new LocalPatientRepository(),
    [suppliedRepository],
  );
  const factory = patientFactory ?? DEFAULT_PATIENT_FACTORY;
  const [view, setView] = useState<View>("landing");
  const [database, setDatabase] = useState<PatientDatabase>(emptyPatientDatabase);
  const databaseRef = useRef(database);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);

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

  async function chooseLocal() {
    setLoading(true);
    setError(null);
    try {
      adoptDatabase(await repository.load());
      setView("list");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
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

      {view === "landing" ? (
        <StorageChoice disabled={loading} onChooseLocal={() => void chooseLocal()} />
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
            setActivePatientId(null);
            setView("list");
          }}
          onChange={updateActivePatient}
        >
          <ClinicalNote patient={activePatient} onFindingChange={updateActiveFinding} />
        </PatientNote>
      ) : null}
    </>
  );
}
