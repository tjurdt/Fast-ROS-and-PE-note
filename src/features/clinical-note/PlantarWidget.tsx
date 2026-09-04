import {
  nextCycleValue,
  PLANTAR_OPTIONS,
  type FindingValue,
} from "../../domain/clinical/finding";
import { Button } from "../../ui/Button";

interface PlantarWidgetProps {
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}

const PLANTAR_CYCLE = ["", ...PLANTAR_OPTIONS] as const;
const SIDES = [
  { key: "L", label: "左 L" },
  { key: "R", label: "右 R" },
] as const;

export function PlantarWidget({ finding, onChange }: PlantarWidgetProps) {
  const plantar = finding.plantar ?? {};

  return (
    <div className="v2-plantar" data-testid="plantar-widget">
      {SIDES.map((side) => {
        const value = plantar[side.key] ?? "";
        const positive = value !== "" && value !== PLANTAR_OPTIONS[0];
        return (
          <label key={side.key}>
            <span>{side.label}</span>
            <Button
              aria-label={`蹠反射 ${side.label}：${value || "未評估"}`}
              className={`v2-cycle ${positive ? "is-positive" : value ? "is-normal" : ""}`}
              data-testid={`plantar-${side.key}`}
              onClick={() =>
                onChange({
                  ...finding,
                  plantar: {
                    ...plantar,
                    [side.key]: nextCycleValue(PLANTAR_CYCLE, value),
                  },
                })
              }
            >
              {value || "未評估"}
            </Button>
          </label>
        );
      })}
    </div>
  );
}
