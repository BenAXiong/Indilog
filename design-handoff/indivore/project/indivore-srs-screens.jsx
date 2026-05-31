(()=>{
// Indivore — SRS spec screens, part A: Dashboard + Study
// Built on the existing Indivore visual language (tokens + ui-v2 components).

const T = window.TOKENS;
const { Icon, Chip, Card, Button, SectionHead, Stat } = window;

// Accent families (per brief): curriculum=crimson, collections=amber, captures=sage
const FAM = {
  crimson: { dot: T.crimson,   bg: T.crimsonBg, ink: T.crimsonDp, soft: '#EFCAB8' },
  amber:   { dot: T.amber,     bg: T.amberBg,   ink: '#8C6515',   soft: '#EBD49A' },
  sage:    { dot: T.sage,      bg: T.sageBg,    ink: T.sageDp,    soft: '#D2D8AE' },
};

// ─── Logo + lang pill header ───────────────────────────────────
const SrsHeader = ({ title, lang, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingTop: 4 }}>
    <img src="uploads/Kilang_5_nobg_noring2.png" alt="Indivore"
      style={{ width: 34, height: 34, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
    <h1 className="serif" style={{
      flex: 1, fontSize: 27, fontWeight: 500, color: T.ink,
      letterSpacing: '-0.025em', lineHeight: 1, minWidth: 0,
    }}>{title}</h1>
    {right ?? (lang && (
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 8px 6px 6px', borderRadius: 999,
        background: T.paperHi, border: `1px solid ${T.line}`, flexShrink: 0,
        boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 999, background: lang.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fSerif, fontWeight: 600, fontSize: 12,
        }}>{lang.letter}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{lang.name}</span>
        <Icon name="chev-d" size={13} color={T.inkMute} strokeWidth={2} />
      </button>
    ))}
  </div>
);

// ─── Due badge — prominent >0, muted =0 ────────────────────────
const DueBadge = ({ n }) => {
  if (n > 0) return (
    <span className="mono" style={{
      minWidth: 26, height: 22, padding: '0 7px', borderRadius: 999,
      background: T.crimson, color: '#fff', fontSize: 11.5, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      letterSpacing: '0.01em', boxShadow: '0 1px 2px rgba(120,30,15,0.25)',
    }}>{n}</span>
  );
  return (
    <span className="mono" style={{
      minWidth: 26, height: 22, padding: '0 7px', borderRadius: 999,
      background: 'transparent', color: T.inkFaint, fontSize: 11.5, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${T.lineSoft}`,
    }}>0</span>
  );
};

// ─── Deck row ──────────────────────────────────────────────────
const DeckRow = ({ fam, name, sub, due, kebab, last }) => {
  const f = FAM[fam];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: f.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.15 }}>{name}</div>
        {sub && <div className="mono" style={{ fontSize: 11, color: T.inkMute, marginTop: 2, letterSpacing: '0.01em' }}>{sub}</div>}
      </div>
      <DueBadge n={due} />
      {kebab && (
        <button aria-label="Deck actions" style={{
          width: 30, height: 30, borderRadius: 8, color: T.inkMute,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><Icon name="more-v" size={17} strokeWidth={2} /></button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCREEN 1 · DASHBOARD — motivational SRS hub
// ═══════════════════════════════════════════════════════════════
const SrsDashboard = ({ lang }) => {
  // Today's ring
  const reviewed = 14, goal = 20;
  const due = 23;
  const pct = Math.min(reviewed / goal, 1);
  const R = 52, C = 2 * Math.PI * R;

  // recent-day chain for streak (last 7, all complete)
  const chain = [1,1,1,1,1,1,1];

  return (
    <div style={{ padding: '4px 18px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SrsHeader title="Dashboard" lang={lang} />

      {/* Streak + Goal row */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Streak */}
        <div style={{
          flex: 1, padding: '13px 14px', borderRadius: 16,
          background: `linear-gradient(150deg, ${T.crimson}, ${T.crimsonDp})`,
          color: '#fff', position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px rgba(120,30,15,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="flame" size={17} color="#fff" strokeWidth={1.9} />
            <span className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>17</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>days</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 11 }}>
            {chain.map((c, i) => (
              <span key={i} style={{
                flex: 1, height: 5, borderRadius: 999,
                background: c ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.28)',
              }} />
            ))}
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.78, marginTop: 7, fontFamily: T.fMono, letterSpacing: '0.02em' }}>last 7 days</div>
        </div>

        {/* Goal widget — active */}
        <div style={{
          flex: 1, padding: '13px 14px', borderRadius: 16,
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
          display: 'flex', flexDirection: 'column',
        }}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Goal</div>
          <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: T.ink, marginTop: 4, letterSpacing: '-0.015em', lineHeight: 1.1 }}>Amis 1k</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>9 days left</div>
          <div style={{ flex: 1 }} />
          <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, overflow: 'hidden', marginTop: 11 }}>
            <div style={{ width: '62%', height: '100%', background: T.amber, borderRadius: 999 }} />
          </div>
        </div>
      </div>

      {/* Today's ring + primary CTA */}
      <Card raised pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
            <svg width="124" height="124" viewBox="0 0 124 124">
              <circle cx="62" cy="62" r={R} fill="none" stroke={T.lineSoft} strokeWidth="11" />
              <circle cx="62" cy="62" r={R} fill="none" stroke={T.crimson} strokeWidth="11"
                strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
                transform="rotate(-90 62 62)" />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="serif" style={{ fontSize: 34, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{reviewed}</span>
              <span className="mono" style={{ fontSize: 10.5, color: T.inkMute, marginTop: 2, letterSpacing: '0.03em' }}>/ {goal} today</span>
            </div>
          </div>
          {/* Figures */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Due today</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 3 }}>
              <span className="serif" style={{ fontSize: 40, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{due}</span>
              <span style={{ fontSize: 13, color: T.inkSoft }}>cards</span>
            </div>
            <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>6 of {goal} daily goal still to go</div>
          </div>
        </div>

        {/* Primary CTA */}
        <button style={{
          marginTop: 16, width: '100%', height: 56, borderRadius: 15,
          background: T.crimson, color: '#fff', border: `1px solid ${T.crimson}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2), 0 8px 18px rgba(120,30,15,0.2)',
        }}>
          <Icon name="play" size={15} color="#fff" />
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Review {due} due</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 500, opacity: 0.82, marginLeft: 2 }}>~12 min</span>
        </button>
      </Card>

      {/* Heatmap — 16 weeks */}
      <div>
        <SectionHead title="Review history" action="16 weeks" />
        <Heatmap />
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat value="412"  label="Mastered"     icon="check"   accent={T.sage} />
        <Stat value="1,240" label="Active"        icon="layers"  accent={T.crimson} />
        <Stat value="186"  label="This week"     icon="review"  accent={T.terra} />
        <Stat value="31"   label="Due tomorrow"  icon="card"    accent={T.amber} />
      </div>
    </div>
  );
};

// ─── GitHub-style heatmap, crimson intensity ───────────────────
const Heatmap = () => {
  const weeks = 16;
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const data = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    const recency = w / (weeks - 1);
    for (let d = 0; d < 7; d++) {
      const r = rand();
      let lvl = 0;
      if (r < 0.55 + recency * 0.25) lvl = 1;
      if (r < 0.38 + recency * 0.30) lvl = 2;
      if (r < 0.20 + recency * 0.25) lvl = 3;
      if (r < 0.08 + recency * 0.15) lvl = 4;
      week.push(lvl);
    }
    data.push(week);
  }
  // last 16 days active for the 17-day streak (today partial)
  let back = 16;
  for (let w = weeks - 1; w >= 0 && back >= 0; w--) {
    for (let d = 6; d >= 0 && back >= 0; d--) {
      if (data[w][d] === 0) data[w][d] = 1;
      back--;
    }
  }
  const intensity = [T.lineSoft, '#F1D8C6', '#E5A88E', '#C66848', T.crimsonDp];
  const months = ['Feb', 'Mar', 'Apr', 'May'];
  const days = ['M', '', 'W', '', 'F', '', ''];
  return (
    <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, padding: '14px 14px 12px' }}>
      {/* month labels */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 5, paddingLeft: 16 }}>
        {data.map((_, wi) => {
          const label = wi % 4 === 1 && months[Math.floor(wi / 4)];
          return <div key={wi} style={{ width: 14, fontSize: 9.5, color: T.inkMute, fontFamily: T.fMono, letterSpacing: '0.04em' }}>{label || ''}</div>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {/* day-of-week labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 1 }}>
          {days.map((d, i) => (
            <div key={i} style={{ width: 11, height: 14, fontSize: 8.5, color: T.inkFaint, fontFamily: T.fMono, display: 'flex', alignItems: 'center' }}>{d}</div>
          ))}
        </div>
        {/* grid */}
        <div style={{ display: 'flex', gap: 3 }}>
          {data.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map((lvl, di) => {
                const isToday = wi === weeks - 1 && di === 6;
                return (
                  <div key={di} style={{
                    width: 14, height: 14, borderRadius: 3.5, background: intensity[lvl],
                    border: lvl === 0 ? `1px solid ${T.line}` : 'none',
                    boxShadow: isToday ? `0 0 0 1.5px ${T.crimson}` : 'none',
                  }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12, fontSize: 10, color: T.inkMute, fontFamily: T.fMono, letterSpacing: '0.04em' }}>
        <span>less</span>
        {intensity.map((c, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c, border: i === 0 ? `1px solid ${T.line}` : 'none' }} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCREEN 2 · STUDY — deck management
//   activeTab: 'decks' | 'browser' | 'stats'
// ═══════════════════════════════════════════════════════════════
const SrsStudy = ({ lang, activeTab = 'decks' }) => {
  const tabs = [
    { id: 'decks', label: 'Decks' },
    { id: 'browser', label: 'Browser' },
    { id: 'stats', label: 'Stats' },
  ];
  return (
    <div style={{ padding: '4px 0 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* header with + */}
      <div style={{ padding: '0 18px' }}>
        <SrsHeader title="Study" right={(
          <button aria-label="Import collection" style={{
            width: 38, height: 38, borderRadius: 12, background: T.paperHi,
            border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.ink, flexShrink: 0, boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
          }}><Icon name="plus" size={19} strokeWidth={2.2} /></button>
        )} />
      </div>

      {/* tab bar — underline */}
      <div style={{ display: 'flex', gap: 22, padding: '18px 18px 0', borderBottom: `1px solid ${T.lineSoft}`, marginBottom: 18 }}>
        {tabs.map(tb => {
          const on = tb.id === activeTab;
          return (
            <div key={tb.id} style={{ position: 'relative', paddingBottom: 11 }}>
              <span style={{ fontSize: 15, fontWeight: on ? 700 : 500, color: on ? T.ink : T.inkMute, letterSpacing: '-0.01em' }}>{tb.label}</span>
              {on && <div style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, background: T.crimson, borderRadius: 2 }} />}
            </div>
          );
        })}
      </div>

      {activeTab === 'decks' && <StudyDecks lang={lang} />}
      {activeTab === 'browser' && <EmptyTab icon="search" title="Browser" line1="Search and browse every card" line2="across all your decks." note="not yet built" />}
      {activeTab === 'stats' && <EmptyTab icon="layers" title="Stats" line1="Retention curves, forecast, and" line2="per-deck mastery breakdowns." note="not yet built" />}
    </div>
  );
};

const StudyDecks = () => (
  <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
    {/* Review all CTA */}
    <button style={{
      width: '100%', height: 54, borderRadius: 15, background: T.crimson, color: '#fff',
      border: `1px solid ${T.crimson}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2), 0 8px 18px rgba(120,30,15,0.2)',
    }}>
      <Icon name="play" size={14} color="#fff" />
      <span style={{ fontSize: 16, fontWeight: 600 }}>Review all</span>
      <span className="mono" style={{ fontSize: 12.5, opacity: 0.85, marginLeft: 2 }}>23 due</span>
    </button>

    {/* CURRICULUM */}
    <div>
      <SectionHead title="Curriculum" />
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
        <DeckRow fam="crimson" name="Lessons"  sub="Step-by-step" due={8} />
        <DeckRow fam="crimson" name="Patterns" sub="Grammar shapes" due={3} />
        <DeckRow fam="crimson" name="Essays"   sub="Long reads" due={0} />
        <DeckRow fam="crimson" name="Dialogs"  sub="Two-speaker" due={5} last />
      </div>
    </div>

    {/* MY COLLECTIONS */}
    <div>
      <SectionHead title="My collections" />
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
        <DeckRow fam="amber" name="Amis1k · 詞匯" sub="1,063 cards" due={7} kebab />
        <DeckRow fam="amber" name="Field verbs" sub="218 cards" due={0} kebab />
        {/* import ghost row */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '13px 14px', borderTop: `1px solid ${T.lineSoft}`, color: T.inkSoft, textAlign: 'left',
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 999, border: `1.5px dashed ${T.inkFaint}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><Icon name="plus" size={12} color={T.inkMute} strokeWidth={2.2} /></span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Import new collection</span>
        </button>
      </div>
    </div>

    {/* CAPTURES */}
    <div>
      <SectionHead title="Captures" />
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
        <DeckRow fam="sage" name="Captures & lookups" sub="words saved while reading" due={0} kebab last />
      </div>
    </div>
  </div>
);

// shared empty-tab placeholder (Browser / Stats)
const EmptyTab = ({ icon, title, line1, line2, note }) => (
  <div style={{ padding: '40px 30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
    {/* striped placeholder block */}
    <div style={{
      width: 96, height: 96, borderRadius: 22, marginBottom: 22,
      background: `repeating-linear-gradient(45deg, ${T.lineSoft}, ${T.lineSoft} 6px, ${T.paper} 6px, ${T.paper} 12px)`,
      border: `1px solid ${T.line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 999, background: T.paperHi,
        border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkMute,
      }}><Icon name={icon} size={24} strokeWidth={1.6} /></div>
    </div>
    <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>{title}</div>
    <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 8, lineHeight: 1.45 }}>{line1}<br/>{line2}</div>
    <div className="mono" style={{
      marginTop: 18, fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '6px 12px', borderRadius: 999, background: T.paper, border: `1px solid ${T.lineSoft}`,
    }}>{note}</div>
  </div>
);

Object.assign(window, { SrsHeader, DueBadge, DeckRow, FAM, SrsDashboard, SrsStudy });

})();
