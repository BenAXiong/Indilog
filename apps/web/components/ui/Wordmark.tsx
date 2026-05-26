import Image from 'next/image'
import { T } from '@/lib/tokens'

type WordmarkProps = {
  size?: number
  color?: string
}

export default function Wordmark({ size = 22, color = T.ink }: WordmarkProps) {
  const iconSize = Math.round(size * 1.5)

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
      <Image
        src="/icon.png"
        alt=""
        width={iconSize}
        height={iconSize}
        style={{ flexShrink: 0 }}
        priority
      />
      Indilog
    </span>
  )
}
