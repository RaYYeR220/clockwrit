'use client'

import {useSyncExternalStore} from 'react'
import {browserOffset} from '@/lib/format'
import styles from './drift.module.css'

type Probe = {zone: string; at: string; expected: number}

const subscribe = () => () => {}

/** A zone the browser cannot read at all counts as wrong. */
function countWrong(zones: Probe[]): number {
  let n = 0
  for (const z of zones) {
    try {
      if (browserOffset(z.zone, new Date(z.at)) !== z.expected) n++
    } catch {
      n++
    }
  }
  return n
}

/** How many of the drifting zones this visitor's browser also gets wrong. */
export function BrowserScore({zones}: {zones: Probe[]}) {
  const wrong = useSyncExternalStore(
    subscribe,
    () => countWrong(zones),
    () => null,
  )
  return (
    <p className={styles.score} aria-live="polite">
      {wrong === null ? (
        'Reading your browser’s clock…'
      ) : wrong === 0 ? (
        <>Your browser gets all {zones.length} right.</>
      ) : (
        <>
          Your browser gets <b>{wrong}</b> of {zones.length} wrong.
        </>
      )}
    </p>
  )
}
