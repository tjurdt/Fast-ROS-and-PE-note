export const SPECIALTIES = [
  { key: "cvs", label: "CV / CVS 心臟內外科" },
  { key: "cms", label: "CM / CS 胸腔內外科" },
  { key: "gigs", label: "GI / GS 消化內科・一般外科" },
  { key: "neuro", label: "Neuro / NS 神經內外科" },
  { key: "nephrogu", label: "Nephro / GU 腎臟・泌尿科" },
  { key: "crs", label: "CRS 大腸直腸外科" },
  { key: "obs", label: "OBS 產科" },
  { key: "gyn", label: "GYN 婦科" },
  { key: "air", label: "AIR 過敏免疫風濕科" },
  { key: "psy", label: "PSY 精神科" },
  { key: "ortho", label: "Ortho 骨科" },
  { key: "hemonc", label: "Hema / Onco 血液腫瘤科" },
  { key: "inf", label: "INF 感染科" },
  { key: "ent", label: "ENT 耳鼻喉科" },
  { key: "dermaps", label: "Derma / PS 皮膚・整形外科" },
  { key: "general", label: "一般內科／不分科／其他" },
] as const;

export function specialtyLabel(key: string): string {
  return SPECIALTIES.find((specialty) => specialty.key === key)?.label ?? key;
}
