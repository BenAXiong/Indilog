import type { CSSProperties, ReactNode } from 'react'

export type IconName =
  | 'home' | 'learn' | 'review' | 'capture' | 'dict' | 'translate'
  | 'search' | 'mic' | 'flame' | 'check' | 'plus' | 'arrow-r' | 'arrow-l'
  | 'chevron' | 'chev-d' | 'close' | 'x' | 'speaker' | 'copy' | 'swap'
  | 'bookmark' | 'bookmarkF' | 'pin' | 'settings' | 'user' | 'pen'
  | 'sparkle' | 'tree' | 'leaf' | 'mountain' | 'wave' | 'filter'
  | 'play' | 'stop' | 'card' | 'note' | 'word' | 'logout' | 'library'
  | 'layers' | 'globe' | 'archive' | 'share' | 'download' | 'trash' | 'tag' | 'more-v'
  | 'rotate-ccw' | 'rotate-cw' | 'skip-fwd' | 'pause'
  | 'square'
  | 'flag' | 'flagF'
  | 'info'
  | 'film'
  | 'gloss'
  | 'bar-chart'

type IconProps = {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}

type SVGProps = {
  width: number; height: number; viewBox: string; fill: string
  stroke: string; strokeWidth: number
  strokeLinecap: 'round'; strokeLinejoin: 'round'
  style?: CSSProperties; className?: string
}

function S(p: SVGProps, children: ReactNode) {
  return <svg {...p}>{children}</svg>
}

const ICONS: Record<IconName, (p: SVGProps) => ReactNode> = {
  'home':      p => S(p, <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9z"/>),
  'learn':     p => S(p, <><path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 4v12a4 4 0 004 4h12"/></>),
  'review':    p => S(p, <><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></>),
  'capture':   p => S(p, <path d="M12 5v14M5 12h14"/>),
  'dict':      p => S(p, <><path d="M4 4h11a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M8 8h7M8 12h5"/></>),
  'translate': p => S(p, <><path d="M3 5h10M8 3v2M5 5c0 4 4 7 8 8M11 13c-1 2-3 5-7 6"/><path d="M14 20l4-9 4 9M15.5 17h5"/></>),
  'search':    p => S(p, <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>),
  'mic':       p => S(p, <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></>),
  'flame':     p => S(p, <path d="M12 3c1 3 4 5 4 9a4 4 0 11-8 0c0-2 1-3 1-5 0 2 2 3 3 0z"/>),
  'check':     p => S(p, <path d="M5 12l4 4 10-10"/>),
  'plus':      p => S(p, <path d="M12 5v14M5 12h14"/>),
  'arrow-r':   p => S(p, <path d="M5 12h14M13 6l6 6-6 6"/>),
  'arrow-l':   p => S(p, <path d="M19 12H5M11 18l-6-6 6-6"/>),
  'chevron':   p => S(p, <path d="M9 6l6 6-6 6"/>),
  'chev-d':    p => S(p, <path d="M6 9l6 6 6-6"/>),
  'close':     p => S(p, <path d="M6 6l12 12M18 6L6 18"/>),
  'x':         p => S(p, <path d="M18 6L6 18M6 6l12 12"/>),
  'speaker':   p => S(p, <><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8M18.5 5a9 9 0 010 14"/></>),
  'copy':      p => S(p, <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></>),
  'swap':      p => S(p, <path d="M7 4v14M4 7l3-3 3 3M17 20V6M20 17l-3 3-3-3"/>),
  'bookmark':  p => S(p, <path d="M6 3h12v18l-6-4-6 4V3z"/>),
  'bookmarkF': p => S({ ...p, fill: p.stroke }, <path d="M6 3h12v18l-6-4-6 4V3z"/>),
  'pin':       p => S(p, <path d="M12 2l3 6 6 1-4.5 4 1 6L12 16l-5.5 3 1-6L3 9l6-1 3-6z"/>),
  'settings':  p => S(p, <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  'user':      p => S(p, <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-7 8-7s7 3 8 7"/></>),
  'pen':       p => S(p, <path d="M14 4l6 6L8 22H2v-6L14 4z"/>),
  'sparkle':   p => S(p, <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/>),
  'tree':      p => S(p, <path d="M12 22v-7M8 15c-3 0-5-2-5-5s2-4 4-4c0-2 2-4 5-4s5 2 5 4c2 0 4 2 4 4s-2 5-5 5H8z"/>),
  'leaf':      p => S(p, <><path d="M4 20c0-9 7-16 16-16 0 9-7 16-16 16z"/><path d="M4 20c4-4 8-8 16-16"/></>),
  'mountain':  p => S(p, <path d="M3 20l6-10 4 6 3-4 5 8H3z"/>),
  'wave':      p => S(p, <path d="M3 12c3-3 6-3 9 0s6 3 9 0M3 18c3-3 6-3 9 0s6 3 9 0M3 6c3-3 6-3 9 0s6 3 9 0"/>),
  'filter':    p => S(p, <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/>),
  'play':      p => S({ ...p, fill: p.stroke }, <path d="M7 4v16l13-8L7 4z"/>),
  'stop':      p => S({ ...p, fill: p.stroke }, <rect x="5" y="5" width="14" height="14" rx="2"/>),
  'trash':     p => S(p, <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></>),
  'card':      p => S(p, <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></>),
  'note':      p => S(p, <><path d="M5 3h11l4 4v14H5V3z"/><path d="M8 12h8M8 16h5"/></>),
  'word':      p => S(p, <path d="M4 6h16M4 12h10M4 18h16"/>),
  'logout':    p => S(p, <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 8l-4 4 4 4M6 12h11"/>),
  'library':   p => S(p, <path d="M4 4v16M8 4v16M14 4l4 16M2 20h20"/>),
  'layers':    p => S(p, <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/></>),
  'globe':     p => S(p, <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></>),
  'archive':   p => S(p, <><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 13h4"/></>),
  'share':     p => S(p, <path d="M12 3v13M8 7l4-4 4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5"/>),
  'download':  p => S(p, <><path d="M12 3v13M8 12l4 4 4-4"/><path d="M5 20h14"/></>),
  'tag':       p => S(p, <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><path d="M7 7h.01"/></>),
  'more-v':    p => S(p, <path d="M12 5h.01M12 12h.01M12 19h.01"/>),
  'rotate-ccw': p => S(p, <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 101.85-5.53"/></>),
  'rotate-cw':  p => S(p, <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-1.85-5.53"/></>),
  'bar-chart':  p => S(p, <><path d="M5 20V10M9 20V4M13 20v-8M17 20v-6"/><path d="M3 20h18"/></>),
  'skip-fwd':   p => S(p, <><path d="M5 6l6 6-6 6M13 6l6 6-6 6"/><path d="M21 6v12"/></>),
  'pause':      p => S(p, <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>),
  'square':     p => S(p, <rect x="4" y="4" width="16" height="16" rx="2"/>),
  'flag':       p => S(p, <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>),
  'flagF':      p => S({ ...p, fill: p.stroke }, <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>),
  'info':       p => S(p, <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>),
  'film':       p => S(p, <><rect x="2" y="7" width="13" height="10" rx="2"/><path d="M15 10l5-3v10l-5-3V10z"/></>),
  'gloss':      p => S(p, <><path d="M3 7h18M3 12h18"/><path d="M3 17h11"/><line x1="16" y1="16" x2="16" y2="20"/><line x1="14" y1="18" x2="18" y2="18"/></>),
}

export default function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.6, style, className }: IconProps) {
  const p: SVGProps = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', style, className }
  return (ICONS[name]?.(p) ?? null) as React.ReactElement | null
}
