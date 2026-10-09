import { SPECIAL_ITEMS } from "../../domain/ed/special";
import { edKey } from "../../domain/ed/types";
import type { EdFindings } from "../../domain/ed/compose";
import { Chip, type EdFindingChange } from "./ed-controls";

interface SpecialPickerProps {
  /** PI = 與這次來院有關的情境；PH = 長期背景情境。 */
  target: "PI" | "PH";
  findings: EdFindings;
  onChange: EdFindingChange;
}

/** 特別情境快選：勾選後寫進病歷，需要時可補細節。 */
export function SpecialPicker({ target, findings, onChange }: SpecialPickerProps) {
  const items = SPECIAL_ITEMS.filter((item) => item.target === target);
  return (
    <div className="ed-special" data-testid={`ed-special-${target}`}>
      <div className="ed-chips">
        {items.map((item) => {
          const finding = findings[edKey.special(item.id)] ?? {};
          return (
            <Chip
              active={finding.on === true}
              key={item.id}
              onClick={() =>
                onChange(
                  edKey.special(item.id),
                  finding.on === true ? {} : { ...finding, on: true },
                )
              }
              tone="warning"
            >
              {item.label}
            </Chip>
          );
        })}
      </div>
      {items
        .filter((item) => item.detail && findings[edKey.special(item.id)]?.on === true)
        .map((item) => (
          <label key={item.id}>
            {item.label} 細節
            <input
              aria-label={`${item.label} 細節`}
              onChange={(event) =>
                onChange(edKey.special(item.id), { on: true, text: event.target.value })
              }
              placeholder={item.detail}
              value={findings[edKey.special(item.id)]?.text ?? ""}
            />
          </label>
        ))}
    </div>
  );
}
