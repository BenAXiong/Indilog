(()=>{
// Indivore — SRS spec screens, part B: Review session + Review end
const T = window.TOKENS;
const { Icon, Chip } = window;

// ═══════════════════════════════════════════════════════════════
// SCREEN 3 · REVIEW SESSION (full screen — no bottom nav)
//   state: 'front' | 'four' | 'two' | 'options'
// ═══════════════════════════════════════════════════════════════
const SrsReview = ({ state = 'front' }) => {
  const revealed = state !== 'front';
  const showOptions = state === 'options';

  const card = {
    type: 'sentence',
    front: 'Maolah kako tomireng i riyar',
    answer: 'I like to stand by the sea',
    note: 'maolah · like / love   ·   riyar · sea, ocean',
  };

  const ratings4 = [
    { label: 'Again', sub: '<1m', color: T.crimson },
    { label: 'Hard',  sub: '8m',  color: T.terra },
    { label: 'Good',  sub: '2d',  color: T.sage },
    { label: 'Easy',  sub: '4d',  color: T.amber },
  ];
  const ratings2 = [
    { label: 'Again', sub: '<1m', color: T.crimson },
    { label: 'Good',  sub: '2d',  color: T.sage },
  ];
  const ratings = state === 'two' ? ratings2 : ratings4;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 18px 0' }}>
        <button aria-label="Exit session" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0,
        }}><Icon name="close" size={16} strokeWidth={2} /></button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Amis1k · 詞匯</div>
        </div>
        <span className="mono" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, letterSpacing: '0.01em' }}>7 / 23</span>
        <button aria-label="Session options" style={{
          width: 36, height: 36, borderRadius: 999,
          background: showOptions ? T.ink : T.paperHi,
          border: `1px solid ${showOptions ? T.ink : T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: showOptions ? T.cream : T.inkSoft, flexShrink: 0,
        }}><Icon name="settings" size={16} strokeWidth={1.7} /></button>
      </div>

      {/* progress bar */}
      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ height: 4, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: '30%', height: '100%', background: T.crimson, borderRadius: 999 }} />
        </div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '18px 18px 0' }}>
        <div style={{
          position: 'relative', background: T.paperHi, borderRadius: 22,
          border: `1px solid ${T.lineSoft}`, padding: '26px 22px',
          minHeight: 300, display: 'flex', flexDirection: 'column',
          boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
        }}>
          {/* card type label */}
          <div style={{ position: 'absolute', top: 14, right: 16 }}>
            <span className="mono" style={{ fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.type}</span>
          </div>

          {/* swipe affordances — only un-revealed */}
          {!revealed && (
            <React.Fragment>
              <div style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.crimson, opacity: 0.55,
              }}>
                <Icon name="arrow-l" size={17} strokeWidth={2} />
                <span className="mono" style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>again</span>
              </div>
              <div style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.sage, opacity: 0.6,
              }}>
                <Icon name="arrow-r" size={17} strokeWidth={2} />
                <span className="mono" style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl' }}>good</span>
              </div>
            </React.Fragment>
          )}

          {/* Front */}
          <div style={{ flex: revealed ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 16px' }}>
            <div className="serif" style={{ fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.22 }}>{card.front}</div>
            <button style={{
              marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px 7px 10px', borderRadius: 999, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft, fontSize: 12.5, fontWeight: 500,
            }}>
              <Icon name="speaker" size={14} strokeWidth={1.8} /> Hear it
            </button>
          </div>

          {/* Reveal / Answer */}
          {revealed ? (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 1, background: T.lineSoft }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{card.answer}</div>
                <div className="mono" style={{ fontSize: 11, color: T.inkMute, marginTop: 9, letterSpacing: '0.01em', lineHeight: 1.5 }}>{card.note}</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 'auto', paddingTop: 22, textAlign: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>tap card to reveal</span>
            </div>
          )}
        </div>
      </div>

      {/* Rating row */}
      <div style={{ padding: '20px 18px 26px' }}>
        {revealed ? (
          <div style={{ display: 'grid', gridTemplateColumns: ratings.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 7 }}>
            {ratings.map((r) => (
              <button key={r.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '12px 4px', borderRadius: 13,
                background: T.paperHi, border: `1.5px solid ${r.color}`, color: r.color, fontWeight: 600,
              }}>
                <span style={{ fontSize: 13.5 }}>{r.label}</span>
                <span className="mono" style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>{r.sub}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center', fontSize: 12, color: T.inkMute, lineHeight: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <Icon name="swap" size={14} color={T.inkFaint} strokeWidth={1.8} />
            Swipe or tap to grade · ← Again · Good →
          </div>
        )}
      </div>

      {/* Options sheet */}
      {showOptions && <OptionsSheet />}
    </div>
  );
};

const OptionsSheet = () => {
  const Row = ({ label, sub, on, last }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{
        width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? T.sage : T.line, transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999,
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
        }} />
      </span>
    </div>
  );
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,22,16,0.32)', zIndex: 20 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 21,
        background: T.cream, borderRadius: '22px 22px 0 0',
        padding: '10px 14px 26px', boxShadow: '0 -12px 36px rgba(40,30,20,0.2)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.line, margin: '0 auto 14px' }} />
        <div className="mono" style={{ fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '0 4px 10px' }}>Session options</div>
        <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
          <Row label="Show rating buttons" sub="Off = gesture-only grading" on={true} />
          <Row label="Hard + Easy" sub="Show all four grades, not just two" on={true} />
          <Row label="Full immersion" sub="Hide buttons, swipe to grade" on={false} />
          <Row label="Autoplay audio" sub="Speak the front on each card" on={true} last />
        </div>
      </div>
    </React.Fragment>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCREEN 4 · REVIEW END
//   variant: 'met' (goal met → confetti) | 'low' (few due → nudge)
// ═══════════════════════════════════════════════════════════════
const SrsEnd = ({ variant = 'met' }) => {
  const met = variant === 'met';
  const reviewed = met ? 23 : 12;
  const dueTomorrow = met ? 31 : 4;

  // deterministic confetti
  const colors = [T.crimson, T.amber, T.sage, T.terra, T.crimsonHi];
  const conf = [];
  let s = 11;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 22; i++) {
    conf.push({ left: rnd() * 100, top: rnd() * 42, rot: rnd() * 360, c: colors[i % colors.length], w: 6 + rnd() * 6, h: 9 + rnd() * 8, r: rnd() > 0.6 });
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* confetti layer */}
      {met && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          {conf.map((p, i) => (
            <span key={i} style={{
              position: 'absolute', left: `${p.left}%`, top: `${p.top}%`,
              width: p.w, height: p.h, background: p.c, borderRadius: p.r ? 999 : 2,
              transform: `rotate(${p.rot}deg)`, opacity: 0.9,
            }} />
          ))}
        </div>
      )}

      {/* close */}
      <div style={{ padding: '4px 18px 0', display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 2 }}>
        <button aria-label="Close" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkSoft,
        }}><Icon name="close" size={16} strokeWidth={2} /></button>
      </div>

      {/* hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px', position: 'relative', zIndex: 2 }}>
        {met ? (
          <span className="mono" style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: T.sageDp, background: T.sageBg, border: `1px solid #D2D8AE`,
            padding: '6px 13px', borderRadius: 999, marginBottom: 22,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="check" size={13} color={T.sageDp} strokeWidth={2.6} /> Daily goal met
          </span>
        ) : (
          <div style={{
            width: 54, height: 54, borderRadius: 999, background: T.crimsonBg, border: `1px solid #EFCAB8`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.crimson, marginBottom: 22,
          }}><Icon name="check" size={26} strokeWidth={2.4} /></div>
        )}

        <div className="serif" style={{ fontSize: 92, fontWeight: 600, color: T.ink, letterSpacing: '-0.04em', lineHeight: 0.9 }}>{reviewed}</div>
        <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 8, fontWeight: 500 }}>cards reviewed</div>

        <div style={{
          marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 16px', borderRadius: 14, background: T.paperHi, border: `1px solid ${T.lineSoft}`,
        }}>
          <Icon name="card" size={16} color={T.amber} strokeWidth={1.8} />
          <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em' }}>{dueTomorrow}</span>
          <span style={{ fontSize: 13, color: T.inkSoft }}>due tomorrow</span>
        </div>

        {/* low-due nudge */}
        {!met && (
          <div style={{
            marginTop: 18, display: 'flex', alignItems: 'flex-start', gap: 7, maxWidth: 280,
            fontSize: 12, color: T.inkMute, lineHeight: 1.5, textAlign: 'left',
          }}>
            <Icon name="capture" size={14} color={T.sage} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Capture more words today to keep your streak growing tomorrow.</span>
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ padding: '0 18px 28px', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{
          width: '100%', height: 46, borderRadius: 13, background: T.paperHi, color: T.ink,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 14.5, fontWeight: 600, boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
        }}>
          <Icon name="share" size={16} strokeWidth={1.9} /> Share progress
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {met && (
            <button style={{
              flex: 1, height: 52, borderRadius: 14, background: T.paperHi, color: T.ink,
              border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 15, fontWeight: 600, boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
            }}>
              <Icon name="review" size={15} strokeWidth={2} /> Review more
            </button>
          )}
          <button style={{
            flex: met ? 1 : 'none', width: met ? undefined : '100%', height: 52, borderRadius: 14,
            background: T.crimson, color: '#fff', border: `1px solid ${T.crimson}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 600,
            boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(120,30,15,0.2)',
          }}>Done</button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SrsReview, SrsEnd });

})();
