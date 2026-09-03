import { useState } from "react";

import {
  USER_BUNDLE_FIELD_TYPES,
  UserBundleTemplateSchema,
  createUserBundleField,
  createUserBundleTemplate,
  moveUserBundleField,
  normalizeUserBundleTemplate,
  parseUserBundleOptions,
  setUserBundleFieldArchived,
  updateUserBundleField,
  userBundleFieldNeedsOptions,
  userBundleTemplateIssues,
  type UserBundleField,
  type UserBundleFieldType,
  type UserBundleTemplate,
} from "../../domain/bundle-templates";
import { Button } from "../../ui/Button";

interface BundleTemplateEditorProps {
  createId: () => string;
  templates: UserBundleTemplate[];
  onArchive: (templateId: string, archived: boolean) => void;
  onClose: () => void;
  onSave: (template: UserBundleTemplate) => void;
}

interface FieldEditorProps {
  activeIndex: number;
  activeTotal: number;
  field: UserBundleField;
  onArchive: () => void;
  onChange: (field: UserBundleField) => void;
  onMove: (direction: -1 | 1) => void;
}

function FieldEditor({
  activeIndex,
  activeTotal,
  field,
  onArchive,
  onChange,
  onMove,
}: FieldEditorProps) {
  return (
    <section
      className="v2-template-field-editor"
      data-testid={`editor-field-${field.id}`}
    >
      <header>
        <strong>欄位 {activeIndex + 1}</strong>
        <div>
          <Button
            aria-label={`欄位 ${activeIndex + 1} 上移`}
            disabled={activeIndex === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            aria-label={`欄位 ${activeIndex + 1} 下移`}
            disabled={activeIndex === activeTotal - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <Button onClick={onArchive} tone="ghost">
            封存欄位
          </Button>
        </div>
      </header>
      <div className="v2-template-field-editor__grid">
        <label>
          欄位名稱
          <input
            aria-label={`欄位 ${activeIndex + 1} 名稱`}
            placeholder="例如：傷口滲液"
            value={field.label}
            onChange={(event) => onChange({ ...field, label: event.target.value })}
          />
        </label>
        <label>
          欄位類型
          <select
            aria-label={`欄位 ${activeIndex + 1} 類型`}
            value={field.type}
            onChange={(event) =>
              onChange({
                ...field,
                type: event.target.value as UserBundleFieldType,
              })
            }
          >
            {USER_BUNDLE_FIELD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        {userBundleFieldNeedsOptions(field.type) ? (
          <label className="is-full">
            選項（每行一個）
            <textarea
              aria-label={`欄位 ${activeIndex + 1} 選項`}
              placeholder={"輕度\n中度\n重度"}
              rows={4}
              value={field.options.join("\n")}
              onChange={(event) =>
                onChange({
                  ...field,
                  options: parseUserBundleOptions(event.target.value),
                })
              }
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}

export function BundleTemplateEditor({
  createId,
  templates,
  onArchive,
  onClose,
  onSave,
}: BundleTemplateEditorProps) {
  const [draft, setDraft] = useState<UserBundleTemplate | null>(null);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const activeTemplates = templates.filter((template) => !template.archived);
  const archivedTemplates = templates.filter((template) => template.archived);
  const activeFields = draft?.fields.filter((field) => !field.archived) ?? [];
  const archivedFields = draft?.fields.filter((field) => field.archived) ?? [];
  const issues = draft ? userBundleTemplateIssues(draft) : [];

  function beginEdit(template: UserBundleTemplate) {
    setDraft(UserBundleTemplateSchema.parse(template));
    setPendingArchiveId(null);
    setSaveError("");
  }

  function changeField(field: UserBundleField) {
    if (!draft) return;
    setDraft(updateUserBundleField(draft, field.id, field));
  }

  function saveDraft() {
    if (!draft || issues.length > 0) return;
    try {
      onSave(normalizeUserBundleTemplate(draft));
      setDraft(null);
      setSaveError("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "無法儲存組套。");
    }
  }

  return (
    <div className="v2-template-editor-overlay" data-testid="bundle-template-editor">
      <section
        aria-labelledby="v2-template-editor-title"
        aria-modal="true"
        className="v2-template-editor"
        role="dialog"
      >
        <header className="v2-template-editor__header">
          <div>
            <span className="v2-eyebrow">Reusable templates</span>
            <h2 id="v2-template-editor-title">
              {draft
                ? templates.some((item) => item.id === draft.id)
                  ? "編輯組套"
                  : "新增組套"
                : "組套編輯器"}
            </h2>
          </div>
          <Button aria-label="關閉組套編輯器" onClick={onClose} tone="ghost">
            關閉
          </Button>
        </header>

        <div className="v2-template-editor__body">
          {draft ? (
            <>
              <label className="v2-template-editor__name">
                組套名稱
                <input
                  aria-label="自訂組套名稱"
                  placeholder="例如：外傷傷口換藥組套"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>

              <div className="v2-template-editor__section-heading">
                <strong>欄位（{activeFields.length}）</strong>
                <Button
                  data-testid="add-template-field"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      fields: [...draft.fields, createUserBundleField({ createId })],
                    })
                  }
                >
                  ＋ 新增欄位
                </Button>
              </div>

              {activeFields.length > 0 ? (
                <div className="v2-template-editor__fields">
                  {activeFields.map((field, index) => (
                    <FieldEditor
                      activeIndex={index}
                      activeTotal={activeFields.length}
                      field={field}
                      key={field.id}
                      onArchive={() =>
                        setDraft(setUserBundleFieldArchived(draft, field.id, true))
                      }
                      onChange={changeField}
                      onMove={(direction) =>
                        setDraft(moveUserBundleField(draft, field.id, direction))
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="v2-template-editor__empty">
                  尚無欄位；可先儲存空白範本，或新增需要的欄位。
                </p>
              )}

              {archivedFields.length > 0 ? (
                <details className="v2-template-editor__archived-fields">
                  <summary>已封存欄位（{archivedFields.length}）</summary>
                  {archivedFields.map((field) => (
                    <div key={field.id}>
                      <span>{field.label || "未命名欄位"}</span>
                      <Button
                        onClick={() =>
                          setDraft(setUserBundleFieldArchived(draft, field.id, false))
                        }
                      >
                        還原欄位
                      </Button>
                    </div>
                  ))}
                </details>
              ) : null}

              {issues.length > 0 ? (
                <ul className="v2-template-editor__issues" role="alert">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              {saveError ? (
                <p className="v2-template-editor__issues" role="alert">
                  {saveError}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="v2-template-editor__intro">
                <p>
                  自訂範本會儲存在這台裝置，可套用到不同病人。欄位與範本採封存制，既有填寫資料不會被刪除。
                </p>
                <Button
                  data-testid="create-bundle-template"
                  onClick={() => beginEdit(createUserBundleTemplate({ createId }))}
                  tone="primary"
                >
                  ＋ 新增組套
                </Button>
              </div>
              {activeTemplates.length > 0 ? (
                <div className="v2-template-editor__list">
                  {activeTemplates.map((template) => (
                    <div className="v2-template-editor__list-item" key={template.id}>
                      <div>
                        <strong>{template.name || "未命名組套"}</strong>
                        <span>
                          {template.fields.filter((field) => !field.archived).length}{" "}
                          個欄位
                        </span>
                      </div>
                      <Button onClick={() => beginEdit(template)}>編輯</Button>
                      {pendingArchiveId === template.id ? (
                        <div className="v2-template-editor__confirm">
                          <Button
                            onClick={() => {
                              onArchive(template.id, true);
                              setPendingArchiveId(null);
                            }}
                          >
                            確認封存
                          </Button>
                          <Button
                            onClick={() => setPendingArchiveId(null)}
                            tone="ghost"
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setPendingArchiveId(template.id)}
                          tone="ghost"
                        >
                          封存
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="v2-template-editor__empty">
                  尚未建立自訂組套，例如可建立傷口換藥或疼痛評估範本。
                </p>
              )}
              {archivedTemplates.length > 0 ? (
                <details className="v2-template-editor__archive">
                  <summary>已封存組套（{archivedTemplates.length}）</summary>
                  {archivedTemplates.map((template) => (
                    <div key={template.id}>
                      <span>{template.name || "未命名組套"}</span>
                      <Button onClick={() => beginEdit(template)}>查看／編輯</Button>
                      <Button onClick={() => onArchive(template.id, false)}>
                        還原
                      </Button>
                    </div>
                  ))}
                </details>
              ) : null}
            </>
          )}
        </div>

        {draft ? (
          <footer className="v2-template-editor__footer">
            <Button onClick={() => setDraft(null)} tone="ghost">
              取消
            </Button>
            <Button
              data-testid="save-bundle-template"
              disabled={issues.length > 0}
              onClick={saveDraft}
              tone="primary"
            >
              儲存組套
            </Button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
