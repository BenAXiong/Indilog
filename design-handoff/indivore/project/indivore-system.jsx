(()=>{
// Indivore — design system reference (colors, type, components)
const T = window.TOKENS;
const { Icon, Chip, Card, Button, Input, LangAvatar } = window;

const DSSwatch = ({ name, hex, light, dark }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{
      height: 64, borderRadius: 12, background: hex,
      border: `1px solid ${light ? T.line : 'transparent'}`,
      boxShadow: '0 1px 2px rgba(80,40,20,0.06)',
    }} />
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink }}>{name}</div>
      <div className="mono" style={{ fontSize: 10, color: T.inkMute, marginTop: 1 }}>{hex}</div>
    </div>
  </div>
);

const DSRow = ({ label, children }) => (
  <div>
    <div className="mono" style={{
      fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase',
      letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10,
    }}>{label}</div>
    {children}
  </div>
);

const DesignSystemBoard = () => (
  <div className="iv" style={{
    width: '100%', minHeight: '100%', padding: 32, background: T.cream,
    display: 'flex', flexDirection: 'column', gap: 28,
  }}>
    {/* Header */}
    <div>
      <div style={{ fontFamily: T.fMono, fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>System reference</div>
      <h1 className="serif" style={{ fontSize: 32, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em', marginTop: 2 }}>
        Indivore — visual system
      </h1>
      <p style={{ fontSize: 13, color: T.inkSoft, marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
        A warm field notebook for studying Formosan languages. Palette extracted from a woven-tree reference: cream paper, crimson primary, terracotta + amber + sage accents. Serif for display, sans for UI, mono for metadata.
      </p>
    </div>

    {/* Type */}
    <DSRow label="Typography">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px',
        background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, width: 100, flexShrink: 0 }}>display / 32</span>
          <span className="serif" style={{ fontSize: 32, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em' }}>Mafana'ay kako anini</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, width: 100, flexShrink: 0 }}>title / 22</span>
          <span className="serif" style={{ fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em' }}>Your saved notebook</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, width: 100, flexShrink: 0 }}>body / 15</span>
          <span style={{ fontSize: 15, color: T.ink }}>I am well today — captured from a conversation.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, width: 100, flexShrink: 0 }}>caption / 12</span>
          <span style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>i am well / I am in good spirits</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ fontSize: 10, color: T.inkMute, width: 100, flexShrink: 0 }}>label / 11 mono</span>
          <span className="mono" style={{ fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>SOURCE · CONVERSATION</span>
        </div>
      </div>
    </DSRow>

    {/* Colors */}
    <DSRow label="Palette · woven tree">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12 }}>
        <DSSwatch name="cream"     hex={T.cream}   light />
        <DSSwatch name="paper"     hex={T.paper}   light />
        <DSSwatch name="paperHi"   hex={T.paperHi} light />
        <DSSwatch name="line"      hex={T.line} />
        <DSSwatch name="ink"       hex={T.ink} />
        <DSSwatch name="inkSoft"   hex={T.inkSoft} />
        <DSSwatch name="inkMute"   hex={T.inkMute} />
        <DSSwatch name="inkFaint"  hex={T.inkFaint} />

        <DSSwatch name="crimson"   hex={T.crimson} />
        <DSSwatch name="crimsonDp" hex={T.crimsonDp} />
        <DSSwatch name="terra"     hex={T.terra} />
        <DSSwatch name="amber"     hex={T.amber} />
        <DSSwatch name="sage"      hex={T.sage} />
        <DSSwatch name="sageDp"    hex={T.sageDp} />
        <DSSwatch name="crimsonBg" hex={T.crimsonBg} light />
        <DSSwatch name="sageBg"    hex={T.sageBg} light />
      </div>
    </DSRow>

    {/* Components */}
    <DSRow label="Buttons">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Button variant="primary" icon="check">Primary</Button>
        <Button variant="secondary" icon="search">Secondary</Button>
        <Button variant="sage" icon="leaf">Sage</Button>
        <Button variant="amber" icon="flame">Amber</Button>
        <Button variant="ghost" icon="chev-d">Ghost</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="lg" icon="capture" iconR="arrow-r">Large CTA</Button>
      </div>
    </DSRow>

    <DSRow label="Chips">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip>Default</Chip>
        <Chip tone="crimson" icon="leaf">Amis · Sakizaya</Chip>
        <Chip tone="sage" icon="check">match</Chip>
        <Chip tone="amber" icon="flame">streak</Chip>
        <Chip tone="terra">terra</Chip>
        <Chip tone="ghost">All sources</Chip>
        <Chip tone="ink" active>active</Chip>
        <Chip size="sm">small chip</Chip>
        <Chip size="lg" icon="user">large chip</Chip>
      </div>
    </DSRow>

    <DSRow label="Cards & inputs">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Card pad={14}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>card · flat</div>
          <div className="serif" style={{ fontSize: 16, color: T.ink }}>cidal</div>
          <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic', marginTop: 2 }}>sun · day</div>
        </Card>
        <Card raised pad={14}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>card · raised</div>
          <div className="serif" style={{ fontSize: 16, color: T.ink }}>mafana'ay</div>
          <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic', marginTop: 2 }}>happy / well</div>
        </Card>
        <Card raised pad={14} accent={T.crimson}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>card · accent</div>
          <div className="serif" style={{ fontSize: 16, color: T.ink }}>O ngangan ako…</div>
          <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic', marginTop: 2 }}>My name is…</div>
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <Input value="cidal" onChange={() => {}} icon="search" iconR="mic" />
        <Input value="" onChange={() => {}} placeholder="Empty input…" icon="pen" />
      </div>
    </DSRow>

    <DSRow label="Language avatars">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <LangAvatar letter="A" color={T.crimson} size={44} />
        <LangAvatar letter="T" color={T.terra} size={44} />
        <LangAvatar letter="B" color={T.amber} size={44} />
        <LangAvatar letter="P" color={T.sage} size={44} />
        <LangAvatar letter="P" color={T.crimsonDp} size={44} />
        <LangAvatar letter="K" color={T.sageDp} size={44} />
        <LangAvatar letter="T" color="#8C6515" size={44} />
        <LangAvatar letter="R" color="#8E4516" size={44} />
      </div>
    </DSRow>

    {/* States */}
    <DSRow label="States">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* Empty */}
        <Card pad={20} style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>empty</div>
          <div style={{
            width: 56, height: 56, borderRadius: 999, background: T.cream,
            border: `1px dashed ${T.line}`, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkMute,
          }}>
            <Icon name="leaf" size={26} strokeWidth={1.6} />
          </div>
          <div className="serif" style={{ fontSize: 16, color: T.ink, fontWeight: 500 }}>Nothing saved yet</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>Capture your first word to begin.</div>
        </Card>

        {/* Loading */}
        <Card pad={20}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>loading</div>
          {[1, 0.85, 0.6].map((w, i) => (
            <div key={i} style={{
              height: 12, marginBottom: 8, borderRadius: 6,
              background: `linear-gradient(90deg, ${T.lineSoft}, ${T.paper}, ${T.lineSoft})`,
              backgroundSize: '200% 100%',
              animation: 'iv-shimmer 1.4s ease infinite',
              width: `${w * 100}%`,
            }} />
          ))}
          <style>{`@keyframes iv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </Card>

        {/* Disabled translate */}
        <Card pad={20}>
          <div className="mono" style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>unsupported pair</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip tone="ink" active>Amis</Chip>
            <span style={{ color: T.inkFaint, alignSelf: 'center' }}>→</span>
            <button disabled style={{
              padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              background: T.paper, color: T.inkFaint, border: `1px solid ${T.lineSoft}`,
              textDecoration: 'line-through', cursor: 'not-allowed',
            }}>Paiwan · soon</button>
            <button disabled style={{
              padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              background: T.paper, color: T.inkFaint, border: `1px solid ${T.lineSoft}`,
              textDecoration: 'line-through', cursor: 'not-allowed',
            }}>Bunun · soon</button>
          </div>
        </Card>
      </div>
    </DSRow>
  </div>
);

window.DesignSystemBoard = DesignSystemBoard;

})();
