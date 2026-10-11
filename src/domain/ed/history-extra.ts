import { pick, text, yn } from "./history-builders";
import type { HistoryItem, PmhItem } from "./types";

/** 選項：中文按鈕、英文片語，另外可指定「只補細節」時用的短片語。 */
const o = (label: string, textValue: string, detail?: string) =>
  detail === undefined
    ? { label, text: textValue }
    : { label, text: textValue, detail };

/**
 * 第四輪新增的問診題（OPQRST 通用題、各系統細節、新增主訴專屬題）。
 * 順序只影響同一系統內的排列；放在這個檔案是為了不讓 history-library.ts 繼續膨脹。
 */
const RAW_HISTORY_EXTRA: readonly HistoryItem[] = [
  // ── 通用病程（OPQRST）────────────────────────────────────
  pick(
    "course",
    "const",
    "目前趨勢",
    [
      o("越來越嚴重", "worsening trend"),
      o("沒變化", "unchanged"),
      o("好轉中", "improving"),
      o("時好時壞", "waxing and waning"),
    ],
    {},
  ),
  pick(
    "episode",
    "const",
    "發作次數",
    [
      o("第一次", "first episode"),
      o("反覆發作", "recurrent episodes"),
      o("慢性急性惡化", "acute exacerbation of chronic symptoms"),
    ],
    {},
  ),
  pick(
    "aggravate",
    "const",
    "加重因素",
    [
      o("動作／走路", "aggravated by movement"),
      o("深呼吸", "aggravated by deep breathing"),
      o("進食後", "aggravated after meals"),
      o("空腹", "aggravated when fasting"),
      o("姿勢", "aggravated by posture"),
      o("咳嗽／用力", "aggravated by coughing/straining"),
      o("排便排尿", "aggravated by defecation/urination"),
      o("活動", "aggravated by exertion"),
      o("平躺", "aggravated when lying flat"),
    ],
    { multi: true },
  ),
  pick(
    "alleviate",
    "const",
    "緩解因素",
    [
      o("休息", "relieved by rest"),
      o("止痛藥", "partially relieved by analgesics"),
      o("排便後", "relieved after defecation"),
      o("改變姿勢", "relieved by changing posture"),
      o("進食後", "relieved by eating"),
      o("吃藥無效", "no relief with medication"),
      o("NTG／噴劑", "relieved by NTG/inhaler"),
    ],
    { multi: true },
  ),
  yn("poor_intake", "const", "進食／喝水變少", "poor oral intake", {
    detail: { placeholder: "幾天／量" },
  }),
  yn("weight_gain", "const", "體重增加", "body weight gain", {
    detail: { placeholder: "幾公斤／多久" },
  }),
  yn("med_new", "const", "近期新藥或換藥", "recent new medication", {
    detail: { placeholder: "藥名" },
  }),
  yn("med_noncompliance", "const", "漏藥或自行停藥", "medication non-compliance", {
    neg: "medication non-compliance",
    detail: { placeholder: "哪些藥／多久" },
  }),
  yn("travel", "const", "近期旅遊", "recent travel", {
    detail: { placeholder: "去哪／何時" },
  }),
  yn("heat_exposure", "const", "高溫環境／悶熱", "heat exposure"),
  yn("cold_exposure", "const", "寒冷暴露", "cold exposure"),
  yn("lymph_swelling", "const", "淋巴結腫大", "lymph node swelling", {
    detail: { placeholder: "部位" },
  }),

  // ── 呼吸 ────────────────────────────────────────────────
  pick(
    "cough_char",
    "resp",
    "咳嗽性質",
    [
      o("乾咳", "dry"),
      o("有痰", "productive"),
      o("陣發", "paroxysmal"),
      o("夜間", "nocturnal"),
      o("犬吠樣", "barking"),
      o("咳到吐", "post-tussive emesis"),
      o("咳到喘", "with wheezing"),
    ],
    { multi: true, joinTemplate: "cough ({v})" },
  ),
  pick(
    "hemoptysis_amt",
    "resp",
    "咳血量",
    [
      o("血絲", "blood-streaked sputum"),
      o("少量鮮血", "small-volume hemoptysis"),
      o("中量", "moderate hemoptysis"),
      o("大量", "massive hemoptysis"),
    ],
    {},
  ),
  yn("inhaler_use", "resp", "已用過吸入劑", "used inhaler", {
    neg: "inhaler use",
    detail: { placeholder: "幾次／有無效" },
  }),
  yn("choking", "resp", "嗆到／異物哽住", "choking/aspiration"),
  yn("hoarse_h", "resp", "聲音沙啞", "hoarseness"),
  yn("stridor_h", "resp", "吸氣有聲／喉嚨緊", "noisy breathing/stridor"),
  yn("inhal_exposure", "resp", "吸入煙霧／化學／粉塵", "inhalation exposure", {
    detail: { placeholder: "什麼／多久" },
  }),
  yn("smoker", "resp", "目前抽菸", "current smoker", {
    neg: "smoking",
    detail: { placeholder: "包年" },
  }),

  // ── 心血管 ──────────────────────────────────────────────
  text("chest_duration", "cv", "每次持續多久", "each episode lasts {v}", {
    placeholder: "例 10 分鐘",
  }),
  yn("chest_rest_relief", "cv", "休息或舌下NTG緩解", "relieved by rest/NTG", {
    neg: "relief by rest",
  }),
  text("palp_duration", "cv", "心悸每次多久", "episodes last {v}", {
    placeholder: "例 數分鐘",
  }),
  yn("syncope_prodrome", "cv", "暈前有前兆", "prodromal symptoms", {
    neg: "prodromal symptoms",
  }),
  yn("syncope_witnessed", "cv", "有人目擊", "witnessed event", {
    detail: { placeholder: "抽搐／臉色／多久" },
  }),
  yn("orthostatic", "cv", "站起來頭暈", "orthostatic dizziness", {
    neg: "orthostatic dizziness",
  }),

  // ── 消化 ────────────────────────────────────────────────
  pick(
    "abd_radiate",
    "gi",
    "放射到",
    [
      o("背部", "radiating to back"),
      o("右肩", "radiating to R shoulder"),
      o("鼠蹊／睪丸", "radiating to groin"),
      o("胸口", "radiating to chest"),
      o("腰側", "radiating to flank"),
      o("下肢", "radiating to leg"),
    ],
    { multi: true },
  ),
  pick(
    "abd_eat",
    "gi",
    "和進食關係",
    [
      o("飯後加重", "worse after meals"),
      o("空腹加重", "worse when fasting"),
      o("吃了緩解", "relieved by eating"),
      o("油膩後", "after fatty meal"),
    ],
    { multi: true },
  ),
  pick(
    "stool_char",
    "gi",
    "糞便性狀",
    [
      o("水瀉", "watery"),
      o("黏液", "mucoid"),
      o("油便", "greasy"),
      o("帶血", "bloody"),
      o("黑色", "black"),
      o("細條", "pencil-thin"),
      o("硬塊", "hard stool"),
    ],
    { multi: true, joinTemplate: "stool ({v})" },
  ),
  pick(
    "vomit_char",
    "gi",
    "嘔吐內容",
    [
      o("食物", "food contents"),
      o("膽汁", "bilious"),
      o("咖啡渣", "coffee-ground"),
      o("鮮血", "bloody"),
      o("糞臭", "feculent"),
      o("清水", "clear fluid"),
    ],
    { multi: true, joinTemplate: "vomitus ({v})" },
  ),
  text("diarrhea_freq", "gi", "腹瀉每天次數", "{v} bowel movements/day", {
    placeholder: "例 6",
  }),
  text("last_bm", "gi", "最後一次排便", "last BM {v}", {
    placeholder: "例 3 天前",
  }),
  yn("bowel_change", "gi", "排便習慣改變", "change in bowel habit"),
  yn("tenesmus", "gi", "裡急後重", "tenesmus"),
  yn("fb_ingest", "gi", "吞到異物", "foreign body ingestion", {
    detail: { placeholder: "什麼／何時" },
  }),
  pick(
    "reflux_sx",
    "gi",
    "消化不良症狀",
    [
      o("火燒心", "heartburn"),
      o("酸水逆流", "acid regurgitation"),
      o("胃脹", "epigastric fullness"),
      o("打嗝", "belching/hiccups"),
      o("早飽", "early satiety"),
      o("胃痛", "epigastric pain"),
    ],
    { multi: true },
  ),
  pick(
    "anal_type",
    "gi",
    "肛門症狀",
    [
      o("肛門痛", "anal pain", "pain"),
      o("肛門出血", "anal bleeding", "bleeding"),
      o("肛門腫塊", "anal mass/prolapse", "mass"),
      o("肛門搔癢", "perianal itching", "itching"),
      o("肛周腫痛流膿", "perianal swelling/pus", "swelling/pus"),
    ],
    { multi: true },
  ),
  pick(
    "dental_sx",
    "gi",
    "牙口症狀",
    [
      o("牙痛", "toothache"),
      o("牙齦腫", "gum swelling"),
      o("口腔潰瘍", "oral ulcer"),
      o("拔牙後出血", "post-extraction bleeding"),
      o("嘴唇舌頭腫", "lip/tongue swelling"),
      o("顎關節痛", "TMJ pain"),
      o("牙齒斷裂", "broken tooth"),
      o("張口困難", "trismus"),
    ],
    { multi: true },
  ),
  yn("anal_pain_bm", "gi", "排便時加劇", "pain worse with defecation", {
    neg: "pain with defecation",
  }),
  yn("hemorrhoid_hx", "gi", "痔瘡病史", "hemorrhoid history"),

  // ── 泌尿生殖 ────────────────────────────────────────────
  pick(
    "urine_color",
    "gu",
    "尿的顏色",
    [
      o("紅色", "red urine"),
      o("茶色", "tea-colored urine"),
      o("混濁", "cloudy urine"),
      o("泡沫多", "foamy urine"),
      o("臭味重", "foul-smelling urine"),
    ],
    { multi: true },
  ),
  yn("urine_stream", "gu", "尿流變細／中斷", "weak or interrupted stream"),
  yn("incontinence", "gu", "漏尿", "urinary incontinence"),
  yn("stone_hx", "gu", "腎結石病史", "history of urolithiasis"),
  pick(
    "scrotal_sx",
    "gu",
    "陰囊症狀",
    [
      o("陰囊痛", "scrotal pain", "scrotal pain"),
      o("睪丸痛", "testicular pain", "testicular pain"),
      o("陰囊腫", "scrotal swelling", "scrotal swelling"),
      o("陰囊紅熱", "scrotal erythema", "scrotal erythema"),
      o("陰莖痛", "penile pain", "penile pain"),
      o("包皮紅腫", "foreskin swelling", "foreskin swelling"),
      o("勃起不退", "prolonged erection", "prolonged erection"),
    ],
    { multi: true },
  ),
  yn("sex_active", "gu", "有性行為", "sexually active", {
    neg: "sexual activity",
    detail: { placeholder: "有無保護措施" },
  }),
  pick(
    "vag_amount",
    "gu",
    "陰道出血量",
    [
      o("點狀", "spotting"),
      o("像月經", "menses-like"),
      o("比月經多", "heavier than menses"),
      o("大量", "profuse"),
    ],
    {},
  ),
  yn("clots", "gu", "血塊", "passing clots", { gate: "fertile" }),
  text("preg_ga", "gu", "懷孕週數 GA", "GA {v}", {
    placeholder: "例 20w",
    gate: "fertile",
  }),
  yn("fetal_move", "gu", "胎動減少", "decreased fetal movement", {
    gate: "fertile",
    neg: "decreased fetal movement",
  }),
  yn("leak_fluid", "gu", "疑似破水", "leakage of fluid", {
    gate: "fertile",
  }),
  yn("contraction", "gu", "規則宮縮", "regular contractions", {
    gate: "fertile",
  }),
  yn("preg_htn", "gu", "孕期高血壓／水腫", "gestational HTN/edema", {
    gate: "fertile",
  }),

  // ── 神經 ────────────────────────────────────────────────
  pick(
    "headache_site",
    "neuro",
    "頭痛部位",
    [
      o("前額", "frontal"),
      o("兩側太陽穴", "bitemporal"),
      o("單側", "unilateral"),
      o("後枕", "occipital"),
      o("全頭", "holocephalic"),
      o("眼眶後", "retro-orbital"),
      o("頭頂", "vertex"),
    ],
    { multi: true, joinTemplate: "headache ({v})" },
  ),
  pick(
    "headache_quality",
    "neuro",
    "頭痛性質",
    [
      o("搏動", "throbbing"),
      o("緊箍", "band-like pressure"),
      o("刺痛", "stabbing"),
      o("悶痛", "dull"),
      o("電擊樣", "electric shock-like"),
    ],
    { multi: true, joinTemplate: "headache ({v})" },
  ),
  yn("headache_valsalva", "neuro", "咳嗽用力加重", "worse with Valsalva", {
    neg: "Valsalva aggravation",
  }),
  yn("headache_aura", "neuro", "有先兆", "aura (visual/sensory)", { neg: "aura" }),
  yn("headache_morning", "neuro", "晨起最嚴重", "worse in the morning", {
    neg: "morning predominance",
  }),
  pick(
    "dizzy_duration",
    "neuro",
    "每次暈多久",
    [
      o("數秒", "episodes last seconds"),
      o("數分鐘", "episodes last minutes"),
      o("數小時", "episodes last hours"),
      o("持續數天", "continuous for days"),
    ],
    {},
  ),
  pick(
    "weak_dist",
    "neuro",
    "無力分布",
    [
      o("右側", "right-sided"),
      o("左側", "left-sided"),
      o("雙下肢", "both legs"),
      o("四肢", "all four limbs"),
      o("單一肢體", "single limb"),
      o("近端", "proximal"),
      o("遠端", "distal"),
    ],
    { multi: true, joinTemplate: "weakness ({v})" },
  ),
  pick(
    "numb_dist",
    "neuro",
    "麻木分布",
    [
      o("右半身", "right hemibody"),
      o("左半身", "left hemibody"),
      o("臉", "face"),
      o("手指", "fingers"),
      o("腳", "feet"),
      o("環口", "perioral"),
      o("單一肢體", "single limb"),
      o("手套襪套", "glove-stocking"),
    ],
    { multi: true, joinTemplate: "numbness ({v})" },
  ),
  yn("face_pain", "neuro", "臉痛／電擊樣", "facial pain"),
  yn("tinnitus", "neuro", "耳鳴", "tinnitus", { neg: "tinnitus" }),
  yn("tremor", "neuro", "顫抖", "tremor"),
  pick(
    "seizure_type",
    "neuro",
    "抽搐型態",
    [
      o("全身強直陣攣", "generalized tonic-clonic"),
      o("局部抽動", "focal twitching"),
      o("失神發呆", "absence/staring spell"),
      o("僵直", "tonic stiffening"),
    ],
    { multi: true },
  ),
  text("seizure_dur", "neuro", "抽搐持續多久", "episode duration {v}", {
    placeholder: "例 3 分鐘",
  }),
  yn("seizure_first", "neuro", "第一次抽搐", "first-ever episode"),
  yn("postictal", "neuro", "發作後意識不清", "postictal confusion"),
  yn("tongue_bite", "neuro", "咬到舌頭", "tongue bite"),
  yn("incont_seiz", "neuro", "失禁", "incontinence during event"),
  yn("saddle_numb", "neuro", "會陰／鞍區麻木", "saddle anesthesia"),
  yn("bowel_bladder", "neuro", "大小便失禁或解不出", "bowel/bladder dysfunction", {
    neg: "bowel/bladder dysfunction",
  }),
  yn("night_pain", "neuro", "夜間痛醒／休息不緩解", "night pain/rest pain", {
    neg: "night pain",
  }),

  // ── 外傷 ────────────────────────────────────────────────
  yn("wound_contam", "trauma", "傷口髒／泥土／生鏽", "contaminated wound"),
  pick(
    "bite_animal",
    "trauma",
    "咬傷／螫傷來源",
    [
      o("狗", "dog bite", "dog"),
      o("貓", "cat bite", "cat"),
      o("人", "human bite", "human"),
      o("蛇", "snake bite", "snake"),
      o("蜂／蟲", "insect sting/bite", "insect"),
      o("蜈蚣蜘蛛", "centipede/spider bite", "centipede/spider"),
      o("海洋生物", "marine animal sting", "marine animal"),
      o("老鼠", "rodent bite", "rodent"),
    ],
    { multi: true },
  ),
  pick(
    "burn_cause",
    "trauma",
    "燒燙傷原因",
    [
      o("熱水／蒸氣", "scald (hot liquid/steam)"),
      o("火焰", "flame burn"),
      o("接觸高溫物", "contact burn"),
      o("化學物", "chemical burn"),
      o("電擊", "electrical burn"),
      o("日曬", "sunburn"),
    ],
    { multi: true },
  ),
  text("burn_site", "trauma", "燒燙傷部位／面積", "burn at {v}", {
    placeholder: "例 R forearm 1%",
  }),
  yn("helmet", "trauma", "有戴安全帽／安全帶", "helmet/seatbelt use", {
    neg: "helmet/seatbelt use",
  }),
  yn("deformity", "trauma", "明顯變形", "visible deformity"),
  yn("bear_weight", "trauma", "能負重／走路", "able to bear weight", {
    negPhrase: "unable to bear weight",
  }),
  pick(
    "fb_site",
    "trauma",
    "異物位置",
    [
      o("眼睛", "foreign body in eye"),
      o("耳朵", "foreign body in ear"),
      o("鼻子", "foreign body in nose"),
      o("喉嚨／食道", "foreign body in throat/esophagus"),
      o("皮膚／軟組織", "foreign body in soft tissue"),
      o("肛門／直腸", "foreign body in rectum"),
      o("陰道／尿道", "foreign body in vagina/urethra"),
      o("吸入氣管", "aspirated foreign body"),
    ],
    { multi: true },
  ),
  text("fb_time", "trauma", "異物何時進去", "foreign body since {v}", {
    placeholder: "例 今天 14:00",
  }),
  pick(
    "wound_type",
    "trauma",
    "傷口種類",
    [
      o("撕裂傷", "laceration", "laceration"),
      o("擦傷", "abrasion", "abrasion"),
      o("穿刺傷", "puncture wound", "puncture wound"),
      o("咬傷", "bite wound", "bite wound"),
      o("切割傷", "cut wound", "cut wound"),
      o("挫傷血腫", "contusion/hematoma", "contusion"),
    ],
    { multi: true },
  ),

  // ── 皮膚／肌肉骨骼 ──────────────────────────────────────
  pick(
    "joint_site",
    "msk",
    "關節部位",
    [
      o("肩", "shoulder", "shoulder"),
      o("手肘", "elbow", "elbow"),
      o("手腕", "wrist", "wrist"),
      o("手指", "finger", "finger"),
      o("髖", "hip", "hip"),
      o("膝", "knee", "knee"),
      o("踝", "ankle", "ankle"),
      o("腳趾／足", "toe/foot", "foot"),
    ],
    { multi: true, joinTemplate: "joint pain ({v})" },
  ),
  pick(
    "limb_side",
    "msk",
    "左右側",
    [o("右", "R", "R"), o("左", "L", "L"), o("雙側", "bilateral", "bil")],
    { multi: true, joinTemplate: "side ({v})" },
  ),
  pick(
    "rash_dist",
    "msk",
    "皮疹分布",
    [
      o("臉", "face"),
      o("軀幹", "trunk"),
      o("四肢", "limbs"),
      o("手掌腳掌", "palms/soles"),
      o("全身", "generalized"),
      o("單側帶狀", "unilateral dermatomal"),
      o("皺摺處", "intertriginous"),
    ],
    { multi: true, joinTemplate: "rash ({v})" },
  ),
  pick(
    "rash_type",
    "msk",
    "皮疹型態",
    [
      o("紅斑", "erythematous"),
      o("丘疹", "papular"),
      o("水泡", "vesicular"),
      o("蕁麻疹風團", "urticarial wheals"),
      o("紫斑", "purpuric"),
      o("脫屑", "scaly"),
      o("膿皰", "pustular"),
    ],
    { multi: true, joinTemplate: "rash ({v})" },
  ),
  yn("pus", "msk", "流膿／化膿", "purulent discharge"),
  yn("spreading_red", "msk", "紅腫範圍擴大", "spreading erythema", {
    neg: "spreading erythema",
  }),
  yn("lymphangitis", "msk", "紅線往上延伸", "lymphangitic streaking"),
  yn("burning_pain", "msk", "皮膚灼痛／刺痛", "burning dermatomal pain"),
  yn("joint_hot", "msk", "關節紅熱", "joint redness/warmth"),
  yn("gout_trigger", "msk", "吃海鮮啤酒／脫水誘發", "possible gout trigger", {
    detail: { placeholder: "什麼" },
  }),

  // ── 出血／抗凝 ──────────────────────────────────────────
  yn("menorrhagia", "bleed", "月經量多", "heavy menstrual bleeding", {
    gate: "fertile",
  }),

  // ── 精神／中毒 ──────────────────────────────────────────
  pick(
    "ingest_substance",
    "psych",
    "服用什麼",
    [
      o("酒精", "alcohol"),
      o("安眠鎮靜藥", "sedative/hypnotic"),
      o("止痛藥 APAP", "acetaminophen"),
      o("NSAID", "NSAID"),
      o("抗憂鬱／精神科藥", "psychiatric medication"),
      o("降血壓／心臟藥", "cardiac/antihypertensive medication"),
      o("降血糖藥／胰島素", "antidiabetic medication/insulin"),
      o("毒品", "illicit drug"),
      o("農藥", "pesticide"),
      o("清潔劑／漂白水", "household chemical"),
      o("木炭／一氧化碳", "carbon monoxide"),
      o("不明", "unknown substance"),
    ],
    { multi: true, joinTemplate: "ingestion ({v})" },
  ),
  text("ingest_time", "psych", "服用時間", "ingested at {v}", {
    placeholder: "例 今天 20:00",
  }),
  text("ingest_amount", "psych", "服用量", "amount: {v}", {
    placeholder: "例 20 顆",
  }),
  pick(
    "ingest_intent",
    "psych",
    "意圖",
    [
      o("自傷", "intentional self-harm"),
      o("意外", "accidental"),
      o("不明", "intent unclear"),
    ],
    {},
  ),
  yn("withdrawal", "psych", "戒斷症狀（手抖／冒汗／幻覺）", "withdrawal symptoms"),
  text("last_drink", "psych", "最後一次飲酒", "last drink {v}", {
    placeholder: "例 昨晚",
  }),
  yn("suicide_plan", "psych", "有計畫或方法", "suicide plan", {
    neg: "suicide plan",
  }),
  yn("homicidal", "psych", "傷人意念", "homicidal ideation", {
    neg: "homicidal ideation",
  }),
  yn("psych_med_stop", "psych", "停藥或換藥", "psychiatric medication change", {
    neg: "psychiatric medication change",
  }),

  // ── 環境／管路 ──────────────────────────────────────────
  pick(
    "env_type",
    "meta",
    "環境傷害類型",
    [
      o("中暑", "heat illness"),
      o("低體溫", "hypothermia"),
      o("凍傷", "frostbite"),
      o("溺水", "near-drowning"),
      o("電擊", "electrical injury"),
      o("一氧化碳", "carbon monoxide exposure"),
      o("毒氣／煙霧", "smoke/toxic gas inhalation"),
    ],
    { multi: true },
  ),
  text("env_duration", "meta", "暴露多久", "exposure for {v}", {
    placeholder: "例 2 小時",
  }),
  pick(
    "device_type",
    "meta",
    "管路種類",
    [
      o("Foley", "Foley catheter"),
      o("鼻胃管", "NG tube"),
      o("胃造口", "gastrostomy tube"),
      o("腎造瘻", "nephrostomy"),
      o("膽道引流", "biliary drain"),
      o("氣切", "tracheostomy"),
      o("Port-A", "Port-A catheter"),
      o("腸造口", "ostomy"),
      o("胸管", "chest tube"),
      o("腹腔引流", "abdominal drain"),
      o("PICC", "PICC line"),
    ],
    { multi: true },
  ),
  pick(
    "device_issue",
    "meta",
    "管路問題",
    [
      o("阻塞", "blocked"),
      o("滲漏", "leaking"),
      o("脫落", "dislodged"),
      o("紅腫流膿", "site erythema/pus"),
      o("出血", "site bleeding"),
      o("疼痛", "site pain"),
    ],
    { multi: true },
  ),
];

/**
 * 這些分型題會當成主訴的修飾詞（ccFrom, replace）：選項沒有另外寫 cc 時，
 * 主訴就直接用選項的英文片語（關節題另外加 "pain"）。
 */
const CC_FROM_TEXT: ReadonlySet<string> = new Set([
  "dental_sx",
  "anal_type",
  "scrotal_sx",
  "wound_type",
  "bite_animal",
  "burn_cause",
  "fb_site",
  "env_type",
  "device_type",
  "joint_site",
]);

export const HISTORY_EXTRA: readonly HistoryItem[] = RAW_HISTORY_EXTRA.map((item) =>
  item.type === "pick" && CC_FROM_TEXT.has(item.id)
    ? {
        ...item,
        options: item.options.map((option) => ({
          ...option,
          cc:
            option.cc ??
            (item.id === "joint_site" ? `${option.text} pain` : option.text),
        })),
      }
    : item,
);

/** 新增的病史快選。asks = 勾選後額外要問的題。 */
export const PMH_EXTRA: readonly PmhItem[] = [
  {
    id: "gallstone",
    label: "膽結石",
    text: "cholelithiasis",
    asks: ["jaundice", "food_trigger"],
  },
  {
    id: "pud",
    label: "胃潰瘍胃炎",
    text: "PUD/gastritis",
    asks: ["nsaid_steroid", "melena"],
  },
  { id: "gerd", label: "胃食道逆流", text: "GERD", asks: ["heartburn"] },
  {
    id: "pancreatitis",
    label: "胰臟炎",
    text: "pancreatitis",
    asks: ["alcohol", "food_trigger"],
  },
  { id: "ibd", label: "腸炎IBD", text: "IBD", asks: ["hematochezia", "diarrhea"] },
  { id: "hernia", label: "疝氣", text: "hernia", asks: ["no_flatus"] },
  { id: "bph", label: "攝護腺肥大", text: "BPH", asks: ["urine_stream", "retention"] },
  {
    id: "stone",
    label: "泌尿結石",
    text: "urolithiasis",
    asks: ["stone_hx", "flank_pain"],
  },
  {
    id: "uti_hx",
    label: "反覆尿感染",
    text: "recurrent UTI",
    asks: ["dysuria", "foley"],
  },
  { id: "thyroid", label: "甲狀腺", text: "thyroid disease", detail: true },
  {
    id: "autoimmune",
    label: "免疫風濕",
    text: "autoimmune disease (SLE/RA)",
    detail: true,
    asks: ["steroid_use"],
  },
  { id: "anemia", label: "貧血", text: "anemia" },
  {
    id: "gib_hx",
    label: "過去消化道出血",
    text: "GI bleeding history",
    asks: ["melena", "hematemesis"],
  },
  {
    id: "vte",
    label: "栓塞DVT/PE",
    text: "VTE history",
    asks: ["calf_pain", "immobil"],
  },
  { id: "valve", label: "瓣膜疾病", text: "valvular heart disease", asks: ["dyspnea"] },
  {
    id: "pacemaker",
    label: "節律器/ICD",
    text: "pacemaker/ICD",
    asks: ["syncope", "palpitation"],
  },
  {
    id: "pci",
    label: "心導管支架",
    text: "s/p PCI/stent",
    detail: true,
    asks: ["chest_pain"],
  },
  { id: "cabg", label: "心臟繞道", text: "s/p CABG", asks: ["chest_pain"] },
  {
    id: "aaa",
    label: "主動脈瘤/剝離",
    text: "aortic aneurysm/dissection",
    asks: ["chest_radiate"],
  },
  { id: "pad", label: "周邊動脈", text: "PAD", asks: ["limb_pain"] },
  { id: "osa", label: "睡眠呼吸中止", text: "OSA" },
  {
    id: "tb",
    label: "結核病史",
    text: "TB history",
    asks: ["night_sweat", "hemoptysis"],
  },
  { id: "hiv", label: "HIV", text: "HIV", asks: ["fever", "wt_loss"] },
  {
    id: "alcoholism",
    label: "酒癮",
    text: "alcohol use disorder",
    asks: ["last_drink", "withdrawal"],
  },
  {
    id: "drug_use",
    label: "藥物濫用",
    text: "substance use disorder",
    asks: ["withdrawal"],
  },
  {
    id: "migraine",
    label: "偏頭痛",
    text: "migraine",
    asks: ["headache_aura", "similar_episode"],
  },
  {
    id: "parkinson",
    label: "巴金森",
    text: "Parkinson disease",
    asks: ["tremor", "gait"],
  },
  { id: "glaucoma", label: "青光眼", text: "glaucoma" },
  {
    id: "depression",
    label: "憂鬱焦慮",
    text: "depression/anxiety",
    asks: ["si", "psych_med_stop"],
  },
  { id: "pregnancy_hx", label: "孕產史", text: "obstetric history", detail: true },
  {
    id: "dvt_prophy",
    label: "長期抗凝血",
    text: "on long-term anticoagulation",
    asks: ["anticoag"],
  },
  { id: "trach", label: "氣切", text: "tracheostomy", asks: ["device_issue"] },
  { id: "tube_fed", label: "管灌飲食", text: "tube feeding", asks: ["device_issue"] },
  {
    id: "foley_chronic",
    label: "長期尿管",
    text: "chronic Foley",
    asks: ["device_issue", "fever"],
  },
  { id: "bedridden", label: "長期臥床", text: "bedridden", asks: ["fever", "wound"] },
];
