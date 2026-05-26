import type { CSSProperties } from 'react'

type IconName =
  | 'home' | 'learn' | 'review' | 'capture' | 'dict' | 'translate'
  | 'search' | 'mic' | 'flame' | 'check' | 'plus' | 'arrow-r' | 'arrow-l'
  | 'chevron' | 'chev-d' | 'close' | 'speaker' | 'copy' | 'swap'
  | 'bookmark' | 'bookmarkF' | 'pin' | 'settings' | 'user' | 'pen'
  | 'sparkle' | 'tree' | 'leaf' | 'mountain' | 'wave' | 'filter'
  | 'play' | 'card' | 'note' | 'word' | 'logout' | 'library'
  | 'layers' | 'globe' | 'archive' | 'share' | 'x'

type IconProps = {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}

export default function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.6, style, className }: IconProps) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style, className }

  switch (name) {
    case 'home':      return <svg {...p}><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9z"/></svg>
    case 'learn':     return <svg {...p}><path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 4v12a4 4 0 004 4h12"/></svg>
    case 'review':    return <svg {...p}><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg>
    case 'capture':   return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
    case 'dict':      return <svg {...p}><path d="M4 4h11a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M8 8h7M8 12h5"/></svg>
    case 'translate': return <svg {...p}><path d="M3 5h10M8 3v2M5 5c0 4 4 7 8 8M11 13c-1 2-3 5-7 6"/><path d="M14 20l4-9 4 9M15.5 17h5"/></svg>
    case 'search':    return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    case 'mic':       return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
    case 'flame':     return <svg {...p}><path d="M12 3c1 3 4 5 4 9a4 4 0 11-8 0c0-2 1-3 1-5 0 2 2 3 3 0z"/></svg>
    case 'check':     return <svg {...p}><path d="M5 12l4 4 10-10"/></svg>
    case 'plus':      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
    case 'arrow-r':   return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    case 'arrow-l':   return <svg {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
    case 'chevron':   return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>
    case 'chev-d':    return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>
    case 'close':     return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>
    case 'speaker':   return <svg {...p}><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8M18.5 5a9 9 0 010 14"/></svg>
    case 'copy':      return <svg {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>
    case 'swap':      return <svg {...p}><path d="M7 4v14M4 7l3-3 3 3M17 20V6M20 17l-3 3-3-3"/></svg>
    case 'bookmark':  return <svg {...p}><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>
    case 'bookmarkF': return <svg {...p} fill={color}><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>
    case 'pin':       return <svg {...p}><path d="M12 2l3 6 6 1-4.5 4 1 6L12 16l-5.5 3 1-6L3 9l6-1 3-6z"/></svg>
    case 'settings':  return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>
    case 'user':      return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-7 8-7s7 3 8 7"/></svg>
    case 'pen':       return <svg {...p}><path d="M14 4l6 6L8 22H2v-6L14 4z"/></svg>
    case 'sparkle':   return <svg {...p}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/></svg>
    case 'tree':      return <svg {...p}><path d="M12 22v-7M8 15c-3 0-5-2-5-5s2-4 4-4c0-2 2-4 5-4s5 2 5 4c2 0 4 2 4 4s-2 5-5 5H8z"/></svg>
    case 'leaf':      return <svg {...p}><path d="M4 20c0-9 7-16 16-16 0 9-7 16-16 16z"/><path d="M4 20c4-4 8-8 16-16"/></svg>
    case 'mountain':  return <svg {...p}><path d="M3 20l6-10 4 6 3-4 5 8H3z"/></svg>
    case 'wave':      return <svg {...p}><path d="M3 12c3-3 6-3 9 0s6 3 9 0M3 18c3-3 6-3 9 0s6 3 9 0M3 6c3-3 6-3 9 0s6 3 9 0"/></svg>
    case 'filter':    return <svg {...p}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></svg>
    case 'play':      return <svg {...p} fill={color}><path d="M7 4v16l13-8L7 4z"/></svg>
    case 'card':      return <svg {...p}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>
    case 'note':      return <svg {...p}><path d="M5 3h11l4 4v14H5V3z"/><path d="M8 12h8M8 16h5"/></svg>
    case 'word':      return <svg {...p}><path d="M4 6h16M4 12h10M4 18h16"/></svg>
    case 'logout':    return <svg {...p}><path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 8l-4 4 4 4M6 12h11"/></svg>
    case 'library':   return <svg {...p}><path d="M4 4v16M8 4v16M14 4l4 16M2 20h20"/></svg>
    case 'layers':    return <svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/></svg>
    case 'globe':     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
    case 'archive':   return <svg {...p}><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 13h4"/></svg>
    case 'share':     return <svg {...p}><path d="M12 3v13M8 7l4-4 4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5"/></svg>
    case 'x':         return <svg {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>
    default:          return null
  }
}
