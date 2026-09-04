import {
  DTR_GRADES,
  DTR_SITES,
  nextCycleValue,
  type FindingValue,
} from "../../domain/clinical/finding";
import { Button } from "../../ui/Button";

interface DtrWidgetProps {
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}

const SIDES = [
  { key: "L", label: "左 L" },
  { key: "R", label: "右 R" },
] as const;

export function DtrWidget({ finding, onChange }: DtrWidgetProps) {
  const values = finding.dtr ?? {};

  return (
    <div className="v2-dtr" data-testid="dtr-widget">
      <div className="v2-widget-grid__header" aria-hidden="true">
        <span />
        {SIDES.map((side) => (
          <span key={side.key}>{side.label}</span>
        ))}
      </div>
      {DTR_SITES.map((site) => (
        <div className="v2-widget-grid__row" key={site.key}>
          <span>{site.label}</span>
          {SIDES.map((side) => {
            const key = `${site.key}_${side.key}`;
            const value = values[key] ?? "";
            return (
              <Button
                aria-label={`${site.label} ${side.label}：${value || "未評估"}`}
                className={`v2-grid-cell ${value && value !== "2+" ? "is-positive" : ""}`}
                data-testid={`dtr-${key}`}
                key={side.key}
                onClick={() =>
                  onChange({
                    ...finding,
                    dtr: {
                      ...values,
                      [key]: nextCycleValue(DTR_GRADES, value),
                    },
                  })
                }
              >
                {value || "–"}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
