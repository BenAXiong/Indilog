import { T } from '@/lib/tokens'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { ACTIVE_LANG } from '@/lib/mock-data'

export default function LearnPage() {
  const lang = ACTIVE_LANG
  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ScreenHeader title="Learn" langName={lang.name} langDialect={lang.dialect} />

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', gap: 12, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: T.paperHi,
          border: `1px solid ${T.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkFaint,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 4v12a4 4 0 004 4h12"/>
          </svg>
        </div>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>
          Lessons coming soon
        </div>
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, maxWidth: 260 }}>
          Structured lessons are planned for a future update. For now, capture words and review flashcards to build your vocabulary.
        </div>
      </div>
    </div>
  )
}
