import type { Language } from './languages'

export const ACTIVE_LANG: Language & { letter: string; color: string; dialect: string } = {
  code: 'ami',
  name: 'Amis',
  letter: 'A',
  color: '#A8351F',
  dialect: 'Sakizaya',
}

export type CaptureItem = {
  id: number
  term: string
  gloss: string
  type: 'word' | 'sentence' | 'note'
  source: string
  when: string
}

export const RECENT_CAPTURES: CaptureItem[] = [
  { id: 1, term: "mafanaʼay kako",             gloss: 'I am happy / well',              type: 'sentence', source: 'Conversation',   when: '2h' },
  { id: 2, term: 'cidal',                           gloss: 'sun, day',                       type: 'word',     source: 'Pangcah dict.',  when: '5h' },
  { id: 3, term: 'O ngangan ako ci…',          gloss: 'My name is…',               type: 'sentence', source: 'Field notes',    when: 'yest' },
  { id: 4, term: 'safa',                            gloss: 'younger sibling',                type: 'word',     source: 'Conversation',   when: 'yest' },
  { id: 5, term: 'maolah kako tomireng i riyar',    gloss: 'I like standing by the sea',     type: 'sentence', source: 'Song lyric',     when: '2d' },
]

export const MOCK_STATS = {
  captures: 142,
  reviewed: 86,
  dueToday: 12,
  lessons: { done: 4, total: 24 },
  streak: 17,
  activeDays: 98,
  heatmapWeeks: 18,
}

export const REVIEW_CARDS = [
  { front: "mafanaʼay", pos: 'adjective', back: 'happy / well / in good spirits', ex: "mafanaʼay kako anini · I am well today" },
  { front: 'cidal',          pos: 'noun',      back: 'sun · day',                 ex: 'O cidal anini malaalitin · The sun is bright today' },
  { front: 'safa',           pos: 'noun',      back: 'younger sibling',                ex: 'O safa ako ci Panay · My younger sister is Panay' },
]

export const DIALOGUES = [
  { id: 1, title: 'Meeting an elder',    sub: '6 turns · with audio',      phrases: 10, color: '#D2773A', bg: '#F6E2CE' },
  { id: 2, title: 'At the market',       sub: '8 turns · numbers & food',  phrases: 14, color: '#D9A12F', bg: '#F6E5BA' },
]

export const MOCK_DICT_EXACT = {
  word: 'cidal',
  pos: 'noun',
  dialect: 'central',
  defs: [
    { id: 1, pri: 'sun',  sec: 'the celestial body; daylight source' },
    { id: 2, pri: 'day',  sec: 'a 24-hour period; daytime' },
  ],
  examples: [
    { src: 'O cidal anini malaalitin.', en: 'The sun is bright today.' },
    { src: 'tatolo a cidal',            en: 'three days' },
  ],
}

export const MOCK_DICT_PARTIALS = [
  { word: 'cidalan',    gloss: 'sunny place',        pos: 'noun' },
  { word: 'macidal',    gloss: 'sunlit, in the sun',  pos: 'verb' },
  { word: 'malacidal',  gloss: 'to become sunny',     pos: 'verb' },
]

export const TRANSLATE_LANGS = [
  { code: 'en',  name: 'English',  supported: ['ami', 'tay'] },
  { code: 'zh',  name: '中文',  supported: ['ami', 'tay', 'bnn'] },
  { code: 'ami', name: 'Amis',     supported: ['en', 'zh'] },
  { code: 'tay', name: 'Atayal',   supported: ['en', 'zh'] },
  { code: 'bnn', name: 'Bunun',    supported: ['zh'] },
  { code: 'pyu', name: 'Puyuma',   supported: [] },
  { code: 'pwn', name: 'Paiwan',   supported: [] },
]

export const SETTINGS_LANGS = [
  { code: 'ami', name: 'Amis',   letter: 'A', color: '#A8351F', dialect: 'Sakizaya' },
  { code: 'tay', name: 'Atayal', letter: 'T', color: '#D2773A', dialect: null },
  { code: 'bnn', name: 'Bunun',  letter: 'B', color: '#D9A12F', dialect: null },
]
