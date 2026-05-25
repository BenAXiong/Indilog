export interface Language {
  code: string
  name: string
  letter: string
  color: string
  nativeName?: string
}

// All 16 officially recognized Formosan languages (Council of Indigenous Peoples, Taiwan)
export const LANGUAGES: Language[] = [
  { code: 'ami', name: 'Amis',       letter: 'A', color: '#A8351F', nativeName: 'Pangcah' },
  { code: 'tay', name: 'Atayal',     letter: 'A', color: '#D2773A' },
  { code: 'pwn', name: 'Paiwan',     letter: 'P', color: '#7C2113' },
  { code: 'bnn', name: 'Bunun',      letter: 'B', color: '#D9A12F' },
  { code: 'pyu', name: 'Puyuma',     letter: 'P', color: '#7B8C46' },
  { code: 'dru', name: 'Rukai',      letter: 'R', color: '#D2773A' },
  { code: 'tsu', name: 'Tsou',       letter: 'T', color: '#8C6515' },
  { code: 'xsy', name: 'Saisiyat',   letter: 'S', color: '#A8351F' },
  { code: 'tao', name: 'Tao',        letter: 'T', color: '#8E4516', nativeName: 'Yami' },
  { code: 'ssf', name: 'Thao',       letter: 'T', color: '#7B8C46' },
  { code: 'ckv', name: 'Kavalan',    letter: 'K', color: '#566234' },
  { code: 'trv', name: 'Truku',      letter: 'T', color: '#A8351F' },
  { code: 'szy', name: 'Sakizaya',   letter: 'S', color: '#D2773A' },
  { code: 'see', name: 'Sediq',      letter: 'S', color: '#D9A12F' },
  { code: 'xnb', name: 'Kanakanavu', letter: 'K', color: '#7B8C46' },
  { code: 'sxr', name: 'Saaroa',     letter: 'S', color: '#566234' },
]

export const DEFAULT_LANGUAGE = LANGUAGES[0] // Amis

export function getLanguage(code: string): Language | undefined {
  return LANGUAGES.find(l => l.code === code)
}
