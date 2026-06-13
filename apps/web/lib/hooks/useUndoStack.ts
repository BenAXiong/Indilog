'use client'

import { useRef, useState } from 'react'

export function useUndoStack<T>() {
  const stackRef = useRef<T[]>([])
  const [count, setCount] = useState(0)

  function push(entry: T) {
    stackRef.current.push(entry)
    setCount(n => n + 1)
  }

  function pop(): T | undefined {
    const e = stackRef.current.pop()
    setCount(n => Math.max(0, n - 1))
    return e
  }

  return { push, pop, count }
}
