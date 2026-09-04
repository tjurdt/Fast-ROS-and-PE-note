import { useState } from "react";

import type { PatientSyncState } from "../../application/synchronized-patient-repository";
import { Button } from "../../ui/Button";

interface SyncStatusPanelProps {
  state: PatientSyncState;
  disabled: boolean;
  accountLabel: string | null;
  onSync: () => void;
  onReconnect: (() => void) | null;
  onLeave: (() => void) | null;
  onClearCache: (() => void) | null;
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

export function SyncStatusPanel({
  state,
  disabled,
  accountLabel,
  onSync,
  onReconnect,
  onLeave,
  onClearCache,
}: SyncStatusPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
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
          {accountLabel ? <span>{accountLabel}</span> : null}
          <p>{state.detail}</p>
          <small>
            {formatSyncTime(state.lastSyncedAt)}
            {state.conflictCount > 0 ? ` · 本次處理 ${state.conflictCount} 項衝突` : ""}
          </small>
        </div>
      </div>
      <div className="v2-sync-status__actions">
        <Button
          disabled={disabled || state.status === "syncing"}
          onClick={
            state.status === "auth-required" && onReconnect ? onReconnect : onSync
          }
          tone={attention || state.dirty ? "primary" : "default"}
        >
          {state.status === "auth-required" ? "重新連線" : "立即同步"}
        </Button>
        {accountLabel && onReconnect && onLeave && onClearCache ? (
          <details className="v2-sync-account">
            <summary>帳號與快取</summary>
            <div>
              <Button disabled={disabled} onClick={onReconnect}>
                切換／重新連線
              </Button>
              <Button disabled={disabled} onClick={onLeave}>
                離開 Google 模式
              </Button>
              {confirmClear ? (
                <div className="v2-sync-account__danger" role="alert">
                  <p>尚未同步的裝置變更也會刪除，且無法復原。</p>
                  <Button
                    disabled={disabled}
                    onClick={() => {
                      setConfirmClear(false);
                      onClearCache();
                    }}
                  >
                    確認清除此帳號快取
                  </Button>
                  <Button disabled={disabled} onClick={() => setConfirmClear(false)}>
                    取消
                  </Button>
                </div>
              ) : (
                <Button disabled={disabled} onClick={() => setConfirmClear(true)}>
                  清除此帳號快取
                </Button>
              )}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
