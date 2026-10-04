'use client'

import {useEffect, useState} from 'react'
import {browserOffset, fmtOffset} from '@/lib/format'

/** This visitor's browser reading for a zone at an instant, graded against the legal offset. */
export function BrowserOffset({zone, at, law, className}: {zone: string; at: string; law: number; className?: string}) {
  const [value, setValue] = useState<number | null>(null)
  useEffect(() => {
    try {
      setValue(browserOffset(zone, new Date(at)))
    } catch {
      setValue(null)
    }
  }, [zone, at])
  if (value === null) return <span className={className}>…</span>
  return (
    <span className={className} data-wrong={value !== law || undefined}>
      {value === law ? fmtOffset(value) : <s>{fmtOffset(value)}</s>}
    </span>
  )
}
