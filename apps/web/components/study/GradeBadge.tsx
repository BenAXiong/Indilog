import { T } from '@/lib/tokens'
import { computeMasteryGrade } from '@/lib/db/srs/schedule'
import type { FlashcardWithItem } from '@/lib/db/srs/flashcards'

const GS: Record<string, { color: string; bg: string; border: string }> = {
  seed:     { color: T.amber,    bg: T.amberBg,  border: '#EBD49A' },
  planted:  { color: T.inkSoft,  bg: T.paperHi,  border: T.lineSoft },
  rooted:   { color: '#566234',  bg: '#E4E7CC',  border: '#D2D8AE' },
  blooming: { color: '#3a601a',  bg: '#cfe8b8',  border: '#b2d895' },
}

export function GradeBadge({ card }: { card: FlashcardWithItem }) {
  const grade = computeMasteryGrade(card)
  const gs = GS[grade]
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: gs.color, background: gs.bg, border: `1px solid ${gs.border}`,
      padding: '2px 7px', borderRadius: 5,
    }}>{grade}</span>
  )
}
