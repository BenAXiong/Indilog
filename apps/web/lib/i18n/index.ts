import en, { type MessageKey } from './en'

type Locale = 'en'

const catalogs: Record<Locale, typeof en> = { en }

let current: Locale = 'en'

export function t(key: MessageKey): string {
  return catalogs[current][key] ?? key
}

export function setLocale(locale: Locale): void {
  current = locale
}

export function getLocale(): Locale {
  return current
}

export type { MessageKey }
