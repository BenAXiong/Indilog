'use client'

import { useRef } from 'react'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url)
    audioRef.current = a
    a.play().catch(() => {})
  }

  function pauseAudio() {
    audioRef.current?.pause()
  }

  return { playAudio, pauseAudio, audioRef }
}
