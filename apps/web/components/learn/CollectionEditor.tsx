'use client'

import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import type { LevelInput, LessonInput, CardInput } from '@/lib/db/collections'

type Props = {
  levels: LevelInput[]
  onChange: (levels: LevelInput[]) => void
}

function emptyCard(): CardInput   { return { ab: '', zh: '' } }
function emptyLesson(): LessonInput { return { title: '', cards: [emptyCard()] } }
function emptyLevel(): LevelInput   { return { lessons: [emptyLesson()] } }

export default function CollectionEditor({ levels, onChange }: Props) {
  const update = (next: LevelInput[]) => onChange(next)

  const addLevel = () => update([...levels, emptyLevel()])

  const addLesson = (li: number) => {
    const next = levels.map((lv, i) =>
      i === li ? { ...lv, lessons: [...lv.lessons, emptyLesson()] } : lv
    )
    update(next)
  }

  const addCard = (li: number, lsi: number) => {
    const next = levels.map((lv, i) =>
      i !== li ? lv : {
        ...lv,
        lessons: lv.lessons.map((ls, j) =>
          j !== lsi ? ls : { ...ls, cards: [...ls.cards, emptyCard()] }
        ),
      }
    )
    update(next)
  }

  const setTitle = (li: number, lsi: number, title: string) => {
    const next = levels.map((lv, i) =>
      i !== li ? lv : {
        ...lv,
        lessons: lv.lessons.map((ls, j) =>
          j !== lsi ? ls : { ...ls, title }
        ),
      }
    )
    update(next)
  }

  const setCard = (li: number, lsi: number, ci: number, field: 'ab' | 'zh', value: string) => {
    const next = levels.map((lv, i) =>
      i !== li ? lv : {
        ...lv,
        lessons: lv.lessons.map((ls, j) =>
          j !== lsi ? ls : {
            ...ls,
            cards: ls.cards.map((c, k) =>
              k !== ci ? c : { ...c, [field]: value }
            ),
          }
        ),
      }
    )
    update(next)
  }

  const removeCard = (li: number, lsi: number, ci: number) => {
    const next = levels.map((lv, i) =>
      i !== li ? lv : {
        ...lv,
        lessons: lv.lessons.map((ls, j) =>
          j !== lsi ? ls : {
            ...ls, cards: ls.cards.filter((_, k) => k !== ci),
          }
        ),
      }
    )
    update(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {levels.map((lv, li) => (
        <div key={li}>
          {/* Level header */}
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, color: T.inkMute, textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 12,
          }}>
            LEVEL {li + 1}
          </div>

          {lv.lessons.map((ls, lsi) => (
            <div key={lsi} style={{ marginBottom: 20 }}>
              {/* Lesson header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: T.inkMute, fontWeight: 600, flexShrink: 0 }}>
                  Lesson {lsi + 1}
                </span>
                <input
                  placeholder="Title (optional)"
                  value={ls.title ?? ''}
                  onChange={e => setTitle(li, lsi, e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12 }}>
                {ls.cards.map((card, ci) => (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 9, color: T.inkFaint, minWidth: 14,
                      }}>{ci + 1}</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input
                          placeholder="Indigenous text (ab) *"
                          value={card.ab}
                          onChange={e => setCard(li, lsi, ci, 'ab', e.target.value)}
                          style={{ ...inputStyle, fontFamily: 'Newsreader, Georgia, serif', fontSize: 15 }}
                        />
                        <input
                          placeholder="Chinese translation (zh)"
                          value={card.zh ?? ''}
                          onChange={e => setCard(li, lsi, ci, 'zh', e.target.value)}
                          style={{ ...inputStyle, fontSize: 13, color: T.inkSoft }}
                        />
                      </div>
                      {ls.cards.length > 1 && (
                        <button
                          onClick={() => removeCard(li, lsi, ci)}
                          style={{
                            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                            background: 'transparent', border: `1px solid ${T.lineSoft}`,
                            color: T.inkFaint, cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Icon name="x" size={11} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button onClick={() => addCard(li, lsi)} style={addBtnStyle}>
                  <Icon name="plus" size={13} strokeWidth={2} /> Add card
                </button>
              </div>

              <div style={{ height: 1, background: T.lineSoft, margin: '12px 0 0 12px' }} />
            </div>
          ))}

          <button onClick={() => addLesson(li)} style={addBtnStyle}>
            <Icon name="plus" size={13} strokeWidth={2} /> Add lesson
          </button>
        </div>
      ))}

      <button onClick={addLevel} style={{
        ...addBtnStyle,
        border: `1px dashed ${T.lineSoft}`,
        padding: '10px 0', justifyContent: 'center', width: '100%',
      }}>
        <Icon name="plus" size={14} strokeWidth={2} /> Add level
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1, height: 36, padding: '0 10px', borderRadius: 8,
  background: T.paperHi, border: `1px solid ${T.lineSoft}`,
  fontSize: 14, color: T.ink, fontFamily: 'inherit',
  outline: 'none', width: '100%',
}

const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 30, padding: '0 10px', borderRadius: 8, marginTop: 6,
  background: 'transparent', border: `1px solid ${T.lineSoft}`,
  fontSize: 12, color: T.inkMute, cursor: 'pointer', fontFamily: 'inherit',
}
