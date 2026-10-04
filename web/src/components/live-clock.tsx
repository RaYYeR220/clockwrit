'use client'

import {useEffect, useState} from 'react'
import {browserOffset, fmtOffset} from '@/lib/format'
import styles from './live-clock.module.css'

export interface CityClock {
  zone: string
  city: string
  /** Legal offset now, minutes. */
  now: number
  /** First instant (UTC) at which a stale runtime and the law disagree. */
  from: string
  /** Legal offset after `from`, minutes. */
  after: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export function LiveClock({cities}: {cities: CityClock[]}) {
  const [i, setI] = useState(0)
  const [now, setNow] = useState<number | null>(null)
  const [stale, setStale] = useState<number | null>(null)
  const c = cities[i]!

  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    setStale(browserOffset(c.zone, new Date(Date.parse(c.from) + 86_400_000)))
  }, [c])

  const t = now === null ? null : new Date(now + c.now * 60_000)
  return (
    <div className={styles.root}>
      <p className="kicker">
        {c.city} · legal time now · {fmtOffset(c.now)}
      </p>
      <p className={styles.clock} aria-live="off">
        {t ? (
          <>
            {pad(t.getUTCHours())}:{pad(t.getUTCMinutes())}
            <span className={styles.sec}>:{pad(t.getUTCSeconds())}</span>
          </>
        ) : (
          <>
            --:--<span className={styles.sec}>:--</span>
          </>
        )}
      </p>
      <div className={styles.cities} role="group" aria-label="City">
        {cities.map((x, k) => (
          <button key={x.zone} aria-pressed={k === i} onClick={() => setI(k)}>
            {x.city}
          </button>
        ))}
      </div>
      <p className={styles.stale}>
        {stale === null ? (
          ' '
        ) : stale === c.after ? (
          <>
            From {c.from.slice(0, 10)} your browser agrees with the law: {fmtOffset(stale)}.
          </>
        ) : (
          <>
            From {c.from.slice(0, 10)} your browser will read <b>{fmtOffset(stale)}</b>. The law says {fmtOffset(c.after)}.
          </>
        )}
      </p>
    </div>
  )
}
