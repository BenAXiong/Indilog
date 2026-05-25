(()=>{
// Indivore — desktop layout (sidebar nav + 2-column dashboard / capture)
const T = window.TOKENS;
const { Icon, Chip, Card, Button, Input, SectionHead, LangAvatar, Stat, Wordmark } = window;

const DesktopApp = ({ lang }) => {
  const [tab, setTab] = React.useState('dashboard');
  const sideItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'learn',     label: 'Learn',     icon: 'learn' },
    { id: 'review',    label: 'Review',    icon: 'review', badge: 12 },
    { id: 'dict',      label: 'Dictionary', icon: 'dict' },
    { id: 'translate', label: 'Translate', icon: 'translate' },
  ];

  return (
    <div className="iv" style={{
      width: '100%', height: '100%', background: T.cream,
      display: 'grid', gridTemplateColumns: '232px 1fr',
    }}>
      {/* Sidebar */}
      <aside style={{
        padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 18,
        borderRight: `1px solid ${T.line}`, background: T.paper,
      }}>
        <div style={{ padding: '4px 10px 0' }}>
          <Wordmark size={20} />
        </div>

        {/* Active language card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px', background: T.paperHi,
          border: `1px solid ${T.lineSoft}`, borderRadius: 12,
        }}>
          <LangAvatar letter={lang.letter} color={lang.color} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, color: T.inkMute, fontFamily: T.fMono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Studying</div>
            <div className="serif" style={{ fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>{lang.name}</div>
          </div>
          <Icon name="chev-d" size={13} color={T.inkFaint} />
        </div>

        {/* Capture button — primary */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '11px 12px', borderRadius: 12,
          background: T.crimson, color: '#fff',
          boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(120,30,15,0.2), 0 6px 14px rgba(120,30,15,0.18)',
          fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.005em',
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="capture" size={13} color="#fff" strokeWidth={2.4} />
          </div>
          Capture
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>⌘K</span>
        </button>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sideItems.map((it) => {
            const active = tab === it.id;
            return (
              <button key={it.id} onClick={() => setTab(it.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                background: active ? T.crimsonBg : 'transparent',
                color: active ? T.crimsonDp : T.inkSoft,
                fontSize: 13, fontWeight: 500, transition: 'background .15s, color .15s',
              }}>
                <Icon name={it.icon} size={17} strokeWidth={active ? 2 : 1.6} />
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.badge && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                    background: active ? T.crimson : T.line, color: active ? '#fff' : T.inkSoft,
                  }}>{it.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Streak mini */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 12px', borderRadius: 12,
          background: `linear-gradient(135deg, ${T.crimson}, ${T.crimsonDp})`,
          color: '#fff',
        }}>
          <Icon name="flame" size={17} color="#fff" strokeWidth={2} />
          <span className="serif" style={{ fontSize: 17, fontWeight: 600 }}>17</span>
          <span style={{ fontSize: 11.5, opacity: 0.85, flex: 1 }}>day streak</span>
        </div>

        <button style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 12px', color: T.inkSoft, fontSize: 12.5, fontWeight: 500,
        }}>
          <Icon name="settings" size={15} strokeWidth={1.8} /> Settings
        </button>
      </aside>

      {/* Main */}
      <main style={{ padding: '24px 32px 32px', overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: T.fMono, fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tuesday · May 26</div>
            <h1 className="serif" style={{ fontSize: 34, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em', marginTop: 2 }}>
              Maolah ko misang—<span style={{ color: T.inkSoft, fontStyle: 'italic' }}>welcome back, Panay.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 14px', height: 38,
              background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 10,
              color: T.inkMute, fontSize: 13, minWidth: 260,
            }}>
              <Icon name="search" size={15} color={T.inkMute} />
              Search your notebook…
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 10.5, color: T.inkFaint }}>⌘/</span>
            </div>
            <div style={{
              width: 38, height: 38, borderRadius: 999, background: T.amberBg,
              border: `1px solid ${T.amber}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C6515',
            }}>
              <Icon name="user" size={18} strokeWidth={1.6} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
          <Stat value="142" label="Total captures"   icon="capture" accent={T.crimson} />
          <Stat value="86"  label="Reviewed this week" icon="card"   accent={T.sage} />
          <Stat value="12"  label="Due today"           icon="review" accent={T.amber} />
          <Stat value="4"   suffix="of 24" label="Lessons learned" icon="learn" accent={T.terra} />
        </div>

        {/* Two column body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
          {/* Recent captures (left) */}
          <div>
            <SectionHead title="Recent captures" action="Open Review" onAction={() => {}} style={{ padding: '0 4px 10px' }} />
            <div style={{
              background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16,
              overflow: 'hidden',
            }}>
              {window.RECENT_CAPTURES.map((c, i, arr) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                  transition: 'background .15s',
                  cursor: 'pointer',
                }} onMouseEnter={(e) => e.currentTarget.style.background = T.paper}
                   onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: c.type === 'word' ? T.amberBg : c.type === 'sentence' ? T.crimsonBg : T.sageBg,
                    color: c.type === 'word' ? '#8C6515' : c.type === 'sentence' ? T.crimsonDp : T.sageDp,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={c.type === 'word' ? 'word' : 'note'} size={15} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: T.ink }}>{c.term}</div>
                    <div style={{ fontSize: 12.5, color: T.inkSoft, fontStyle: 'italic', marginTop: 1 }}>{c.gloss}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.source}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: T.inkFaint }}>{c.when}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Today's review CTA */}
            <Card raised pad={18}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Today's review</span>
                <Chip size="sm" tone="amber" icon="flame">8 of 20</Chip>
              </div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', marginTop: 6 }}>
                12 cards due
              </div>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
                ~6 minutes · keep your 17-day streak going
              </div>
              <div style={{ height: 6, background: T.lineSoft, borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
                <div style={{
                  width: '40%', height: '100%',
                  background: `linear-gradient(90deg, ${T.amber}, ${T.crimson})`,
                  borderRadius: 999,
                }} />
              </div>
              <Button variant="primary" size="md" icon="play" iconR="arrow-r" full style={{ marginTop: 14 }}>Start review</Button>
            </Card>

            {/* Quick capture inline */}
            <Card raised pad={16} accent={T.crimson}>
              <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Quick capture</span>
              <div style={{
                marginTop: 10, padding: '12px 14px',
                background: T.cream, border: `1px solid ${T.lineSoft}`, borderRadius: 12,
              }}>
                <div className="serif" style={{ fontSize: 16, color: T.inkMute, fontStyle: 'italic' }}>
                  What did you hear today?
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <Chip size="sm" tone="default" active>Sentence</Chip>
                  <Chip size="sm">Word</Chip>
                  <Chip size="sm">Note</Chip>
                </div>
              </div>
              <Button variant="primary" size="md" icon="capture" full style={{ marginTop: 12 }}>Open Capture</Button>
            </Card>

            {/* Lesson card — secondary */}
            <Card pad={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: T.sageBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="learn" size={18} color={T.sageDp} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Continue: Greetings</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>Lesson 5 of 24 · 3 min left</div>
                </div>
                <Icon name="chevron" size={15} color={T.inkFaint} />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

window.DesktopApp = DesktopApp;

})();
