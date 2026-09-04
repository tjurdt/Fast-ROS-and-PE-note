import type { ClinicalItem } from "../../domain/clinical/catalog-schema";
import type { FindingValue } from "../../domain/clinical/finding";
import { DtrWidget } from "./DtrWidget";
import { PlantarWidget } from "./PlantarWidget";
import { SensoryWidget } from "./SensoryWidget";

interface CustomClinicalWidgetProps {
  item: Extract<ClinicalItem, { type: "custom" }>;
  finding: FindingValue;
  onChange: (finding: FindingValue) => void;
}

export function CustomClinicalWidget({
  item,
  finding,
  onChange,
}: CustomClinicalWidgetProps) {
  if (item.custom === "dtr") {
    return <DtrWidget finding={finding} onChange={onChange} />;
  }
  if (item.custom === "plantar") {
    return <PlantarWidget finding={finding} onChange={onChange} />;
  }
  if (item.custom === "sensory") {
    return <SensoryWidget finding={finding} onChange={onChange} />;
  }
  return <span className="v2-custom-pending">不支援的元件：{item.custom}</span>;
}
