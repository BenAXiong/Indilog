(()=>{
// Indivore — shared UI components
// Card, Chip, Button, Input, Icons, BottomNav, Sheet, Toast

const T = window.TOKENS;

// ─────────────────────────────────────────────────────────────
// Icon — line icons (24px)
// ─────────────────────────────────────────────────────────────
const Icon = ({ name, size = 22, color = 'currentColor', strokeWidth = 1.6, style }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'home':     return <svg {...props}><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9z"/></svg>;
    case 'learn':    return <svg {...props}><path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 4v12a4 4 0 004 4h12"/></svg>;
    case 'review':   return <svg {...props}><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg>;
    case 'capture':  return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'dict':     return <svg {...props}><path d="M4 4h11a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M8 8h7M8 12h5"/></svg>;
    case 'translate':return <svg {...props}><path d="M3 5h10M8 3v2M5 5c0 4 4 7 8 8M11 13c-1 2-3 5-7 6"/><path d="M14 20l4-9 4 9M15.5 17h5"/></svg>;
    case 'search':   return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
    case 'mic':      return <svg {...props}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>;
    case 'flame':    return <svg {...props}><path d="M12 3c1 3 4 5 4 9a4 4 0 11-8 0c0-2 1-3 1-5 0 2 2 3 3 0z"/></svg>;
    case 'check':    return <svg {...props}><path d="M5 12l4 4 10-10"/></svg>;
    case 'plus':     return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'arrow-r':  return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-l':  return <svg {...props}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'chevron':  return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chev-d':   return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'close':    return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'speaker':  return <svg {...props}><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8M18.5 5a9 9 0 010 14"/></svg>;
    case 'copy':     return <svg {...props}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>;
    case 'swap':     return <svg {...props}><path d="M7 4v14M4 7l3-3 3 3M17 20V6M20 17l-3 3-3-3"/></svg>;
    case 'bookmark': return <svg {...props}><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>;
    case 'bookmarkF':return <svg {...props} fill={color}><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>;
    case 'pin':      return <svg {...props}><path d="M12 2l3 6 6 1-4.5 4 1 6L12 16l-5.5 3 1-6L3 9l6-1 3-6z"/></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case 'user':     return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-7 8-7s7 3 8 7"/></svg>;
    case 'pen':      return <svg {...props}><path d="M14 4l6 6L8 22H2v-6L14 4z"/></svg>;
    case 'sparkle':  return <svg {...props}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/></svg>;
    case 'tree':     return <svg {...props}><path d="M12 22v-7M8 15c-3 0-5-2-5-5s2-4 4-4c0-2 2-4 5-4s5 2 5 4c2 0 4 2 4 4s-2 5-5 5H8z"/></svg>;
    case 'leaf':     return <svg {...props}><path d="M4 20c0-9 7-16 16-16 0 9-7 16-16 16z"/><path d="M4 20c4-4 8-8 16-16"/></svg>;
    case 'mountain': return <svg {...props}><path d="M3 20l6-10 4 6 3-4 5 8H3z"/></svg>;
    case 'wave':     return <svg {...props}><path d="M3 12c3-3 6-3 9 0s6 3 9 0M3 18c3-3 6-3 9 0s6 3 9 0M3 6c3-3 6-3 9 0s6 3 9 0"/></svg>;
    case 'filter':   return <svg {...props}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></svg>;
    case 'play':     return <svg {...props} fill={color}><path d="M7 4v16l13-8L7 4z"/></svg>;
    case 'card':     return <svg {...props}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>;
    case 'note':     return <svg {...props}><path d="M5 3h11l4 4v14H5V3z"/><path d="M8 12h8M8 16h5"/></svg>;
    case 'word':     return <svg {...props}><path d="M4 6h16M4 12h10M4 18h16"/></svg>;
    case 'logout':   return <svg {...props}><path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 8l-4 4 4 4M6 12h11"/></svg>;
    default: return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Chip — language, dialect, filter
// ─────────────────────────────────────────────────────────────
const Chip = ({ children, tone = 'default', size = 'md', icon, onClick, active, style }) => {
  const tones = {
    default:   { bg: T.paperHi, color: T.ink,        border: T.line },
    crimson:   { bg: T.crimsonBg, color: T.crimsonDp, border: '#EFCAB8' },
    sage:      { bg: T.sageBg,    color: T.sageDp,    border: '#D2D8AE' },
    amber:     { bg: T.amberBg,   color: '#8C6515',   border: '#EBD49A' },
    terra:     { bg: T.terraBg,   color: '#8E4516',   border: '#EFCAA8' },
    ghost:     { bg: 'transparent', color: T.inkSoft, border: T.line },
    ink:       { bg: T.ink, color: T.cream, border: T.ink },
  };
  const tn = tones[tone] || tones.default;
  const sizes = {
    sm: { padding: '3px 9px', font: 12, h: 22, gap: 4, radius: 999 },
    md: { padding: '5px 11px', font: 13, h: 28, gap: 5, radius: 999 },
    lg: { padding: '7px 14px', font: 14, h: 34, gap: 6, radius: 999 },
  };
  const sz = sizes[size];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: sz.gap,
      padding: sz.padding, height: sz.h, borderRadius: sz.radius,
      background: active ? T.ink : tn.bg, color: active ? T.cream : tn.color,
      border: `1px solid ${active ? T.ink : tn.border}`,
      fontFamily: T.fSans, fontSize: sz.font, fontWeight: 500,
      letterSpacing: '-0.005em', lineHeight: 1, whiteSpace: 'nowrap',
      transition: 'all .15s', cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {icon && <Icon name={icon} size={sz.font + 2} color="currentColor" strokeWidth={1.8} />}
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// Card — rounded surface with soft warm shadow
// ─────────────────────────────────────────────────────────────
const Card = ({ children, style, onClick, raised = false, accent, pad = 16 }) => {
  return (
    <div onClick={onClick} style={{
      background: T.paperHi, borderRadius: 18, padding: pad,
      border: `1px solid ${T.lineSoft}`,
      boxShadow: raised
        ? '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04), 0 4px 18px rgba(80,40,20,0.06)'
        : '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(80,40,20,0.03)',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative',
      ...style,
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 16, right: 16, height: 2,
          background: accent, borderRadius: '0 0 4px 4px', opacity: 0.85,
        }} />
      )}
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────
const Button = ({ children, variant = 'primary', size = 'md', icon, iconR, onClick, full, disabled, style }) => {
  const variants = {
    primary:   { bg: T.crimson, color: '#fff', border: T.crimson, hover: T.crimsonDp,
                 shadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(120,30,15,0.2), 0 6px 14px rgba(120,30,15,0.18)' },
    secondary: { bg: T.paperHi, color: T.ink, border: T.line, hover: T.paper,
                 shadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(80,40,20,0.04)' },
    ghost:     { bg: 'transparent', color: T.inkSoft, border: 'transparent', hover: T.paper, shadow: 'none' },
    sage:      { bg: T.sage, color: '#fff', border: T.sage, hover: T.sageDp,
                 shadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(60,80,30,0.2), 0 6px 14px rgba(60,80,30,0.18)' },
    amber:     { bg: T.amber, color: '#3a2e0e', border: T.amber, hover: '#C18D1F',
                 shadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 1px 2px rgba(140,100,20,0.2), 0 6px 14px rgba(140,100,20,0.15)' },
    danger:    { bg: T.crimson, color: '#fff', border: T.crimson, hover: T.crimsonDp, shadow: 'none' },
  };
  const v = variants[variant];
  const sizes = {
    sm: { h: 32, px: 12, fz: 13, gap: 6, r: 10, isz: 15 },
    md: { h: 42, px: 16, fz: 14, gap: 8, r: 12, isz: 17 },
    lg: { h: 52, px: 20, fz: 16, gap: 10, r: 14, isz: 19 },
  };
  const s = sizes[size];
  return (
    <button onClick={!disabled ? onClick : undefined} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        fontFamily: T.fSans, fontSize: s.fz, fontWeight: 600, letterSpacing: '-0.005em',
        boxShadow: disabled ? 'none' : v.shadow,
        width: full ? '100%' : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s, transform .08s',
        ...style,
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
    >
      {icon && <Icon name={icon} size={s.isz} strokeWidth={2} />}
      {children}
      {iconR && <Icon name={iconR} size={s.isz} strokeWidth={2} />}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────
const Input = ({ value, onChange, placeholder, icon, iconR, multiline, rows = 3, style, big, mono }) => {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div style={{
      display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 10,
      background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 14,
      padding: multiline ? '12px 14px' : '0 14px',
      height: multiline ? 'auto' : (big ? 52 : 44),
      transition: 'border-color .15s, box-shadow .15s',
      ...style,
    }}
      onFocus={(e) => { e.currentTarget.style.borderColor = T.crimson; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.crimsonBg}`; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.boxShadow = ''; }}
    >
      {icon && <Icon name={icon} size={18} color={T.inkMute} />}
      <Tag value={value} onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        style={{
          flex: 1, border: 0, background: 'transparent',
          fontFamily: mono ? T.fMono : T.fSans,
          fontSize: big ? 18 : 15, fontWeight: 400,
          color: T.ink, padding: 0, resize: 'none', minWidth: 0,
        }}
      />
      {iconR && <Icon name={iconR} size={18} color={T.inkMute} />}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Section header — small uppercase + optional action
// ─────────────────────────────────────────────────────────────
const SectionHead = ({ title, action, onAction, style }) => (
  <div style={{
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    padding: '0 4px', marginBottom: 10, ...style,
  }}>
    <div style={{
      fontFamily: T.fMono, fontSize: 11, fontWeight: 500, color: T.inkMute,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>{title}</div>
    {action && (
      <button onClick={onAction} style={{
        fontFamily: T.fSans, fontSize: 13, fontWeight: 500, color: T.crimson,
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>{action} <Icon name="chevron" size={14} strokeWidth={2.2} /></button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Bottom navigation — 5 tabs, center is raised capture FAB
// ─────────────────────────────────────────────────────────────
const BottomNav = ({ tab, onTab, style }) => {
  const items = [
    { id: 'learn',     label: 'Learn',     icon: 'learn' },
    { id: 'review',    label: 'Review',    icon: 'review' },
    { id: 'capture',   label: 'Capture',   icon: 'capture', center: true },
    { id: 'dict',      label: 'Dictionary', icon: 'dict' },
    { id: 'translate', label: 'Translate', icon: 'translate' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 28, paddingTop: 8,
      background: `linear-gradient(to top, ${T.cream} 70%, rgba(245,238,223,0))`,
      zIndex: 30, ...style,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
        padding: '0 12px', height: 60, position: 'relative',
      }}>
        {items.map((it) => {
          if (it.center) {
            const active = tab === it.id;
            return (
              <button key={it.id} onClick={() => onTab(it.id)} style={{
                width: 60, height: 60, borderRadius: 999,
                background: active ? T.crimsonDp : T.crimson,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 4px rgba(120,30,15,0.25), 0 10px 24px rgba(120,30,15,0.28)',
                transform: 'translateY(-18px)',
                transition: 'all .2s',
                border: `3px solid ${T.cream}`,
              }}>
                <Icon name="capture" size={26} strokeWidth={2.4} />
              </button>
            );
          }
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => onTab(it.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 8px',
              color: active ? T.crimson : T.inkMute,
              transition: 'color .15s',
            }}>
              <Icon name={it.icon} size={22} strokeWidth={active ? 2 : 1.6} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500, letterSpacing: '-0.005em' }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Status bar — Indivore-styled (replaces iOS one for theme cohesion)
// ─────────────────────────────────────────────────────────────
const IvStatusBar = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 28px 8px', fontFamily: T.fSans,
    fontSize: 14, fontWeight: 600, color: T.ink,
    position: 'relative', zIndex: 20,
  }}>
    <div>9:41</div>
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <rect x="0" y="7" width="3" height="4" rx="0.5" fill={T.ink}/>
        <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill={T.ink}/>
        <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill={T.ink}/>
        <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill={T.ink} opacity="0.4"/>
      </svg>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <path d="M7 3a5 5 0 014 1.7l1-1A6.5 6.5 0 007 2 6.5 6.5 0 002 3.7l1 1A5 5 0 017 3z" fill={T.ink}/>
        <path d="M7 5.6c1 0 2 .4 2.6 1.1l.9-.9A4.5 4.5 0 007 4.4c-1.4 0-2.7.5-3.6 1.3l1 1A4 4 0 017 5.6z" fill={T.ink}/>
        <circle cx="7" cy="8.4" r="1.3" fill={T.ink}/>
      </svg>
      <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
        <rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={T.ink} strokeOpacity="0.4" fill="none"/>
        <rect x="2" y="2" width="14" height="7" rx="1.5" fill={T.ink}/>
        <path d="M22.5 4v3c.7-.2 1.2-.9 1.2-1.5S23.2 4.2 22.5 4z" fill={T.ink} opacity="0.6"/>
      </svg>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Toast — bottom slide-up confirmation
// ─────────────────────────────────────────────────────────────
const Toast = ({ children, icon = 'check', tone = 'sage' }) => (
  <div className="iv-toast" style={{
    position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: 9,
    background: T.ink, color: T.cream, padding: '11px 18px 11px 14px',
    borderRadius: 999, fontSize: 13.5, fontWeight: 500,
    boxShadow: '0 12px 32px rgba(40,30,20,0.25)', zIndex: 40,
    fontFamily: T.fSans, whiteSpace: 'nowrap',
  }}>
    <div style={{
      width: 22, height: 22, borderRadius: 999,
      background: tone === 'sage' ? T.sage : T.amber,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={14} color="#fff" strokeWidth={2.6} />
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────
// LangAvatar — circular token for active language
// ─────────────────────────────────────────────────────────────
const LangAvatar = ({ letter = 'A', size = 36, color = T.crimson }) => (
  <div style={{
    width: size, height: size, borderRadius: 999, flexShrink: 0,
    background: color, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: T.fSerif, fontWeight: 600, fontSize: size * 0.46,
    boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 3px rgba(0,0,0,0.1)',
    letterSpacing: '-0.02em',
  }}>{letter}</div>
);

// ─────────────────────────────────────────────────────────────
// Stat — number + label tile
// ─────────────────────────────────────────────────────────────
const Stat = ({ value, label, suffix, icon, accent }) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
    padding: '12px 14px', background: T.paperHi, borderRadius: 14,
    border: `1px solid ${T.lineSoft}`, position: 'relative',
  }}>
    {icon && (
      <div style={{ position: 'absolute', top: 12, right: 12, color: accent || T.inkFaint }}>
        <Icon name={icon} size={14} strokeWidth={1.8} />
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span style={{ fontFamily: T.fSerif, fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
      {suffix && <span style={{ fontFamily: T.fSans, fontSize: 11, color: T.inkMute, fontWeight: 500 }}>{suffix}</span>}
    </div>
    <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 500, letterSpacing: '-0.005em' }}>{label}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Indivore wordmark (header)
// ─────────────────────────────────────────────────────────────
const Wordmark = ({ size = 22, color = T.ink }) => (
  <span style={{
    fontFamily: T.fSerif, fontWeight: 500, fontSize: size, color,
    letterSpacing: '-0.025em', display: 'inline-flex', alignItems: 'center', gap: 7,
  }}>
    <span style={{
      width: size * 0.78, height: size * 0.78, borderRadius: '40% 40% 50% 50% / 50% 50% 40% 40%',
      background: `radial-gradient(circle at 35% 30%, ${T.terra}, ${T.crimson} 50%, ${T.crimsonDp})`,
      display: 'inline-block', flexShrink: 0, position: 'relative',
    }}>
      <span style={{
        position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
        width: 2, height: size * 0.3, background: T.sageDp, borderRadius: 2,
      }} />
    </span>
    Indivore
  </span>
);

Object.assign(window, { Icon, Chip, Card, Button, Input, SectionHead, BottomNav, IvStatusBar, Toast, LangAvatar, Stat, Wordmark });

})();
