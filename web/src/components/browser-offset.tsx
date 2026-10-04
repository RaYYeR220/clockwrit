'use client'

import {useSyncExternalStore} from 'react'
import {browserOffset, fmtOffset} from '@/lib/format'

const noSubscribe = () => () => {}

/** This visitor's browser reading for a zone at an instant, graded against the legal offset. Rendered only on the client. */
export function BrowserOffset({zone, at, law, className}: {zone: string; at: string; law: number; className?: string}) {
  const value = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return browserOffset(zone, new Date(at))
      } catch {
        return null
      }
    },
    () => null,
  )
  if (value === null) return <span className={className}>…</span>
  return (
    <span className={className} data-wrong={value !== law || undefined}>
      {value === law ? fmtOffset(value) : <s>{fmtOffset(value)}</s>}
    </span>
  )
}
