export const GRMPTS_LEVEL_NAMES: Record<string, string> = {
  '1': '初級', '2': '中級', '3': '中高級', '4': '高級',
}

export const LESSON_DIFFICULTIES: { name: string; levels: string[] }[] = [
  { name: '初級',   levels: ['1','2','3'] },
  { name: '中級',   levels: ['4','5','6'] },
  { name: '中高級', levels: ['7','8','9'] },
  { name: '高級',   levels: ['10','11','12'] },
]

const ZH_ORDINALS: Record<string, string> = {
  '1':'一','2':'二','3':'三','4':'四','5':'五','6':'六',
  '7':'七','8':'八','9':'九','10':'十','11':'十一','12':'十二',
}

export function stageName(level: string): string {
  return `第${ZH_ORDINALS[level] ?? level}階`
}

export function lessonDifficultyOf(level: string): string {
  const n = Number.parseInt(level)
  if (n <= 3) return '初級'
  if (n <= 6) return '中級'
  if (n <= 9) return '中高級'
  return '高級'
}

export function lessonDifficultyIdxOf(level: string): number {
  const n = Number.parseInt(level)
  if (n <= 3) return 0
  if (n <= 6) return 1
  if (n <= 9) return 2
  return 3
}

export const ESSAY_GROUP_LABELS = ['初級', '中級', '高級']
export const ESSAY_GROUP_START  = [0, 20, 40]

// GLID-keyed dialect data — adapted from YCM Portal (temp_learn/portal/lib/dialects.ts)
// GLIDs are 2-digit strings matching occurrences.dialect_name groupings in ycm_master.db

export const GLID_FAMILIES: Record<string, string[]> = {
  '01': ['南勢阿美語', '秀姑巒阿美語', '海岸阿美語', '馬蘭阿美語', '恆春阿美語'],
  '02': ['賽考利克泰雅語', '澤敖利泰雅語', '汶水泰雅語', '萬大泰雅語', '四季泰雅語', '宜蘭澤敖利泰雅語', '賽考利克太魯閣語', '斯卡羅泰雅語'],
  '03': ['南排灣語', '中排灣語', '北排灣語', '東排灣語'],
  '04': ['卓群布農語', '卡群布農語', '丹群布農語', '巒群布農語', '郡群布農語'],
  '05': ['南王卑南語', '知本卑南語', '西群卑南語', '建和卑南語'],
  '06': ['霧台魯凱語', '茂林魯凱語', '多納魯凱語', '東魯凱語', '萬山魯凱語', '大武魯凱語'],
  '07': ['鄒語'],
  '08': ['賽夏語'],
  '09': ['雅美語'],
  '10': ['邵語'],
  '11': ['噶瑪蘭語'],
  '12': ['太魯閣語'],
  '13': ['撒奇萊雅語'],
  '14': ['德固達雅賽德克語', '都達賽德克語', '德鹿谷賽德克語'],
  '15': ['拉阿魯哇語'],
  '16': ['卡那卡那富語'],
}

export const GLID_NAMES: Record<string, string> = {
  '01': '阿美語', '02': '泰雅語', '03': '排灣語', '04': '布農語',
  '05': '卑南語', '06': '魯凱語', '07': '鄒語',  '08': '賽夏語',
  '09': '雅美語', '10': '邵語',  '11': '噶瑪蘭語','12': '太魯閣語',
  '13': '撒奇萊雅語', '14': '賽德克語', '15': '拉阿魯哇語', '16': '卡那卡那富語',
}

export const GLID_NAMES_EN: Record<string, string> = {
  '01': 'Amis',      '02': 'Atayal',   '03': 'Paiwan',    '04': 'Bunun',
  '05': 'Puyuma',    '06': 'Rukai',    '07': 'Tsou',      '08': 'Saisiyat',
  '09': 'Tao (Yami)','10': 'Thao',     '11': 'Kavalan',   '12': 'Truku',
  '13': 'Sakizaya',  '14': 'Seediq',   '15': "Hla'alua",  '16': 'Kanakanavu',
}

// Returns the dialect label with the language family name stripped for concise display.
// e.g. "Nanshi Amis" → "Nanshi", "Squliq Atayal" → "Squliq"
export function shortDialectLabel(dialectCh: string, glid: string): string {
  const full = DIALECT_TO_EN[dialectCh] ?? dialectCh
  const family = GLID_NAMES_EN[glid]
  if (!family) return full
  const stripped = full.endsWith(family) ? full.slice(0, -family.length).trim() : full
  return stripped || full
}

export const DIALECT_TO_EN: Record<string, string> = {
  '南勢阿美語': 'Nanshi Amis',        '秀姑巒阿美語': 'Xiuguluan Amis',
  '海岸阿美語': 'Coastal Amis',       '馬蘭阿美語': 'Malan Amis',
  '恆春阿美語': 'Hengchun Amis',
  '賽考利克泰雅語': 'Squliq Atayal',  '澤敖利泰雅語': "C'uli Atayal",
  '汶水泰雅語': 'Mayrinax Atayal',    '萬大泰雅語': 'Plngawan Atayal',
  '四季泰雅語': 'Siji Atayal',        '宜蘭澤敖利泰雅語': "Yilan C'uli Atayal",
  '賽考利克太魯閣語': 'Skikun Atayal', '斯卡羅泰雅語': 'Sqalo Atayal',
  '南排灣語': 'South Paiwan',         '中排灣語': 'Central Paiwan',
  '北排灣語': 'North Paiwan',         '東排灣語': 'East Paiwan',
  '卓群布農語': 'Takituduh Bunun',     '卡群布農語': 'Takibakha Bunun',
  '丹群布農語': 'Takivatan Bunun',     '巒群布農語': 'Takbanuaz Bunun',
  '郡群布農語': 'Isbukun Bunun',
  '南王卑南語': 'Puyuma (Nanwang)',    '知本卑南語': 'Katratripul Puyuma',
  '西群卑南語': 'West Puyuma',         '建和卑南語': 'Kasavakan Puyuma',
  '霧台魯凱語': 'Ngudradrekai (Wutai)','茂林魯凱語': 'Teldreka (Maolin)',
  '多納魯凱語': 'Thakongadavane (Duona)','東魯凱語': 'Taromak Rukai',
  '萬山魯凱語': 'Mantauran Rukai',     '大武魯凱語': 'Labuan Rukai',
  '鄒語': 'Tsou',         '賽夏語': 'Saisiyat',    '雅美語': 'Tao (Yami)',
  '邵語': 'Thao',         '噶瑪蘭語': 'Kavalan',   '太魯閣語': 'Truku',
  '撒奇萊雅語': 'Sakizaya',
  '德固達雅賽德克語': 'Tgdaya Seediq', '都達賽德克語': 'Toda Seediq',
  '德鹿谷賽德克語': 'Truku Seediq',
  "拉阿魯哇語": "Hla'alua",           '卡那卡那富語': 'Kanakanavu',
}
