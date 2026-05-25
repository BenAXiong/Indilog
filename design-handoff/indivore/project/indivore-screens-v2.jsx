(()=>{
// Indivore — mobile screens (all 6 + flashcard)
// Each screen is a self-contained component that fits inside the iOS frame.

const T = window.TOKENS;
const { Icon, Chip, Card, Button, Input, SectionHead, BottomNav, IvStatusBar, Toast, LangAvatar, Stat, Wordmark } = window;

// ─── Shared screen header (used by all non-dashboard screens) ───
// Eyebrow = current language · dialect.  Title = tab name.
// Logo top-left = back to dashboard.  Gear top-right = open settings.
const ScreenHeader = ({ lang, title, onHome, onSettings, right }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4,
  }}>
    {onHome && (
      <button onClick={onHome} aria-label="Back to dashboard" style={{
        width: 36, height: 36, borderRadius: 999, background: 'transparent',
        border: 0, padding: 0, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src="uploads/Kilang_5_nobg_noring2.png" alt="Indivore"
          style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
      </button>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: T.fMono, fontSize: 11, color: T.inkMute,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {lang.name}{lang.dialect && ` · ${lang.dialect}`}
      </div>
      <h1 className="serif" style={{
        fontSize: 26, fontWeight: 500, color: T.ink, marginTop: 2,
        letterSpacing: '-0.025em', lineHeight: 1.1,
      }}>{title}</h1>
    </div>
    {right ?? (onSettings && (
      <button onClick={onSettings} aria-label="Settings" style={{
        width: 36, height: 36, borderRadius: 999, background: T.paperHi,
        border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.inkSoft, flexShrink: 0,
      }}><Icon name="settings" size={17} strokeWidth={1.6} /></button>
    ))}
  </div>
);

// ─── shared mock data ─────────────────────────────────────────
const LANGS = [
  { code: 'ami', name: 'Amis',     letter: 'A', color: T.crimson, dialect: 'Sakizaya' },
  { code: 'tay', name: 'Atayal',   letter: 'T', color: T.terra },
  { code: 'bnn', name: 'Bunun',    letter: 'B', color: T.amber },
  { code: 'pyu', name: 'Puyuma',   letter: 'P', color: T.sage },
  { code: 'pwn', name: 'Paiwan',   letter: 'P', color: T.crimsonDp },
  { code: 'tao', name: 'Tao',      letter: 'T', color: '#8E4516' },
  { code: 'sai', name: 'Saisiyat', letter: 'S', color: '#A8351F' },
  { code: 'ckv', name: 'Kavalan',  letter: 'K', color: T.sageDp },
  { code: 'tsu', name: 'Tsou',     letter: 'T', color: '#8C6515' },
  { code: 'rkb', name: 'Rukai',    letter: 'R', color: T.terra },
];

const RECENT_CAPTURES = [
  { id: 1, term: 'mafana\u02bcay kako', gloss: 'I am happy / well', type: 'sentence', source: 'Conversation', when: '2h' },
  { id: 2, term: 'cidal',  gloss: 'sun, day',  type: 'word', source: 'Pangcah dict.',   when: '5h' },
  { id: 3, term: 'O ngangan ako ci…', gloss: 'My name is…', type: 'sentence', source: 'Field notes', when: 'yest' },
  { id: 4, term: 'safa', gloss: 'younger sibling', type: 'word', source: 'Conversation', when: 'yest' },
  { id: 5, term: 'maolah kako tomireng i riyar', gloss: 'I like standing by the sea', type: 'sentence', source: 'Song lyric', when: '2d' },
];

// ═══════════════════════════════════════════════════════════════
// 1 · DASHBOARD
// ═══════════════════════════════════════════════════════════════
const ScreenDashboard = ({ onTab, onCapture, lang }) => {
  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header: logo (uploaded woven-tree image) + settings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <img src="uploads/Kilang_5_nobg_noring2.png" alt="Indivore"
            style={{ width: 32, height: 32, objectFit: 'contain', display: 'block' }} />
          <span className="serif" style={{
            fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em',
          }}>Indivore</span>
        </div>
        <button onClick={() => onTab('settings')} style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft,
        }}><Icon name="settings" size={17} strokeWidth={1.6} /></button>
      </div>

      {/* Active language card */}
      <Card raised pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LangAvatar letter={lang.letter} color={lang.color} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.inkMute, fontFamily: T.fMono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Studying</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span className="serif" style={{ fontSize: 19, fontWeight: 600, color: T.ink }}>{lang.name}</span>
            {lang.dialect && <span style={{ fontSize: 12, color: T.inkSoft }}>· {lang.dialect}</span>}
          </div>
        </div>
        <button onClick={() => onTab('settings')} style={{
          fontSize: 12, color: T.inkSoft, padding: '6px 10px', borderRadius: 8,
          background: T.paper, border: `1px solid ${T.lineSoft}`, fontWeight: 500,
        }}>Change</button>
      </Card>

      {/* Streak banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 16,
        background: `linear-gradient(135deg, ${T.crimson}, ${T.crimsonDp})`,
        color: '#fff', position: 'relative', overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 22px rgba(120,30,15,0.22)',
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -10, opacity: 0.18,
        }}>
          <Icon name="flame" size={120} strokeWidth={1} color="#fff" />
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="share" size={20} color="#fff" strokeWidth={1.9} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="serif" style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>17</span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>day streak</span>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 1 }}>Capture today to keep it going</div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <SectionHead title="This week" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat value="142" label="Captures" icon="capture" accent={T.crimson} />
          <Stat value="86"  label="Reviewed"  icon="card" accent={T.sage} />
          <Stat value="12"  label="Due today" icon="review" accent={T.amber} />
          <Stat value="4"   suffix="of 24"   label="Lessons"  icon="learn" accent={T.terra} />
        </div>
      </div>

      {/* Activity heatmap */}
      <div>
        <SectionHead title="Activity" action="Last 18 weeks" />
        {(() => {
          // Deterministic pseudo-random capture data, denser toward "now"
          const weeks = 18;
          let seed = 9;
          const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
          const data = [];
          for (let w = 0; w < weeks; w++) {
            const week = [];
            const recency = w / (weeks - 1); // 0 → 1 (older → newer)
            for (let d = 0; d < 7; d++) {
              const r = rand();
              // Threshold curves so recent weeks have more highs
              let level = 0;
              if (r < 0.55 + recency * 0.25) level = 1;
              if (r < 0.38 + recency * 0.30) level = 2;
              if (r < 0.20 + recency * 0.25) level = 3;
              if (r < 0.08 + recency * 0.15) level = 4;
              week.push(level);
            }
            data.push(week);
          }
          // Force the last day to be 0 (today not captured yet — drives the streak prompt)
          data[weeks - 1][6] = 0;
          // Force the previous 16 days to all be active (>=1) for the 17-day streak narrative
          let backIdx = 16;
          for (let w = weeks - 1; w >= 0 && backIdx >= 0; w--) {
            for (let d = 6; d >= 0 && backIdx >= 0; d--) {
              if (w === weeks - 1 && d === 6) continue; // skip today
              if (data[w][d] === 0) data[w][d] = 1;
              backIdx--;
            }
          }
          const activeDays = data.flat().filter(v => v > 0).length;
          const intensity = [
            T.lineSoft,
            '#F1D8C6',
            '#E5A88E',
            '#C66848',
            T.crimsonDp,
          ];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
          return (
            <div style={{
              background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16,
              padding: '14px 14px 12px',
            }}>
              {/* Top row: total + active streak */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span className="serif" style={{ fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: '-0.025em' }}>{activeDays}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 6 }}>active days</span>
                </div>
                <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  of {weeks * 7}
                </span>
              </div>

              {/* Month markers */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 6, height: 12 }}>
                {data.map((_, wi) => {
                  // Place month label at roughly every ~4 weeks
                  const label = wi % 4 === 1 && months[Math.floor(wi / 4)];
                  return (
                    <div key={wi} style={{
                      width: 13, fontSize: 9.5, color: T.inkMute, fontFamily: T.fMono,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>{label}</div>
                  );
                })}
              </div>

              {/* Grid */}
              <div style={{ display: 'flex', gap: 3 }}>
                {data.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {week.map((lvl, di) => {
                      const isToday = wi === weeks - 1 && di === 6;
                      return (
                        <div key={di} title={`level ${lvl}`} style={{
                          width: 13, height: 13, borderRadius: 3,
                          background: intensity[lvl],
                          border: lvl === 0 ? `1px solid ${T.line}` : 'none',
                          boxShadow: isToday ? `0 0 0 1.5px ${T.crimson}` : 'none',
                          transition: 'transform .12s',
                        }} />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 12, fontSize: 10.5, color: T.inkMute, fontFamily: T.fMono,
                letterSpacing: '0.05em',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 2, background: 'transparent',
                    border: `1.5px solid ${T.crimson}`,
                  }} />
                  today
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>less</span>
                  {intensity.map((c, i) => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: 2.5, background: c,
                      border: i === 0 ? `1px solid ${T.line}` : 'none',
                    }} />
                  ))}
                  <span>more</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 2 · CAPTURE
// ═══════════════════════════════════════════════════════════════
const ScreenCapture = ({ lang, onSaved, onHome, onSettings }) => {
  const [text, setText] = React.useState('Maolah kako tomireng i riyar anini');
  const [lookedUp, setLookedUp] = React.useState(true);
  const [source, setSource] = React.useState('Conversation');
  const [speaker, setSpeaker] = React.useState('ina Panay');
  const [place, setPlace] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [showSrcMenu, setShowSrcMenu] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [showAllTokens, setShowAllTokens] = React.useState(false);

  const tokens = [
    { word: 'Maolah',   gloss: 'like / love',     match: true },
    { word: 'kako',     gloss: '1sg pronoun',     match: true },
    { word: 'tomireng', gloss: 'to stand',        match: true },
    { word: 'i',        gloss: 'locative marker', match: true },
    { word: 'riyar',    gloss: 'ocean / sea',     match: true },
    { word: 'anini',    gloss: 'today',           match: true },
  ];
  const visibleTokens = showAllTokens ? tokens : tokens.slice(0, 4);

  const handleSave = () => {
    setSavedFlash(true);
    setTimeout(() => { setSavedFlash(false); onSaved?.(); }, 1800);
  };

  return (
    <div style={{ padding: '4px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <ScreenHeader lang={lang} title="Capture" onHome={onHome} onSettings={onSettings} />

      {/* Big input */}
      <div style={{
        background: T.paperHi, border: `1.5px solid ${T.line}`,
        borderRadius: 18, padding: '16px 16px 12px',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.03)',
      }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="A word, sentence, or note you want to keep…"
          rows={3} style={{
            width: '100%', border: 0, background: 'transparent', resize: 'none',
            fontFamily: T.fSerif, fontSize: 20, fontWeight: 400, color: T.ink,
            letterSpacing: '-0.015em', lineHeight: 1.35,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{
              width: 30, height: 30, borderRadius: 9, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="mic" size={15} strokeWidth={1.8} />
            </button>
            <button style={{
              width: 30, height: 30, borderRadius: 9, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="sparkle" size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {/* Token chips (after lookup) */}
      {lookedUp && (
        <div className="iv-rise">
          {/* Custom section head: subtitle + inline re-lookup icon · right action toggles see all */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 4px', marginBottom: 10, gap: 8,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{
                fontFamily: T.fMono, fontSize: 11, fontWeight: 500, color: T.inkMute,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>tap to add gloss</span>
              <button aria-label="Re-lookup tokens" style={{
                width: 22, height: 22, borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: T.inkSoft, background: T.paper, border: `1px solid ${T.lineSoft}`,
              }}>
                <Icon name="review" size={12} strokeWidth={1.8} />
              </button>
            </div>
            {tokens.length > 4 && (
              <button onClick={() => setShowAllTokens(!showAllTokens)} style={{
                fontFamily: T.fSans, fontSize: 13, fontWeight: 500, color: T.crimson,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                {showAllTokens ? 'Show less' : `See all · ${tokens.length}`}
                <Icon name="chev-d" size={14} strokeWidth={2.2}
                  style={{ transform: showAllTokens ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleTokens.map((tk, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: T.paperHi,
                border: `1px solid ${T.lineSoft}`, borderRadius: 12,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="serif" style={{ fontSize: 15, fontWeight: 500, color: T.ink }}>{tk.word}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>{tk.gloss}</span>
                </div>
                <Chip size="sm" tone="sage" icon="check">match</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="md" icon="search" style={{ flex: 1 }}>Lookup</Button>
        <Button variant="secondary" size="md" icon="translate" style={{ flex: 1 }}>Translate</Button>
      </div>

      {/* Metadata — small */}
      <div>
        <SectionHead title="Context" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* source */}
          <button onClick={() => setShowSrcMenu(!showSrcMenu)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="bookmark" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60, textAlign: 'left' }}>Source</span>
            <span style={{ flex: 1, fontSize: 14, color: T.ink, textAlign: 'left', fontWeight: 500 }}>{source}</span>
            <Icon name="chev-d" size={14} color={T.inkFaint} />
          </button>
          {/* speaker */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="user" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Speaker</span>
            <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="(optional)" style={{
              flex: 1, border: 0, background: 'transparent', fontSize: 14, fontWeight: 500, color: T.ink, padding: 0,
            }} />
          </div>
          {/* place */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="pin" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Place</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Where heard / seen" style={{
              flex: 1, border: 0, background: 'transparent', fontSize: 14, fontWeight: 500, color: T.ink, padding: 0,
            }} />
          </div>
          {/* notes */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px',
          }}>
            <Icon name="pen" size={16} color={T.inkSoft} strokeWidth={1.8} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60, paddingTop: 2 }}>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Anything to remember…" style={{
              flex: 1, border: 0, background: 'transparent', fontSize: 14, color: T.ink, padding: 0, resize: 'none',
              fontFamily: T.fSans, lineHeight: 1.4,
            }} />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button variant="secondary" size="lg" style={{ flex: 1 }}>Clear</Button>
        <Button variant="primary" size="lg" icon="check" style={{ flex: 2 }} onClick={handleSave}>Save</Button>
      </div>

      {savedFlash && <Toast tone="sage">Saved to your notebook</Toast>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 3 · REVIEW
//   Landing → due today + Start (Comprehension / Expression) + Dialogue drill
//   Reviewing → flashcard view (own state, dismissable back to landing)
// ═══════════════════════════════════════════════════════════════
const ScreenReview = ({ lang, onHome, onSettings }) => {
  const [mode, setMode] = React.useState('landing'); // 'landing' | 'reviewing'
  const [reviewKind, setReviewKind] = React.useState('comp'); // 'comp' | 'expr' | 'dialogue'

  // ─── Landing ────────────────────────────────────────────────
  if (mode === 'landing') {
    const startOptions = [
      {
        id: 'comp', label: 'Comprehension', sub: 'See the meaning — say the sentence',
        due: 8, icon: 'dict', tone: T.crimson, bg: T.crimsonBg, border: '#EFCAB8',
      },
      {
        id: 'expr', label: 'Expression', sub: 'Hear the sentence — guess the sentence',
        due: 4, icon: 'mic', tone: T.sageDp, bg: T.sageBg, border: '#D2D8AE',
      },
    ];

    const dialogues = [
      { id: 1, title: 'Meeting an elder', sub: '6 turns · with audio', tone: T.terra, bg: T.terraBg, phrases: 10 },
      { id: 2, title: 'At the market', sub: '8 turns · numbers & food', tone: T.amber, bg: T.amberBg, phrases: 14 },
    ];

    return (
      <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ScreenHeader lang={lang} title="Review" onHome={onHome} onSettings={onSettings} />

        {/* Due today */}
        <Card raised pad={16}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Due today
            </span>
            <Chip size="sm" tone="amber" icon="flame">8 / 20 done</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 8 }}>
            <span className="serif" style={{ fontSize: 38, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>12</span>
            <span style={{ fontSize: 14, color: T.inkSoft }}>cards · ~6 min</span>
          </div>
          <div style={{ height: 6, background: T.lineSoft, borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
            <div style={{
              width: '40%', height: '100%',
              background: `linear-gradient(90deg, ${T.amber}, ${T.terra}, ${T.crimson})`,
              borderRadius: 999, transition: 'width .4s',
            }} />
          </div>
        </Card>

        {/* Start review */}
        <div>
          <SectionHead title="Start review" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {startOptions.map((opt) => (
              <button key={opt.id} onClick={() => { setReviewKind(opt.id); setMode('reviewing'); }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  padding: '16px 14px 14px', borderRadius: 16,
                  background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                  textAlign: 'left', position: 'relative', overflow: 'hidden',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04), 0 4px 12px rgba(80,40,20,0.05)',
                  transition: 'transform .12s, box-shadow .15s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = ''}
                onMouseLeave={(e) => e.currentTarget.style.transform = ''}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: opt.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: opt.tone, marginBottom: 8,
                  border: `1px solid ${opt.border}`,
                }}>
                  <Icon name={opt.icon} size={17} strokeWidth={1.8} />
                </div>
                <div className="serif" style={{ fontSize: 17, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.3 }}>{opt.sub}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <span className="mono" style={{ fontSize: 10, color: opt.tone, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    {opt.due} due
                  </span>
                  <div style={{
                    width: 26, height: 26, borderRadius: 999, background: opt.tone,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="play" size={10} color="#fff" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dialogue drill */}
        <div>
          <SectionHead title="Dialogue drill" action="See all" onAction={() => {}} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dialogues.map((d) => (
              <button key={d.id} onClick={() => { setReviewKind('dialogue'); setMode('reviewing'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', borderRadius: 14,
                  background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                  textAlign: 'left', width: '100%',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(80,40,20,0.03)',
                }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: d.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: d.tone, flexShrink: 0,
                }}>
                  <Icon name="speaker" size={18} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em' }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{d.sub}</div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {d.phrases} phrases
                </span>
                <Icon name="chevron" size={14} color={T.inkFaint} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Reviewing (flashcard) ───────────────────────────────────
  return <ReviewSession lang={lang} kind={reviewKind} onExit={() => setMode('landing')} />;
};

// Inner flashcard view — its own state, dismissable
const ReviewSession = ({ lang, kind, onExit }) => {
  const [revealed, setRevealed] = React.useState(false);
  const [cardIdx, setCardIdx] = React.useState(0);
  const [flipping, setFlipping] = React.useState(false);

  const cards = [
    { front: 'mafana\u02bcay', pos: 'adjective', back: 'happy / well / in good spirits', ex: 'mafana\u02bcay kako anini · I am well today' },
    { front: 'cidal',        pos: 'noun',      back: 'sun · day',                       ex: 'O cidal anini malaalitin · The sun is bright today' },
    { front: 'safa',         pos: 'noun',      back: 'younger sibling',                 ex: 'O safa ako ci Panay · My younger sister is Panay' },
  ];
  const card = cards[cardIdx];
  const total = kind === 'comp' ? 8 : kind === 'expr' ? 4 : 10;

  const kindLabel = kind === 'comp' ? 'Comprehension' : kind === 'expr' ? 'Expression' : 'Dialogue drill';
  const kindTone  = kind === 'comp' ? T.crimson : kind === 'expr' ? T.sageDp : T.terra;

  const handleRate = () => {
    setFlipping(true);
    setTimeout(() => {
      setRevealed(false);
      setCardIdx((cardIdx + 1) % cards.length);
      setFlipping(false);
    }, 300);
  };

  const ratings = [
    { id: 'again', label: 'Again', sub: '<10m', color: T.crimson },
    { id: 'hard',  label: 'Hard',  sub: '1d',    color: T.terra },
    { id: 'good',  label: 'Good',  sub: '3d',    color: T.sage },
    { id: 'easy',  label: 'Easy',  sub: '7d',    color: T.amber },
  ];

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session header — back arrow + mode label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <button onClick={onExit} aria-label="Back to review" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0,
        }}><Icon name="arrow-l" size={17} strokeWidth={1.8} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.fMono, fontSize: 11, color: kindTone,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>{kindLabel}</div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>
            {lang.name}{lang.dialect && ` · ${lang.dialect}`}
          </div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {cardIdx + 1} / {total}
        </span>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: i < cardIdx ? T.sage : i === cardIdx ? kindTone : T.lineSoft,
            transition: 'background .3s',
          }} />
        ))}
      </div>

      {/* Flashcard */}
      <div className={flipping ? 'iv-flip' : ''} style={{
        background: T.paperHi, borderRadius: 22, padding: '24px 20px',
        border: `1px solid ${T.lineSoft}`, minHeight: 240,
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 6px rgba(80,40,20,0.05), 0 12px 28px rgba(80,40,20,0.08)',
      }}>
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.pos}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
          <div>
            <div className="serif" style={{ fontSize: 38, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              {kind === 'expr' && !revealed
                ? <span style={{ fontStyle: 'italic', color: T.inkSoft }}>{card.back}</span>
                : card.front}
            </div>
            <button style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px 6px 8px', borderRadius: 999, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft, fontSize: 12, fontWeight: 500,
            }}>
              <Icon name="speaker" size={13} strokeWidth={1.8} />
              Hear it
            </button>
          </div>

          {revealed ? (
            <div className="iv-rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 1, background: T.lineSoft }} />
              <div style={{ fontSize: 17, fontWeight: 500, color: T.ink, lineHeight: 1.3 }}>
                {kind === 'expr' ? card.front : card.back}
              </div>
              <div style={{
                padding: '10px 12px', background: T.paper, borderRadius: 10,
                borderLeft: `2.5px solid ${kindTone}`,
              }}>
                <div className="serif" style={{ fontSize: 14, fontStyle: 'italic', color: T.ink, lineHeight: 1.35 }}>{card.ex}</div>
              </div>
            </div>
          ) : (
            <button onClick={() => setRevealed(true)} style={{
              padding: '14px', borderRadius: 12,
              background: T.ink, color: T.cream, fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 1px 0 rgba(255,255,255,0.1) inset, 0 4px 12px rgba(40,30,20,0.15)',
            }}>
              <Icon name="play" size={11} color={T.cream} />
              Reveal answer
            </button>
          )}
        </div>
      </div>

      {/* Ratings */}
      {revealed && (
        <div className="iv-rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {ratings.map((r) => (
            <button key={r.id} onClick={handleRate} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '10px 4px', borderRadius: 12,
              background: T.paperHi, border: `1.5px solid ${r.color}`,
              color: r.color, fontWeight: 600,
              transition: 'all .15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = r.color; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.paperHi; e.currentTarget.style.color = r.color; }}
            >
              <span style={{ fontSize: 12.5 }}>{r.label}</span>
              <span className="mono" style={{ fontSize: 9.5, opacity: 0.7, fontWeight: 500 }}>{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 4 · DICTIONARY
// ═══════════════════════════════════════════════════════════════
const ScreenDictionary = ({ lang, onHome, onSettings }) => {
  const [q, setQ] = React.useState('cidal');

  const exact = {
    word: 'cidal', pos: 'noun', dialect: lang.dialect || 'central',
    defs: [
      { id: 1, pri: 'sun', sec: 'the celestial body; daylight source' },
      { id: 2, pri: 'day', sec: 'a 24-hour period; daytime' },
    ],
    examples: [
      { ami: 'O cidal anini malaalitin.', en: 'The sun is bright today.' },
      { ami: 'tatolo a cidal', en: 'three days' },
    ],
    related: ['malacidal (sunny)', 'macidal (in sunlight)'],
  };

  const partials = [
    { word: 'cidalan', gloss: 'sunny place', pos: 'noun' },
    { word: 'macidal', gloss: 'sunlit, in the sun', pos: 'verb' },
    { word: 'malacidal', gloss: 'to become sunny', pos: 'verb' },
  ];

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <ScreenHeader lang={lang} title="Dictionary" onHome={onHome} onSettings={onSettings} />

      {/* Search + sources */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input value={q} onChange={setQ} placeholder="Type a word…" icon="search" iconR="mic" big mono />
        </div>
        <button aria-label="Sources" style={{
          width: 52, height: 52, borderRadius: 14,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: T.inkSoft, flexShrink: 0,
        }}>
          <Icon name="library" size={17} strokeWidth={1.8} />
          <span className="mono" style={{ fontSize: 8.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Sources</span>
        </button>
      </div>

      {/* Exact match — large card */}
      <Card raised pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div className="serif" style={{ fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em' }}>{exact.word}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: 11, color: T.crimson, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{exact.pos}</span>
                <span style={{ fontSize: 11, color: T.inkFaint }}>·</span>
                <span style={{ fontSize: 11, color: T.inkMute }}>{exact.dialect}</span>
              </div>
            </div>
            <Chip tone="sage" size="sm" icon="check">exact</Chip>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {exact.defs.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, paddingTop: 2 }}>{d.id}.</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{d.pri}</div>
                  <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 1, lineHeight: 1.35 }}>{d.sec}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Examples */}
        <div style={{ padding: '12px 16px 16px', background: T.paper }}>
          <div style={{ fontFamily: T.fMono, fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Examples</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exact.examples.map((ex, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="serif" style={{ fontSize: 14.5, color: T.ink, fontStyle: 'italic' }}>{ex.ami}</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft }}>{ex.en}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: 12, borderTop: `1px solid ${T.lineSoft}`, background: T.paper, display: 'flex', gap: 8 }}>
          <Button variant="primary" size="md" icon="bookmark" style={{ flex: 1 }}>Save word</Button>
          <Button variant="secondary" size="md" icon="capture" iconR="arrow-r" style={{ flex: 1 }}>Add context</Button>
        </div>
      </Card>

      {/* Related / partial matches */}
      <div>
        <SectionHead title="Also matches" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {partials.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', background: T.paperHi,
              border: `1px solid ${T.lineSoft}`, borderRadius: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="serif" style={{ fontSize: 16, fontWeight: 500, color: T.ink }}>{p.word}</span>
                  <span className="mono" style={{ fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.pos}</span>
                </div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>{p.gloss}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button aria-label="Open in dictionary" style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="dict" size={15} strokeWidth={1.8} />
                </button>
                <button aria-label="Save" style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="bookmark" size={15} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 5 · TRANSLATE
// ═══════════════════════════════════════════════════════════════
const ScreenTranslate = ({ lang, onHome, onSettings }) => {
  const [src, setSrc] = React.useState('en');
  const [tgt, setTgt] = React.useState('ami');
  const [text, setText] = React.useState('I want to learn your language.');
  const [out, setOut] = React.useState('Maolah kako misanga to sowal no niyaro\u02bc iso.');

  const opts = [
    { code: 'en', name: 'English', supported: ['ami', 'tay'] },
    { code: 'zh', name: '中文', supported: ['ami', 'tay', 'bnn'] },
    { code: 'ami', name: 'Amis', supported: ['en', 'zh'] },
    { code: 'tay', name: 'Atayal', supported: ['en', 'zh'] },
    { code: 'bnn', name: 'Bunun', supported: ['zh'] },
    { code: 'pyu', name: 'Puyuma', supported: [] },
    { code: 'pwn', name: 'Paiwan', supported: [] },
  ];

  const tgtOpts = opts.find(o => o.code === src)?.supported || [];

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <ScreenHeader lang={lang} title="Translate" onHome={onHome} onSettings={onSettings} />
      <div style={{ fontSize: 12, color: T.inkMute, lineHeight: 1.4, padding: '0 4px', marginTop: -6 }}>
        Independent of your study language · supported pairs only
      </div>

      {/* Pair selector */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0,
        background: T.paperHi, borderRadius: 16, border: `1px solid ${T.lineSoft}`,
        overflow: 'hidden',
      }}>
        <button style={{
          padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</span>
          <span className="serif" style={{ fontSize: 17, fontWeight: 500, color: T.ink }}>
            {opts.find(o => o.code === src)?.name}
          </span>
        </button>
        <button onClick={() => { setSrc(tgt); setTgt(src); }} style={{
          padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.crimson, borderLeft: `1px solid ${T.lineSoft}`, borderRight: `1px solid ${T.lineSoft}`,
          background: T.paper,
        }}>
          <Icon name="swap" size={18} strokeWidth={2} />
        </button>
        <button style={{
          padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</span>
          <span className="serif" style={{ fontSize: 17, fontWeight: 500, color: T.ink }}>
            {opts.find(o => o.code === tgt)?.name}
          </span>
        </button>
      </div>

      {/* Source panel */}
      <div style={{
        background: T.paperHi, border: `1.5px solid ${T.line}`,
        borderRadius: 18, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {opts.find(o => o.code === src)?.name}
          </span>
          <button style={{ color: T.inkMute, fontSize: 12 }}>Clear</button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="Type or paste…" style={{
          width: '100%', border: 0, background: 'transparent', resize: 'none',
          fontFamily: T.fSans, fontSize: 16, fontWeight: 400, color: T.ink, lineHeight: 1.4,
        }} />
      </div>

      {/* Output panel */}
      <div style={{
        background: `linear-gradient(180deg, ${T.cream}, ${T.paper})`,
        border: `1.5px solid ${T.crimsonBg}`,
        borderRadius: 18, padding: '14px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -1, left: 16, height: 3, width: 36,
          background: T.crimson, borderRadius: '0 0 4px 4px',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 10.5, color: T.crimson, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {opts.find(o => o.code === tgt)?.name}
          </span>
          <Chip size="sm" tone="ghost" icon="sparkle">AI</Chip>
        </div>
        <div className="serif" style={{ fontSize: 19, color: T.ink, lineHeight: 1.35, fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.015em' }}>
          {out}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.crimsonBg}` }}>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8, background: T.paperHi,
            border: `1px solid ${T.lineSoft}`, color: T.inkSoft, fontSize: 12, fontWeight: 500,
          }}>
            <Icon name="copy" size={13} strokeWidth={1.8} /> Copy
          </button>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8, background: T.paperHi,
            border: `1px solid ${T.lineSoft}`, color: T.inkSoft, fontSize: 12, fontWeight: 500,
          }}>
            <Icon name="speaker" size={13} strokeWidth={1.8} /> Listen
          </button>
          <div style={{ flex: 1 }} />
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8, background: T.crimson, color: '#fff',
            fontSize: 12, fontWeight: 600,
          }}>
            <Icon name="bookmark" size={13} strokeWidth={1.8} color="#fff" /> Save
          </button>
        </div>
      </div>

      <div style={{
        fontSize: 11.5, color: T.inkMute, lineHeight: 1.5, padding: '0 4px', display: 'flex', gap: 6, alignItems: 'flex-start',
      }}>
        <Icon name="sparkle" size={12} color={T.inkMute} strokeWidth={1.8} style={{ marginTop: 2, flexShrink: 0 }} />
        AI translations approximate. Verify with a fluent speaker before relying on them.
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 6 · SETTINGS
// ═══════════════════════════════════════════════════════════════
const ScreenSettings = ({ lang, onSelectLang, onBack, onHome }) => {
  const [goal, setGoal] = React.useState(20);
  const [locale, setLocale] = React.useState('en');

  return (
    <div style={{ padding: '4px 0 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '0 18px' }}>
        <ScreenHeader lang={lang} title="Settings" onHome={onHome || onBack}
          right={(
            <button onClick={onHome || onBack} aria-label="Back to dashboard" style={{
              width: 36, height: 36, borderRadius: 999, background: T.paperHi,
              border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkSoft, flexShrink: 0,
            }}><Icon name="arrow-l" size={17} strokeWidth={1.8} /></button>
          )}
        />
      </div>

      {/* Profile card */}
      <div style={{ padding: '0 18px' }}>
        <Card raised pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999, background: T.amberBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C6515',
            border: `1px solid ${T.amber}`,
          }}>
            <Icon name="user" size={22} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Panay Kusui</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>panay@indivore.app</div>
          </div>
          <Chip size="sm" tone="sage">synced</Chip>
        </Card>
      </div>

      {/* Active study language — featured */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Active study language" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16,
          overflow: 'hidden',
        }}>
          {LANGS.slice(0, 3).map((l, i, arr) => {
            const active = l.code === lang.code;
            return (
              <button key={l.code} onClick={() => onSelectLang(l)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '12px 14px', textAlign: 'left',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                background: active ? T.crimsonBg : 'transparent',
                transition: 'background .15s',
              }}>
                <LangAvatar letter={l.letter} color={l.color} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: T.fSerif }}>{l.name}</div>
                  {l.dialect && <div style={{ fontSize: 11.5, color: T.inkSoft }}>default · {l.dialect}</div>}
                </div>
                {active ? (
                  <div style={{
                    width: 22, height: 22, borderRadius: 999, background: T.crimson,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name="check" size={13} color="#fff" strokeWidth={2.6} /></div>
                ) : (
                  <Icon name="chevron" size={14} color={T.inkFaint} />
                )}
              </button>
            );
          })}
          <button style={{
            padding: '11px 14px', textAlign: 'center', width: '100%',
            fontSize: 12.5, color: T.crimson, fontWeight: 600, borderTop: `1px solid ${T.lineSoft}`,
          }}>See all 16 Formosan languages</button>
        </div>
      </div>

      {/* Preferences */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Preferences" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
        }}>
          {/* Locale */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>Interface language</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'en', label: 'English' },
                { id: 'zh', label: '繁體中文', soon: true },
              ].map(o => (
                <button key={o.id} disabled={o.soon} onClick={() => !o.soon && setLocale(o.id)} style={{
                  flex: 1, padding: '8px', borderRadius: 10,
                  background: locale === o.id ? T.ink : T.paper,
                  color: locale === o.id ? T.cream : o.soon ? T.inkFaint : T.ink,
                  border: `1px solid ${locale === o.id ? T.ink : T.lineSoft}`,
                  fontSize: 13, fontWeight: 500,
                  cursor: o.soon ? 'not-allowed' : 'pointer',
                }}>
                  {o.label}{o.soon && ' · soon'}
                </button>
              ))}
            </div>
          </div>

          {/* Daily goal */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Daily review goal</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span className="serif" style={{ fontSize: 22, fontWeight: 600, color: T.crimson }}>{goal}</span>
                <span style={{ fontSize: 11, color: T.inkMute }}>cards</span>
              </div>
            </div>
            <input type="range" min="5" max="50" step="5" value={goal} onChange={(e) => setGoal(Number(e.target.value))}
              style={{ width: '100%', accentColor: T.crimson }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.inkFaint, marginTop: 2, fontFamily: T.fMono }}>
              <span>5</span><span>25</span><span>50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Account" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
        }}>
          {[
            { label: 'Export notebook', icon: 'bookmark' },
            { label: 'About Indivore', icon: 'leaf' },
            { label: 'Sign out', icon: 'logout', danger: true },
          ].map((row, i, arr) => (
            <button key={row.label} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 14px', textAlign: 'left',
              borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
              color: row.danger ? T.crimson : T.ink,
            }}>
              <Icon name={row.icon} size={17} color={row.danger ? T.crimson : T.inkSoft} strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{row.label}</span>
              {!row.danger && <Icon name="chevron" size={14} color={T.inkFaint} />}
            </button>
          ))}
        </div>
        <div style={{
          textAlign: 'center', fontFamily: T.fMono, fontSize: 10.5,
          color: T.inkFaint, marginTop: 14, letterSpacing: '0.05em',
        }}>
          Indivore v0.1 · 行動族語筆記本
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ScreenDashboard, ScreenCapture, ScreenReview, ScreenDictionary, ScreenTranslate, ScreenSettings,
  ScreenHeader,
  LANGS, RECENT_CAPTURES,
});

})();
