import 'server-only'
import {formatOffset, runtimeOffset, runtimeTzVersion} from '@wallclock/core'
import {ianaOffset, ianaVersion, ianaZones} from '@wallclock/core/iana'

const DAY = 86_400_000
/** How far ahead the scan looks: the rest of this year's changes and all of next year's. */
const HORIZON_DAYS = 460

export interface DriftingZone {
  zone: string
  /** First sampled day (12:00 UTC) on which the two disagree. */
  from: string
  /** Sampled days in the horizon on which they disagree. */
  days: number
  iana: string
  runtime: string
}

export interface DriftReport {
  iana: string
  runtime: string | null
  zones: number
  drifting: DriftingZone[]
}

let memo: {start: number; report: DriftReport} | null = null

/** Zones where this server's tz data disagrees with the pinned IANA release, sampled daily at 12:00 UTC. Computed once per day. */
export function serverDrift(): DriftReport {
  const now = new Date()
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  if (memo?.start === start) return memo.report
  const zones = ianaZones()
  const end = start + HORIZON_DAYS * DAY
  const drifting: DriftingZone[] = []
  for (const zone of zones) {
    let first: {from: string; iana: string; runtime: string} | null = null
    let days = 0
    for (let t = start; t < end; t += DAY) {
      const iso = new Date(t).toISOString()
      let rt: number
      try {
        rt = runtimeOffset(zone, iso)
      } catch {
        break
      }
      const ref = ianaOffset(zone, iso)
      if (ref !== rt) {
        days++
        first ??= {from: iso.slice(0, 10), iana: formatOffset(ref), runtime: formatOffset(rt)}
      }
    }
    if (first) drifting.push({zone, days, ...first})
  }
  const report = {iana: ianaVersion(), runtime: runtimeTzVersion(), zones: zones.length, drifting}
  memo = {start, report}
  return report
}

/** The instant a reader is checked at: noon UTC on the day after the drift begins, safely inside it. */
export function probeFor(from: string): string {
  return new Date(Date.parse(`${from}T12:00:00Z`) + DAY).toISOString()
}
