export const SUPPORTED_PAIRS: readonly [string, string][] = [
  ['ami_Latn', 'zho_Hant'],
  ['zho_Hant', 'ami_Latn'],
  ['tay_Latn', 'zho_Hant'],
  ['zho_Hant', 'tay_Latn'],
  ['bnn_Latn', 'zho_Hant'],
  ['zho_Hant', 'bnn_Latn'],
  ['pyu_Latn', 'zho_Hant'],
  ['zho_Hant', 'pyu_Latn'],
  ['pwn_Latn', 'zho_Hant'],
  ['zho_Hant', 'pwn_Latn'],
  ['dru_Latn', 'zho_Hant'],
  ['zho_Hant', 'dru_Latn'],
]

export function isPairSupported(src: string, tgt: string): boolean {
  return SUPPORTED_PAIRS.some(([s, t]) => s === src && t === tgt)
}

export function getValidTargets(src: string): string[] {
  return SUPPORTED_PAIRS.filter(([s]) => s === src).map(([, t]) => t)
}

export const TRANSLATION_LANGUAGES = [
  { code: 'zho_Hant', label: '中文'  },
  { code: 'ami_Latn', label: 'Amis'   },
  { code: 'tay_Latn', label: 'Atayal' },
  { code: 'bnn_Latn', label: 'Bunun'  },
  { code: 'pyu_Latn', label: 'Puyuma' },
  { code: 'pwn_Latn', label: 'Paiwan' },
  { code: 'dru_Latn', label: 'Rukai'  },
] as const

export type TranslationLang = typeof TRANSLATION_LANGUAGES[number]
