import type { EdPeField, PeItem } from "./types";

function pe(
  id: string,
  field: EdPeField,
  label: string,
  normal: string,
  abnormal: string[],
  abnormalTemplate?: string,
): PeItem {
  return abnormalTemplate === undefined
    ? { id, field, label, normal, abnormal }
    : { id, field, label, normal, abnormal, abnormalTemplate };
}

const SITES = [
  "RUQ",
  "epigastric",
  "LUQ",
  "periumbilical",
  "RLQ",
  "suprapubic",
  "LLQ",
  "diffuse",
];

/**
 * 急診 PE 題庫，依病歷表單欄位分組。
 * normal 是「檢查了且正常」時寫進病歷的片語；沒檢查就不寫（不用套版充數）。
 */
export const PE_ITEMS: readonly PeItem[] = [
  // GENERAL CONDITION
  pe("gc_look", "GC", "外觀", "Not ill-looking", [
    "Acute ill-looking",
    "Chronic ill-looking",
    "Toxic-looking",
    "Cachexia",
    "Diaphoretic",
    "Pale",
  ]),
  pe("gc_gcs", "GC", "意識 GCS", "GCS:15", ["GCS:14", "GCS:13", "GCS:12", "GCS<=11"]),

  // HEENT
  pe("heent_conj", "HEENT", "結膜", "Pale conj(-)", [
    "Pale conj(+)",
    "conjunctival injection",
  ]),
  pe("heent_sclera", "HEENT", "鞏膜黃疸", "icteric sclera(-)", ["icteric sclera(+)"]),
  pe("heent_pupil", "HEENT", "瞳孔／對光", "pupil isocoric, LR(+)", [
    "anisocoria",
    "sluggish LR",
    "fixed dilated pupil",
    "miosis",
    "mydriasis",
  ]),
  pe("heent_eye", "HEENT", "眼部", "eyelid/cornea unremarkable, EOM full", [
    "conjunctival injection",
    "corneal opacity",
    "periorbital swelling/erythema",
    "EOM limitation",
    "visual field defect",
    "decreased visual acuity",
  ]),
  pe("heent_nystagmus", "HEENT", "眼振", "nystagmus(-)", ["nystagmus(+)"]),
  pe("heent_throat", "HEENT", "咽喉", "throat injection(-)", [
    "throat injection(+)",
    "tonsillar exudate(+)",
    "tonsil swelling",
    "uvula deviation",
    "trismus",
    "oral ulcer",
    "lip/tongue swelling",
  ]),
  pe("heent_mucosa", "HEENT", "口腔黏膜（脫水）", "moist mucosa", ["dry mucosa"]),
  pe("heent_ent", "HEENT", "耳鼻", "no ear/nose discharge or bleeding", [
    "epistaxis",
    "otorrhea",
    "tympanic membrane erythema",
    "hemotympanum",
    "nasal swelling",
  ]),
  pe("heent_head_trauma", "HEENT", "頭皮／顏面外傷", "no scalp/face injury", [
    "scalp laceration",
    "scalp hematoma",
    "Battle's sign",
    "raccoon eyes",
    "facial swelling",
  ]),

  // NECK
  pe("neck_stiff", "NECK", "頸部僵硬", "supple, stiffness(-)", [
    "stiffness(+)",
    "Kernig(+)",
    "Brudzinski(+)",
  ]),
  pe("neck_jve", "NECK", "頸靜脈怒張", "JVE(-)", ["JVE(+)"]),
  pe("neck_accessory", "NECK", "輔助呼吸肌", "use of accessory muscles(-)", [
    "use of accessory muscles(+)",
  ]),
  pe("neck_lap", "NECK", "淋巴結／腫塊", "lymph node(-)", [
    "LAP(+)",
    "neck mass",
    "thyroid enlargement",
  ]),
  pe("neck_spine", "NECK", "頸椎壓痛", "C-spine tenderness(-)", [
    "C-spine midline tenderness(+)",
    "limited neck ROM",
  ]),

  // CHEST And LUNGS
  pe("chest_pattern", "CHEST", "呼吸型態", "smooth breathing", [
    "tachypnea",
    "dyspnea",
    "chest retraction",
    "paradoxical breathing",
  ]),
  pe("chest_bs", "CHEST", "呼吸音", "clear breath sounds", [
    "decreased BS R",
    "decreased BS L",
    "decreased BS bil",
    "rales",
    "rhonchi",
    "wheezing",
    "stridor",
  ]),
  pe("heart_rhythm", "CHEST", "心律", "regular heart beats", [
    "irregularly irregular",
    "tachycardia",
    "bradycardia",
    "premature beats",
  ]),
  pe("heart_murmur", "CHEST", "心雜音", "no murmur", [
    "systolic murmur",
    "diastolic murmur",
    "gallop",
    "friction rub",
  ]),
  pe("chest_wall", "CHEST", "胸壁壓痛／皮膚", "chest wall tenderness(-)", [
    "chest wall tenderness(+)",
    "crepitus",
    "vesicular rash",
    "ecchymosis",
  ]),
  pe("chest_expansion", "CHEST", "兩側擴張", "symmetric chest expansion", [
    "asymmetric expansion",
    "flail segment",
  ]),

  // ABDOMEN
  pe("abd_inspect", "ABD", "外觀／軟硬", "Soft, flat", [
    "distended",
    "rigid",
    "surgical scar",
    "visible peristalsis",
  ]),
  pe("abd_bs", "ABD", "腸音", "normoactive bowel sound", [
    "hyperactive BS",
    "hypoactive BS",
    "absent BS",
    "tinkling BS",
  ]),
  pe("abd_tender", "ABD", "壓痛", "tenderness(-)", SITES, "tenderness(+) at {v}"),
  pe("abd_guard", "ABD", "肌肉僵硬", "muscle guarding(-)", [
    "muscle guarding(+)",
    "rigidity(+)",
  ]),
  pe("abd_rebound", "ABD", "反彈痛", "rebounding pain(-)", ["rebounding pain(+)"]),
  pe("abd_murphy", "ABD", "Murphy sign", "Murphy's sign(-)", ["Murphy's sign(+)"]),
  pe("abd_appendix", "ABD", "闌尾徵象", "McBurney's point tenderness(-)", [
    "McBurney's point tenderness(+)",
    "Rovsing's sign(+)",
    "psoas sign(+)",
    "obturator sign(+)",
  ]),
  pe("abd_mass", "ABD", "腫塊／肝脾／腹水", "no mass, no hepatosplenomegaly", [
    "palpable mass",
    "hepatomegaly",
    "splenomegaly",
    "pulsatile mass",
    "ascites",
    "hernia",
  ]),

  // BACK And SPINE
  pe("back_cva", "BACK", "CVA 敲擊痛", "C-V angle knocking tenderness(-)", [
    "C-V angle knocking tenderness R(+)",
    "C-V angle knocking tenderness L(+)",
    "C-V angle knocking tenderness bil(+)",
  ]),
  pe("back_spine", "BACK", "脊椎壓痛", "spinal tenderness(-)", [
    "midline spinal tenderness(+)",
    "paraspinal muscle tenderness(+)",
  ]),
  pe("back_slr", "BACK", "SLR 直腿抬高", "SLR(-)", ["SLR R(+)", "SLR L(+)"]),
  pe("back_sore", "BACK", "壓瘡", "pressure sore(-)", ["pressure sore(+)"]),

  // EXOGENITALIA
  pe("gu_ext", "GU", "外生殖器／會陰", "no discharge or lesion", [
    "vaginal bleeding",
    "vaginal discharge",
    "penile discharge",
    "scrotal swelling",
    "testicular tenderness",
    "genital rash/ulcer",
    "inguinal hernia",
  ]),
  pe(
    "gu_bladder",
    "GU",
    "膀胱／恥骨上",
    "suprapubic tenderness(-), bladder not distended",
    ["suprapubic tenderness(+)", "bladder distended"],
  ),

  // RECTAL EXAM
  pe("rectal_dre", "RECTAL", "肛診", "DRE: brown stool, no mass", [
    "tarry stool",
    "bright red blood",
    "hemorrhoid",
    "mass",
    "impaction",
    "not done",
  ]),

  // EXTREMITIES
  pe("ext_edema", "EXT", "水腫", "pitting edema(-)", [
    "pitting edema bil",
    "pitting edema R",
    "pitting edema L",
    "facial edema",
  ]),
  pe("ext_skin", "EXT", "皮膚", "no skin lesion", [
    "rash",
    "erythema/warmth/swelling",
    "wound",
    "petechiae/purpura",
    "urticaria",
    "vesicles",
    "cyanosis",
    "pale skin",
    "jaundice",
  ]),
  pe(
    "ext_calf",
    "EXT",
    "小腿壓痛／不對稱腫",
    "calf tenderness(-), no asymmetric swelling",
    ["calf tenderness(+)", "asymmetric leg swelling"],
  ),
  pe("ext_motion", "EXT", "活動／關節", "freely movable", [
    "limited ROM",
    "joint swelling",
    "deformity",
    "bony tenderness",
    "crepitus",
    "decreased movement",
  ]),
  pe("ext_pulse", "EXT", "末梢灌流", "distal pulse palpable, CRT<2s", [
    "weak distal pulse",
    "absent distal pulse",
    "cold limb",
    "CRT>2s",
  ]),

  // NEUROLOGICAL EXAM
  pe("neuro_orient", "NEURO", "定向力／意識", "oriented", [
    "disoriented",
    "confused",
    "drowsy",
    "stuporous",
  ]),
  pe("neuro_mp", "NEURO", "肌力", "MP: full", [
    "Lt hemiparesis",
    "Rt hemiparesis",
    "LUE weakness",
    "RUE weakness",
    "LLE weakness",
    "RLE weakness",
    "bil LE weakness",
  ]),
  pe("neuro_sensory", "NEURO", "感覺", "sensation intact", [
    "numbness L",
    "numbness R",
    "numbness bil",
    "dermatomal sensory loss",
    "stocking-glove sensory loss",
  ]),
  pe("neuro_face", "NEURO", "顏面／顱神經", "no facial palsy, EOM full", [
    "facial palsy R",
    "facial palsy L",
    "diplopia/EOM limitation",
    "visual field cut",
    "tongue deviation",
    "gaze preference",
  ]),
  pe("neuro_speech", "NEURO", "語言", "speech fluent", [
    "dysarthria",
    "expressive aphasia",
    "receptive aphasia",
  ]),
  pe("neuro_cerebellar", "NEURO", "小腦／步態", "FNF intact, gait steady", [
    "FNF dysmetria R",
    "FNF dysmetria L",
    "ataxic gait",
    "unable to walk",
    "Romberg(+)",
  ]),
  pe("neuro_babinski", "NEURO", "Babinski／反射", "Babinski(-)", [
    "Babinski R(+)",
    "Babinski L(+)",
    "hyperreflexia",
    "clonus",
  ]),
  pe("neuro_dixhallpike", "NEURO", "Dix-Hallpike", "Dix-Hallpike(-)", [
    "Dix-Hallpike R(+)",
    "Dix-Hallpike L(+)",
  ]),
];

const peById = new Map<string, PeItem>(PE_ITEMS.map((item) => [item.id, item]));

export function peItem(id: string): PeItem | undefined {
  return peById.get(id);
}

/** 病歷表單上的 PE 欄位順序與標題。 */
export const PE_FIELD_ORDER: readonly EdPeField[] = [
  "GC",
  "HEENT",
  "NECK",
  "CHEST",
  "ABD",
  "BACK",
  "GU",
  "RECTAL",
  "EXT",
  "NEURO",
];

export const PE_FIELD_LABELS: Record<EdPeField, string> = {
  GC: "GENERAL CONDITION",
  HEENT: "HEENT",
  NECK: "NECK",
  CHEST: "CHEST And LUNGS",
  ABD: "ABDOMEN",
  BACK: "BACK And SPINE",
  GU: "EXOGENITALIA",
  RECTAL: "RECTAL EXAM",
  EXT: "EXTREMITIES",
  NEURO: "NEUROLOGICAL EXAM",
};

/**
 * 病歷欄位字數有限（HEENT／NECK 等僅 60 字）。同一欄正常片語合計超過上限時，
 * 改用這裡的精簡寫法重新組合。沒有列在這裡的題目維持原文。
 */
export const PE_SHORT_NORMAL: Readonly<Record<string, string>> = {
  heent_pupil: "LR(+)",
  heent_throat: "throat inj(-)",
  heent_ent: "ENT ok",
  heent_head_trauma: "no head injury",
  heent_eye: "eye ok",
  neck_stiff: "supple",
  neck_accessory: "no accessory muscle use",
  neck_lap: "LAP(-)",
  neck_spine: "C-spine tender(-)",
  chest_pattern: "smooth breathing",
  chest_bs: "clear BS",
  heart_rhythm: "RHB",
  chest_wall: "no chest wall tender",
  chest_expansion: "symmetric",
  abd_bs: "normal BS",
  abd_guard: "guarding(-)",
  abd_rebound: "rebounding(-)",
  abd_murphy: "Murphy(-)",
  abd_appendix: "McBurney(-)",
  abd_mass: "no mass",
  back_cva: "CVA knocking(-)",
  back_spine: "spine tender(-)",
  back_sore: "no pressure sore",
  gu_bladder: "no suprapubic tenderness",
  ext_edema: "no edema",
  ext_calf: "no calf pain",
  ext_pulse: "pulse ok, CRT<2s",
  neuro_mp: "MP full",
  neuro_face: "no facial palsy",
  neuro_cerebellar: "FNF/gait ok",
  neuro_sensory: "sensation intact",
};

/** 精簡寫法仍超過字數時，全部正常的欄位改用這個總結句。 */
export const PE_COLLAPSED_NORMAL: Readonly<Record<EdPeField, string>> = {
  GC: "Not ill-looking, GCS:15",
  HEENT: "HEENT unremarkable",
  NECK: "neck unremarkable",
  CHEST: "chest/heart unremarkable",
  ABD: "abdomen unremarkable",
  BACK: "back unremarkable",
  GU: "no abnormality",
  RECTAL: "DRE unremarkable",
  EXT: "extremities unremarkable",
  NEURO: "No focal neurological deficit",
};
