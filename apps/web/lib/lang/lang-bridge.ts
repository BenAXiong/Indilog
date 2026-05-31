import { GLID_FAMILIES, GLID_NAMES, GLID_NAMES_EN } from './dialects'

// Maps Indivore language codes (lib/languages.ts) to YCM numeric GLIDs (ycm_master.db)
export const INDIVORE_TO_GLID: Record<string, string> = {
  'ami': '01',  // Amis
  'tay': '02',  // Atayal
  'pwn': '03',  // Paiwan
  'bnn': '04',  // Bunun
  'pyu': '05',  // Puyuma
  'dru': '06',  // Rukai
  'tsu': '07',  // Tsou
  'xsy': '08',  // Saisiyat
  'tao': '09',  // Tao (Yami)
  'ssf': '10',  // Thao
  'ckv': '11',  // Kavalan
  'trv': '12',  // Truku
  'szy': '13',  // Sakizaya
  'see': '14',  // Seediq
  'sxr': '15',  // Saaroa / Hla'alua — YCM GLID 15 = 拉阿魯哇語
  'xnb': '16',  // Kanakanavu
}

export function getGlid(indivoreCode: string): string | null {
  return INDIVORE_TO_GLID[indivoreCode] ?? null
}

export function getDefaultDialect(indivoreCode: string): string | null {
  const glid = getGlid(indivoreCode)
  if (!glid) return null
  return GLID_FAMILIES[glid]?.[0] ?? null
}

export function getDialectsForLang(indivoreCode: string): string[] {
  const glid = getGlid(indivoreCode)
  if (!glid) return []
  return GLID_FAMILIES[glid] ?? []
}

// grmpts queries use language-level dialect name, not sub-dialect
// e.g. '阿美語' not '南勢阿美語'
export function getGrmptsDialect(indivoreCode: string): string | null {
  const glid = getGlid(indivoreCode)
  if (!glid) return null
  return GLID_NAMES[glid]?.replace('族', '語') ?? null
}

export function getLangName(indivoreCode: string): string {
  const glid = INDIVORE_TO_GLID[indivoreCode]
  return glid ? (GLID_NAMES_EN[glid] ?? indivoreCode) : indivoreCode
}
