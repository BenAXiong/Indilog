'use client'
import { useEffect } from 'react'
import { localDateStr } from '@/lib/db/srs/flashcards'

// Sets srs_study_date cookie so server-side dashboard reads learnedToday
// from the same date the client writes increment_learned_today to.
export default function StudyDateSync() {
  useEffect(() => {
    const resetHour = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
    const now = new Date()
    let date: Date
    if (now.getHours() < resetHour) {
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    } else {
      date = now
    }
    document.cookie = `srs_study_date=${localDateStr(date)}; path=/; max-age=7200`
  }, [])
  return null
}
