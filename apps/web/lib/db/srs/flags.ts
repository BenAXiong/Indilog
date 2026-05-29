export const FLAG_COLORS = [
  { key: 'red',    color: '#A8351F' },
  { key: 'orange', color: '#D2773A' },
  { key: 'yellow', color: '#D9A12F' },
  { key: 'green',  color: '#7B8C46' },
  { key: 'blue',   color: '#3B6CB5' },
] as const

export type FlagColor = (typeof FLAG_COLORS)[number]['key']

export function flagColorHex(key: string | null | undefined): string | null {
  if (!key) return null
  return FLAG_COLORS.find(f => f.key === key)?.color ?? null
}
