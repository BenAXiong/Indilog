import { T } from '@/lib/tokens'

type WordmarkProps = {
  size?: number
  color?: string
}

export default function Wordmark({ size = 22, color = T.ink }: WordmarkProps) {
  const sphereSize = size * 0.78
  const stemHeight = size * 0.3

  return (
    <span style={{
      fontFamily: 'Newsreader, Georgia, serif',
      fontWeight: 500,
      fontSize: size,
      color,
      letterSpacing: '-0.025em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
    }}>
      <span style={{
        width: sphereSize,
        height: sphereSize,
        borderRadius: '40% 40% 50% 50% / 50% 50% 40% 40%',
        background: `radial-gradient(circle at 35% 30%, ${T.terra}, ${T.crimson} 50%, ${T.crimsonDp})`,
        display: 'inline-block',
        flexShrink: 0,
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          bottom: -2,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 2,
          height: stemHeight,
          background: T.sageDp,
          borderRadius: 2,
        }} />
      </span>
      Indivore
    </span>
  )
}
