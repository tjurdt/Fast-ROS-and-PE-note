import type { PatientSyncState } from "../../application/synchronized-patient-repository";
import { Button } from "../../ui/Button";

interface SyncStatusPanelProps {
  state: PatientSyncState;
  disabled: boolean;
  onSync: () => void;
}

const STATUS_LABELS: Record<PatientSyncState["status"], string> = {
  idle: "尚未同步",
  cached: "裝置快取",
  pending: "待同步",
  syncing: "同步中",
  synced: "已同步",
  offline: "離線",
  "auth-required": "需要重新連線",
  conflict: "衝突已安全處理",
  error: "同步異常",
};

function formatSyncTime(timestamp: number | null): string {
  if (timestamp === null) return "尚無成功同步紀錄";
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `最後同步 ${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SyncStatusPanel({ state, disabled, onSync }: SyncStatusPanelProps) {
  const attention = ["offline", "auth-required", "error"].includes(state.status);
  return (
    <section
      aria-label="Google Drive 同步狀態"
      className={`v2-card v2-sync-status is-${state.status}`}
      data-testid="sync-status-panel"
    >
      <div>
        <span className="v2-sync-status__icon" aria-hidden="true">
          {state.status === "syncing" ? "↻" : state.dirty ? "↑" : "☁"}
        </span>
        <div>
          <strong>{STATUS_LABELS[state.status]}</strong>
          <p>{state.detail}</p>
          <small>
            {formatSyncTime(state.lastSyncedAt)}
            {state.conflictCount > 0 ? ` · 本次處理 ${state.conflictCount} 項衝突` : ""}
          </small>
        </div>
      </div>
      <Button
        disabled={disabled || state.status === "syncing"}
        onClick={onSync}
        tone={attention || state.dirty ? "primary" : "default"}
      >
        {state.status === "auth-required" ? "重新連線後同步" : "立即同步"}
      </Button>
    </section>
  );
}
