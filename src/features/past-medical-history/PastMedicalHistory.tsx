import { useState } from "react";

import {
  createPastMedicalHistoryEntry,
  PMH_COMMON,
  type PastMedicalHistoryEntry as PastMedicalHistoryEntryValue,
} from "../../domain/note-workspace";
import { Button } from "../../ui/Button";

interface PastMedicalHistoryProps {
  entries: PastMedicalHistoryEntryValue[];
  createId: () => string;
  onChange: (entries: PastMedicalHistoryEntryValue[]) => void;
}

export function PastMedicalHistory({
  entries,
  createId,
  onChange,
}: PastMedicalHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const count = entries.filter((entry) => entry.text.trim().length > 0).length;
  const add = (text: string) =>
    onChange([...entries, createPastMedicalHistoryEntry(text, { createId })]);

  return (
    <section
      className="v2-clinical-section v2-workspace-section"
      data-testid="pmh-section"
    >
      <button
        aria-expanded={expanded}
        className="v2-clinical-section__header"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>Past history 過去病史</span>
        <span>{count > 0 ? `${count} 項` : "展開"}</span>
      </button>
      {expanded ? (
        <div className="v2-pmh-body">
          <div className="v2-pmh-tools">
            <select
              aria-label="選擇常見過去病史"
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                add(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">＋ 選擇常見疾病…</option>
              {PMH_COMMON.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button onClick={() => add("")} tone="primary">
              ＋ 自行輸入
            </Button>
          </div>
          {entries.length === 0 ? (
            <p className="v2-workspace-empty">尚無紀錄；可選擇常見疾病或自行輸入。</p>
          ) : (
            <div className="v2-pmh-list">
              {entries.map((entry, index) => (
                <div className="v2-pmh-entry" key={entry.id}>
                  <span aria-hidden="true">•</span>
                  <textarea
                    aria-label={`過去病史 ${index + 1}`}
                    placeholder="疾病 / 病史…"
                    rows={1}
                    value={entry.text}
                    onChange={(event) =>
                      onChange(
                        entries.map((candidate) =>
                          candidate.id === entry.id
                            ? { ...candidate, text: event.target.value }
                            : candidate,
                        ),
                      )
                    }
                  />
                  <Button
                    aria-label={`刪除過去病史 ${index + 1}`}
                    onClick={() =>
                      onChange(entries.filter((candidate) => candidate.id !== entry.id))
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
