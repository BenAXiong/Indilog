// Supported translation pairs.
// TODO DEC-002: These are mock values from the design prototype.
// Replace with the real supported pairs before Phase 6.
export const SUPPORTED_PAIRS: Record<string, string[]> = {
  en:  ['ami', 'tay'],
  zh:  ['ami', 'tay', 'bnn'],
  ami: ['en', 'zh'],
  tay: ['en', 'zh'],
  bnn: ['zh'],
}

export function isPairSupported(src: string, tgt: string): boolean {
  return SUPPORTED_PAIRS[src]?.includes(tgt) ?? false
}

// Languages that can appear as translation sources or targets
// (distinct from the 16 study languages — these are UI/translation languages)
export const TRANSLATION_UI_LANGUAGES = [
  { code: 'en',  name: 'English' },
  { code: 'zh',  name: '中文' },
  { code: 'ami', name: 'Amis' },
  { code: 'tay', name: 'Atayal' },
  { code: 'bnn', name: 'Bunun' },
  { code: 'pwn', name: 'Paiwan' },
  { code: 'pyu', name: 'Puyuma' },
]
