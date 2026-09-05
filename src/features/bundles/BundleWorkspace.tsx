import {
  BUILTIN_BUNDLE_TEMPLATES,
  DIALYSIS_BUNDLE_ID,
  DNR_BUNDLE_ID,
  activateBundle,
  activateTemplateBundle,
  createLqqEntry,
  removeBundle,
  updateBundleInstance,
} from "../../domain/bundles";
import type { UserBundleTemplate } from "../../domain/bundle-templates";
import { createChemotherapyFollowup } from "../../domain/chemotherapy-followup";
import {
  allAntibioticOptions,
  createInfectionRecord,
} from "../../domain/infection-workup";
import type { PatientBundleFields } from "../../domain/patient";
import { createPostoperativeCare } from "../../domain/postoperative-care";
import { Button } from "../../ui/Button";
import { ChemotherapyFollowup } from "./ChemotherapyFollowup";
import { InfectionWorkup } from "./InfectionWorkup";
import { LqqBundle } from "./LqqBundle";
import { PostoperativeCare } from "./PostoperativeCare";
import { TemplateBundle } from "./TemplateBundle";

interface BundleWorkspaceProps extends Pick<
  PatientBundleFields,
  "lqq" | "customSets" | "postop" | "infections" | "chemo"
> {
  antibioticOptions: string[];
  customBundleTemplates: UserBundleTemplate[];
  createId: () => string;
  patientAge: string;
  onChange: (
    patch: Partial<PatientBundleFields>,
    customAntibioticOption?: string,
  ) => void;
  onManageTemplates: () => void;
}

const ENABLED_TEMPLATE_IDS = [DIALYSIS_BUNDLE_ID, DNR_BUNDLE_ID] as const;

export function BundleWorkspace({
  antibioticOptions,
  chemo,
  customBundleTemplates,
  lqq,
  customSets,
  infections,
  patientAge,
  postop,
  createId,
  onChange,
  onManageTemplates,
}: BundleWorkspaceProps) {
  const enabledTemplates = BUILTIN_BUNDLE_TEMPLATES.filter((template) =>
    ENABLED_TEMPLATE_IDS.includes(template.id as (typeof ENABLED_TEMPLATE_IDS)[number]),
  );
  const builtinIds = new Set(BUILTIN_BUNDLE_TEMPLATES.map((template) => template.id));
  const safeCustomTemplates = customBundleTemplates.filter(
    (template) => !builtinIds.has(template.id),
  );
  const availableCustomTemplates = safeCustomTemplates.filter(
    (template) => !template.archived,
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
            className="v2-bundle-btn v2-bundle-btn--lqq"
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
          <Button
            className="v2-bundle-btn v2-bundle-btn--infection"
            data-testid="add-infection"
            onClick={() =>
              onChange({
                infections: [
                  ...infections.map((infection) => ({
                    ...infection,
                    collapsed: true,
                  })),
                  createInfectionRecord(patientAge, { createId }),
                ],
              })
            }
          >
            感染／敗血症
            {infections.length > 0 ? <span>{infections.length}</span> : null}
          </Button>
          {enabledTemplates.map((template) => {
            const active = customSets[template.id] !== undefined;
            return (
              <Button
                className={`v2-bundle-btn v2-bundle-btn--${template.id} ${active ? "is-active" : ""}`}
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
            className={`v2-bundle-btn v2-bundle-btn--postop ${postop ? "is-active" : ""}`}
            data-testid="add-bundle-postop"
            disabled={postop !== null}
            onClick={() => onChange({ postop: createPostoperativeCare() })}
          >
            術後照護{postop ? " ✓" : ""}
          </Button>
          <Button
            className={`v2-bundle-btn v2-bundle-btn--chemo ${chemo ? "is-active" : ""}`}
            data-testid="add-bundle-chemo"
            disabled={chemo !== null}
            onClick={() => onChange({ chemo: createChemotherapyFollowup() })}
          >
            化療／標靶{chemo ? " ✓" : ""}
          </Button>
        </div>
        <div className="v2-bundle-launcher__custom">
          <div>
            <strong>自訂組套</strong>
            <span>建立可重複使用的欄位範本</span>
          </div>
          <Button data-testid="manage-bundle-templates" onClick={onManageTemplates}>
            ⚙ 組套編輯器
          </Button>
        </div>
        {availableCustomTemplates.length > 0 ? (
          <div className="v2-bundle-launcher__actions is-custom">
            {availableCustomTemplates.map((template) => {
              const active = customSets[template.id] !== undefined;
              return (
                <Button
                  className={active ? "is-active" : ""}
                  data-testid={`add-bundle-${template.id}`}
                  disabled={active}
                  key={template.id}
                  onClick={() =>
                    onChange({
                      customSets: activateTemplateBundle(
                        customSets,
                        availableCustomTemplates,
                        template.id,
                      ),
                    })
                  }
                >
                  {template.name}
                  {active ? " ✓" : ""}
                </Button>
              );
            })}
          </div>
        ) : null}
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

      {infections.map((infection, index) => (
        <InfectionWorkup
          antibioticOptions={allAntibioticOptions(antibioticOptions)}
          createId={createId}
          index={index}
          infection={infection}
          key={infection.id}
          onAddCustomAntibiotic={(next, option) =>
            onChange(
              {
                infections: infections.map((candidate) =>
                  candidate.id === infection.id ? next : candidate,
                ),
              },
              option,
            )
          }
          onChange={(next) =>
            onChange({
              infections: infections.map((candidate) =>
                candidate.id === infection.id ? next : candidate,
              ),
            })
          }
          onRemove={() =>
            onChange({
              infections: infections.filter(
                (candidate) => candidate.id !== infection.id,
              ),
            })
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

      {safeCustomTemplates.map((template) => {
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

      {chemo ? (
        <ChemotherapyFollowup
          followup={chemo}
          onChange={(next) => onChange({ chemo: next })}
          onRemove={() => onChange({ chemo: null })}
        />
      ) : null}
    </section>
  );
}
