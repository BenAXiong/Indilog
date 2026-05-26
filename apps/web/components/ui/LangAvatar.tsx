import { T } from '@/lib/tokens'

type LangAvatarProps = {
  letter?: string
  size?: number
  color?: string
}

export default function LangAvatar({ letter = 'A', size = 36, color = T.crimson }: LangAvatarProps) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      flexShrink: 0,
      background: color,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Newsreader, Georgia, serif',
      fontWeight: 600,
      fontSize: size * 0.46,
      boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 3px rgba(0,0,0,0.1)',
      letterSpacing: '-0.02em',
    }}>
      {letter}
    </div>
  )
}
