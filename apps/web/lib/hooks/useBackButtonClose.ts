'use client'

import { useEffect, useRef } from 'react'

// Full-screen sheets/modals in this app open via plain state, not a route
// change, so by default the phone's back button doesn't know about them —
// it just does normal back navigation past whatever's open, skipping the
// sheet entirely. Push a marker history entry while open and close on
// popstate instead, so back behaves like a native sheet.
//
// `open` — pass the real open/closed boolean if the sheet has one; if the
// component itself is only ever mounted while visible (no separate open
// prop), pass `true` unconditionally — the effect below then runs for
// exactly the component's mounted lifetime, which is equivalent.
//
// Returns `requestClose`: route every one of the sheet's own close triggers
// (backdrop, X button, "save and close", Escape, etc.) through this instead
// of calling `onClose` directly, so the pushed entry gets consumed either
// way — otherwise back needs pressing twice: once for a leftover inert
// entry, once to actually leave.
export function useBackButtonClose(open: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    history.pushState({ sheetOpen: true }, '')
    function onPopState() { onCloseRef.current() }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [open])

  return function requestClose() {
    if (open) history.back()
  }
}
