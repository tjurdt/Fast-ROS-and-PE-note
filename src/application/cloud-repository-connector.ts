import type { SyncCapablePatientRepository } from "./synchronized-patient-repository";

export interface CloudAccount {
  /** Opaque provider identifier used only to isolate this account's local cache. */
  key: string;
  label: string;
}

export interface CachedCloudAccount {
  account: CloudAccount;
}

export interface CloudRepositoryConnection {
  account: CloudAccount;
  repository: SyncCapablePatientRepository;
}

export interface CloudConnectorAvailability {
  available: boolean;
  detail: string;
}

export interface CloudRepositoryConnector {
  getAvailability(): CloudConnectorAvailability;
  getCachedAccount(): CachedCloudAccount | null;
  connect(): Promise<CloudRepositoryConnection>;
  openCached(): Promise<CloudRepositoryConnection | null>;
  disconnect(accountKey: string, options: { clearCache: boolean }): Promise<void>;
}
