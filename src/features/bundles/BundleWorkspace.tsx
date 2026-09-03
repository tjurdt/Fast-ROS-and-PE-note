import {
  BUILTIN_BUNDLE_TEMPLATES,
  DIALYSIS_BUNDLE_ID,
  DNR_BUNDLE_ID,
  activateBundle,
  createLqqEntry,
  removeBundle,
  updateBundleInstance,
} from "../../domain/bundles";
import type { PatientBundleFields } from "../../domain/patient";
import { createPostoperativeCare } from "../../domain/postoperative-care";
import { Button } from "../../ui/Button";
import { LqqBundle } from "./LqqBundle";
import { PostoperativeCare } from "./PostoperativeCare";
import { TemplateBundle } from "./TemplateBundle";

interface BundleWorkspaceProps extends Pick<
  PatientBundleFields,
  "lqq" | "customSets" | "postop"
> {
  createId: () => string;
  onChange: (patch: Partial<PatientBundleFields>) => void;
}

const ENABLED_TEMPLATE_IDS = [DIALYSIS_BUNDLE_ID, DNR_BUNDLE_ID] as const;

export function BundleWorkspace({
  lqq,
  customSets,
  postop,
  createId,
  onChange,
}: BundleWorkspaceProps) {
  const enabledTemplates = BUILTIN_BUNDLE_TEMPLATES.filter((template) =>
    ENABLED_TEMPLATE_IDS.includes(template.id as (typeof ENABLED_TEMPLATE_IDS)[number]),
  );

  return (
    <section
      aria-labelledby="v2-bundle-heading"
      className="v2-bundles"
      data-testid="bundle-workspace"
    >
      <div className="v2-card v2-bundle-launcher">
        <div className="v2-workspace-heading">
          <div>
            <span className="v2-eyebrow">Clinical bundles</span>
            <h2 id="v2-bundle-heading">新增組套</h2>
          </div>
        </div>
        <div className="v2-bundle-launcher__actions">
          <Button
            data-testid="add-lqq"
            onClick={() =>
              onChange({
                lqq: [...lqq, createLqqEntry({ createId })],
              })
            }
          >
            症狀分析
            {lqq.length > 0 ? <span>{lqq.length}</span> : null}
          </Button>
          {enabledTemplates.map((template) => {
            const active = customSets[template.id] !== undefined;
            return (
              <Button
                className={active ? "is-active" : ""}
                data-testid={`add-bundle-${template.id}`}
                disabled={active}
                key={template.id}
                onClick={() =>
                  onChange({ customSets: activateBundle(customSets, template.id) })
                }
              >
                {template.name}
                {active ? " ✓" : ""}
              </Button>
            );
          })}
          <Button
            className={postop ? "is-active" : ""}
            data-testid="add-bundle-postop"
            disabled={postop !== null}
            onClick={() => onChange({ postop: createPostoperativeCare() })}
          >
            術後照護{postop ? " ✓" : ""}
          </Button>
        </div>
      </div>

      {lqq.map((entry, index) => (
        <LqqBundle
          entry={entry}
          index={index}
          key={entry.id}
          onChange={(next) =>
            onChange({
              lqq: lqq.map((candidate) =>
                candidate.id === entry.id ? next : candidate,
              ),
            })
          }
          onRemove={() =>
            onChange({ lqq: lqq.filter((candidate) => candidate.id !== entry.id) })
          }
        />
      ))}

      {enabledTemplates.map((template) => {
        const instance = customSets[template.id];
        if (!instance) return null;
        return (
          <TemplateBundle
            instance={instance}
            key={template.id}
            template={template}
            onChange={(next) =>
              onChange({
                customSets: updateBundleInstance(customSets, template.id, () => next),
              })
            }
            onRemove={() =>
              onChange({ customSets: removeBundle(customSets, template.id) })
            }
          />
        );
      })}

      {postop ? (
        <PostoperativeCare
          care={postop}
          createId={createId}
          onChange={(next) => onChange({ postop: next })}
          onRemove={() => onChange({ postop: null })}
        />
      ) : null}
    </section>
  );
}
