import { useEffect, useMemo, useState } from "react";

import type { UserBundleTemplate } from "../../domain/bundle-templates";
import { buildClinicalSummary } from "../../domain/clinical-summary/build";
import type {
  ClinicalSummaryDocument,
  ClinicalSummaryMode,
} from "../../domain/clinical-summary/model";
import {
  clinicalSummaryFilename,
  renderClinicalSummaryText,
} from "../../domain/clinical-summary/text";
import type { Patient } from "../../domain/patient";
import { Button } from "../../ui/Button";

interface ClinicalExportPreviewProps {
  patient: Patient;
  templates: readonly UserBundleTemplate[];
  onClose: () => void;
  now?: Date;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some offline/file contexts expose Clipboard API but deny access.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("瀏覽器未允許複製，請改用下載 TXT。");
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function ExportDocument({ document }: { document: ClinicalSummaryDocument }) {
  return (
    <article className="v2-export-document" data-testid="clinical-export-document">
      <header className="v2-export-document__header">
        <h1>{document.title}</h1>
        <dl>
          <div>
            <dt>病人代號</dt>
            <dd>{document.header.patientCode}</dd>
          </div>
          {document.header.demographics ? (
            <div>
              <dt>基本資料</dt>
              <dd>{document.header.demographics}</dd>
            </div>
          ) : null}
          {document.header.problem ? (
            <div>
              <dt>主要問題</dt>
              <dd>{document.header.problem}</dd>
            </div>
          ) : null}
          <div>
            <dt>科別</dt>
            <dd>{document.header.specialty}</dd>
          </div>
          <div>
            <dt>匯出時間</dt>
            <dd>{document.header.exportedAt}</dd>
          </div>
        </dl>
        <p className="v2-export-document__mode">
          {document.mode === "limited"
            ? "限縮版：重點＋陽性/異常＋備註"
            : "完整版：全部項目"}
        </p>
      </header>

      {document.sections.map((section) => (
        <section className="v2-export-section" key={section.id}>
          <h2>{section.title}</h2>
          {section.note ? (
            <p className="v2-export-section__note">
              <strong>§ 區塊備註：</strong>
              {section.note}
            </p>
          ) : null}
          {section.lines.map((line, index) => (
            <p
              className={`v2-export-line ${line.positive ? "is-positive" : ""}`.trim()}
              key={`${section.id}-${index}`}
            >
              {line.label ? (
                <>
                  <span aria-hidden="true">{line.positive ? "●" : "○"}</span>{" "}
                  <strong>{line.label}</strong>：
                </>
              ) : null}
              <span className="v2-export-line__value">{line.value}</span>
              {line.note ? <em>※ {line.note}</em> : null}
            </p>
          ))}
        </section>
      ))}

      <footer className="v2-export-document__disclaimer">{document.disclaimer}</footer>
    </article>
  );
}

export function ClinicalExportPreview({
  patient,
  templates,
  onClose,
  now,
}: ClinicalExportPreviewProps) {
  const [mode, setMode] = useState<ClinicalSummaryMode>("limited");
  const [snapshot] = useState(() => now ?? new Date());
  const [status, setStatus] = useState("");
  const document = useMemo(
    () => buildClinicalSummary(patient, templates, { mode, now: snapshot }),
    [mode, patient, snapshot, templates],
  );
  const text = useMemo(() => renderClinicalSummaryText(document), [document]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleCopy() {
    try {
      await copyText(text);
      setStatus("已複製全文");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "複製失敗");
    }
  }

  return (
    <div
      className="v2-export-overlay"
      data-testid="clinical-export-preview"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby="clinical-export-title"
        aria-modal="true"
        className="v2-export-dialog"
        role="dialog"
      >
        <header className="v2-export-dialog__header">
          <div>
            <span className="v2-eyebrow">v2 clinical summary</span>
            <h2 id="clinical-export-title">臨床摘要預覽</h2>
          </div>
          <Button aria-label="關閉匯出預覽" onClick={onClose} tone="ghost">
            關閉
          </Button>
        </header>

        <div className="v2-export-controls">
          <div aria-label="匯出範圍" className="v2-export-mode" role="group">
            <Button
              aria-pressed={mode === "limited"}
              className={mode === "limited" ? "is-selected" : ""}
              onClick={() => setMode("limited")}
            >
              限縮版
            </Button>
            <Button
              aria-pressed={mode === "full"}
              className={mode === "full" ? "is-selected" : ""}
              onClick={() => setMode("full")}
            >
              完整版
            </Button>
          </div>
          <p>列印功能可在瀏覽器對話框中選擇「另存為 PDF」。</p>
        </div>

        <div className="v2-export-body">
          <ExportDocument document={document} />
        </div>

        <footer className="v2-export-dialog__footer">
          <span aria-live="polite" role="status">
            {status}
          </span>
          <div>
            <Button onClick={() => void handleCopy()}>複製全文</Button>
            <Button
              onClick={() => downloadText(clinicalSummaryFilename(document), text)}
            >
              下載 TXT
            </Button>
            <Button onClick={() => window.print()} tone="primary">
              列印／存成 PDF
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
