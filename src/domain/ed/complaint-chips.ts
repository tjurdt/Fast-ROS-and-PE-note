import type { FindingValue } from "../clinical/finding";
import { maxComplaintSeq } from "./complaints";
import { historyItem } from "./history-library";
import { addPick, pickedOptions, removePick } from "./picks";
import { ED_PROBLEMS } from "./problems";
import { edKey } from "./types";

/**
 * 主訴分頁的按鈕：一顆按鈕一個症狀、四個字以內。
 *
 * 一個題庫問題常常涵蓋好幾個症狀（例如「耳鼻喉」包含喉嚨痛、耳痛、流鼻血…），
 * 所以按鈕可以是：
 *   - 問題本身（plain）：點了就選這個問題；
 *   - 問題＋某個選項（pick）：選問題，並在它的分型題勾這個選項（可複選）；
 *   - 問題＋某題「有」（yes）：選問題，並把那一題標成「有」。
 * 同一個問題的分拆按鈕全部取消時，問題也一起取消。
 */
export interface ComplaintChip {
  key: string;
  label: string;
  problem: string;
  pick?: { item: string; option: string };
  yes?: string;
}

export interface ChipSection {
  key: string;
  title: string;
  /** 小科：預設收起來，點三角形才展開。 */
  minor?: boolean;
  chips: ComplaintChip[];
}

type Findings = Readonly<Record<string, FindingValue | undefined>>;

const plain = (problem: string, label: string): ComplaintChip => ({
  key: problem,
  label,
  problem,
});
const viaPick = (
  problem: string,
  item: string,
  option: string,
  label: string,
): ComplaintChip => ({
  key: `${problem}:${option}`,
  label,
  problem,
  pick: { item, option },
});
const viaYes = (problem: string, item: string, label: string): ComplaintChip => ({
  key: `${problem}:${item}`,
  label,
  problem,
  yes: item,
});

export const CHIP_SECTIONS: readonly ChipSection[] = [
  {
    key: "general",
    title: "全身",
    chips: [
      plain("fever", "發燒"),
      plain("weakness", "無力倦怠"),
      plain("bp_abnormal", "血壓異常"),
      plain("glucose", "血糖異常"),
      plain("lab_referral", "檢驗異常"),
      plain("edema", "水腫"),
      plain("poor_intake", "進食差"),
      viaPick("env_injury", "env_type", "中暑", "中暑"),
      viaPick("env_injury", "env_type", "低體溫", "低體溫"),
      viaPick("env_injury", "env_type", "溺水", "溺水"),
      viaPick("env_injury", "env_type", "電擊", "電擊"),
      viaPick("env_injury", "env_type", "一氧化碳", "CO中毒"),
      plain("device_prob", "管路問題"),
    ],
  },
  {
    key: "cardiopulmonary",
    title: "心肺",
    chips: [
      plain("chest_pain", "胸痛胸悶"),
      plain("dyspnea", "喘"),
      plain("wheeze", "喘鳴氣喘"),
      plain("palpitation", "心悸"),
      plain("syncope", "暈厥"),
      plain("cough_uri", "咳嗽"),
      plain("hemoptysis", "咳血"),
    ],
  },
  {
    key: "gi",
    title: "消化",
    chips: [
      plain("abd_pain", "腹痛"),
      plain("nausea_vomiting", "噁心嘔吐"),
      plain("diarrhea", "腹瀉"),
      plain("constipation_bloating", "便秘腹脹"),
      plain("reflux", "火燒心"),
      viaPick("gi_bleed", "gib_type", "黑便", "黑便"),
      viaPick("gi_bleed", "gib_type", "血便", "血便"),
      viaPick("gi_bleed", "gib_type", "吐血", "吐血"),
      plain("jaundice", "黃疸"),
      viaPick("anorectal", "anal_type", "肛門痛", "肛門痛"),
      viaPick("anorectal", "anal_type", "肛門出血", "肛門出血"),
      viaPick("anorectal", "anal_type", "肛門腫塊", "肛門腫塊"),
      viaPick("anorectal", "anal_type", "肛周腫痛流膿", "肛周膿瘍"),
    ],
  },
  {
    key: "urinary",
    title: "泌尿",
    chips: [
      viaPick("urinary", "uri_type", "解尿疼痛", "解尿痛"),
      viaPick("urinary", "uri_type", "頻尿", "頻尿"),
      viaPick("urinary", "uri_type", "血尿", "血尿"),
      viaPick("urinary", "uri_type", "解不出來", "解不出"),
      viaPick("urinary", "uri_type", "腰／側腹痛", "腰側痛"),
      viaPick("urinary", "uri_type", "尿量減少", "尿少"),
      viaPick("scrotal", "scrotal_sx", "陰囊痛", "陰囊痛"),
      viaPick("scrotal", "scrotal_sx", "睪丸痛", "睪丸痛"),
      viaPick("scrotal", "scrotal_sx", "陰囊腫", "陰囊腫"),
      viaPick("scrotal", "scrotal_sx", "包皮紅腫", "包皮陰莖"),
    ],
  },
  {
    key: "neuro",
    title: "神經",
    chips: [
      plain("dizziness", "頭暈"),
      plain("headache", "頭痛"),
      viaYes("focal_neuro", "weak_focal", "單側無力"),
      viaYes("focal_neuro", "numb", "麻木"),
      viaYes("focal_neuro", "slurred", "口齒不清"),
      viaYes("focal_neuro", "facial_droop", "臉歪"),
      plain("ams", "意識改變"),
      plain("seizure", "抽搐"),
    ],
  },
  {
    key: "trauma",
    title: "外傷骨科",
    chips: [
      plain("trauma", "外傷跌倒"),
      plain("head_injury", "頭外傷"),
      plain("limb_injury", "肢體傷"),
      viaPick("wound", "wound_type", "撕裂傷", "撕裂傷"),
      viaPick("wound", "wound_type", "擦傷", "擦傷"),
      viaPick("wound", "wound_type", "穿刺傷", "穿刺傷"),
      plain("burn", "燒燙傷"),
      viaPick("bite_sting", "bite_animal", "狗", "狗咬"),
      viaPick("bite_sting", "bite_animal", "貓", "貓咬抓"),
      viaPick("bite_sting", "bite_animal", "蛇", "蛇咬"),
      viaPick("bite_sting", "bite_animal", "蜂／蟲", "蜂蟲螫"),
      viaPick("back_pain", "back_site", "頸", "頸痛"),
      viaPick("back_pain", "back_site", "上背／胸背", "上背痛"),
      viaPick("back_pain", "back_site", "下背／腰", "腰痛"),
      plain("limb", "肢體腫痛"),
      viaPick("joint_pain", "joint_site", "肩", "肩痛"),
      viaPick("joint_pain", "joint_site", "膝", "膝痛"),
      viaPick("joint_pain", "joint_site", "髖", "髖痛"),
      viaPick("joint_pain", "joint_site", "踝", "踝痛"),
      viaPick("joint_pain", "joint_site", "手腕", "腕痛"),
      plain("cellulitis", "蜂窩織炎"),
      viaPick("foreign_body", "fb_site", "喉嚨／食道", "吞異物"),
      viaPick("foreign_body", "fb_site", "鼻子", "鼻異物"),
      viaPick("foreign_body", "fb_site", "耳朵", "耳異物"),
      viaPick("foreign_body", "fb_site", "眼睛", "眼異物"),
      viaPick("foreign_body", "fb_site", "肛門／直腸", "肛門異物"),
    ],
  },
  {
    key: "minor",
    title: "小科",
    minor: true,
    chips: [
      plain("gyn", "陰道出血"),
      plain("preg_issue", "孕期不適"),
      viaPick("ent", "ent_type", "喉嚨痛", "喉嚨痛"),
      viaPick("ent", "ent_type", "耳痛", "耳痛"),
      viaPick("ent", "ent_type", "流鼻血", "流鼻血"),
      viaPick("ent", "ent_type", "吞嚥困難／梗到", "吞嚥困難"),
      viaPick("ent", "ent_type", "聲音沙啞", "聲音沙啞"),
      viaPick("ent", "ent_type", "頸部腫塊", "頸部腫塊"),
      viaPick("dental", "dental_sx", "牙痛", "牙痛"),
      viaPick("dental", "dental_sx", "牙齦腫", "牙齦腫"),
      viaPick("dental", "dental_sx", "口腔潰瘍", "口腔潰瘍"),
      viaPick("dental", "dental_sx", "拔牙後出血", "拔牙出血"),
      viaPick("eye", "eye_type", "視力模糊", "視力模糊"),
      viaPick("eye", "eye_type", "眼痛", "眼痛"),
      viaPick("eye", "eye_type", "紅眼", "紅眼"),
      viaPick("eye", "eye_type", "複視", "複視"),
      viaPick("eye", "eye_type", "視野缺損／閃光", "視野缺損"),
      viaPick("eye", "eye_type", "異物感", "眼異物感"),
      plain("skin_allergy", "皮疹過敏"),
      plain("bleeding", "出血傾向"),
      viaPick("psych", "psych_type", "焦慮／恐慌", "焦慮"),
      viaPick("psych", "psych_type", "自殺意念", "自殺意念"),
      viaPick("psych", "psych_type", "自傷／服藥過量", "自傷"),
      viaPick("psych", "psych_type", "躁動", "躁動"),
      viaPick("psych", "psych_type", "失眠", "失眠"),
      viaPick("psych", "psych_type", "幻覺", "幻覺"),
      viaPick("intox", "ingest_substance", "酒精", "酒醉"),
      viaPick("intox", "ingest_substance", "安眠鎮靜藥", "安眠藥"),
      viaPick("intox", "ingest_substance", "止痛藥 APAP", "止痛藥"),
      viaPick("intox", "ingest_substance", "農藥", "農藥"),
      viaPick("intox", "ingest_substance", "清潔劑／漂白水", "清潔劑"),
      viaPick("intox", "ingest_substance", "毒品", "毒品"),
    ],
  },
];

export const ALL_CHIPS: readonly ComplaintChip[] = CHIP_SECTIONS.flatMap(
  (section) => section.chips,
);

const problemOn = (findings: Findings, problem: string) =>
  findings[edKey.problem(problem)]?.on === true;

function chipDetailOn(findings: Findings, chip: ComplaintChip): boolean {
  if (chip.pick)
    return pickedOptions(findings, chip.pick.item).includes(chip.pick.option);
  if (chip.yes) return findings[edKey.history(chip.yes)]?.on === true;
  return true;
}

export function chipActive(findings: Findings, chip: ComplaintChip): boolean {
  return problemOn(findings, chip.problem) && chipDetailOn(findings, chip);
}

/** 點一下按鈕要寫回的 findings（可能同時改問題與分型題）。 */
export function toggleChip(
  findings: Findings,
  chip: ComplaintChip,
): Record<string, FindingValue> {
  const patch: Record<string, FindingValue> = {};
  const active = chipActive(findings, chip);
  const pickItem = chip.pick ? historyItem(chip.pick.item) : undefined;
  const historyKey = chip.pick
    ? edKey.history(chip.pick.item)
    : chip.yes
      ? edKey.history(chip.yes)
      : null;

  if (!active) {
    if (!problemOn(findings, chip.problem)) {
      patch[edKey.problem(chip.problem)] = {
        on: true,
        note: String(maxComplaintSeq(findings) + 1),
      };
    }
    if (chip.pick && pickItem?.type === "pick" && historyKey) {
      patch[historyKey] = addPick(
        pickItem,
        findings[historyKey] ?? {},
        chip.pick.option,
      );
    } else if (chip.yes && historyKey) {
      patch[historyKey] = { ...(findings[historyKey] ?? {}), on: true };
    }
    return patch;
  }

  if (!chip.pick && !chip.yes) {
    patch[edKey.problem(chip.problem)] = { on: false };
    return patch;
  }
  if (chip.pick && pickItem?.type === "pick" && historyKey) {
    patch[historyKey] = removePick(
      pickItem,
      findings[historyKey] ?? {},
      chip.pick.option,
    );
  } else if (historyKey) {
    patch[historyKey] = {};
  }
  // 這個問題的分拆按鈕都取消了 → 問題也取消。
  const after = { ...findings, ...patch };
  const siblings = ALL_CHIPS.filter(
    (other) => other.problem === chip.problem && (other.pick || other.yes),
  );
  if (!siblings.some((other) => chipDetailOn(after, other))) {
    patch[edKey.problem(chip.problem)] = { on: false };
  }
  return patch;
}

/** 給測試：每個題庫問題都至少有一顆按鈕。 */
export function problemsWithoutChip(): string[] {
  const covered = new Set(ALL_CHIPS.map((chip) => chip.problem));
  return ED_PROBLEMS.map((problem) => problem.id).filter((id) => !covered.has(id));
}
