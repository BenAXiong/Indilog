'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Calls router.refresh() whenever the browser restores this page from the
// back-forward cache (bfcache). Without this, server components show stale
// data after the user presses Back from a review/learn session.
export default function BfcacheRefresh() {
  const router = useRouter()
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) router.refresh()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [router])
  return null
}
