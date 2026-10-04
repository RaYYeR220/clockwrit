import {createRequire} from 'node:module'
import {runtimeOffset, runtimeTzVersion} from './runtime.ts'
import {offsetAt} from './time.ts'
import type {RuleSegment} from './types.ts'

const require = createRequire(import.meta.url)

interface MomentTz {
  dataVersion: string
  zone(name: string): {utcOffset(ms: number): number} | null
}

let tz: MomentTz | null = null

// moment-timezone ships tzdata compiled by zic; we pin the package so the reference release is explicit.
function iana(): MomentTz {
  tz ??= (require('moment-timezone') as {tz: MomentTz}).tz
  return tz
}

/** The IANA tzdata release the reference clock is compiled from (e.g. "2026e"). */
export function ianaVersion(): string {
  return iana().dataVersion
}

/** Offset according to the pinned IANA tzdata release. */
export function ianaOffset(zone: string, instantIso: string): number {
  const z = iana().zone(zone)
  if (!z) throw new Error(`Unknown IANA zone: ${zone}`)
  // moment reports minutes west of UTC.
  return -z.utcOffset(Date.parse(instantIso)) || 0
}

export interface ThreeClocks {
  zone: string
  instant: string
  law: {offsetMinutes: number; segmentId: string; basis: string[]} | null
  iana: {offsetMinutes: number; version: string}
  runtime: {offsetMinutes: number; version: string | null} | null
  agree: boolean
  /** Which clocks disagree with the law, if any. */
  drift: ('iana' | 'runtime')[]
}

/**
 * Read the same instant off three clocks: the law as recorded in our dataset,
 * the IANA reference release, and the caller's runtime (pass a browser's reading in `runtime`).
 */
export function threeClocks(
  segments: RuleSegment[],
  zone: string,
  instantIso: string,
  runtime?: {offsetMinutes: number; version: string | null},
): ThreeClocks {
  let law: ThreeClocks['law'] = null
  try {
    const r = offsetAt(segments, instantIso)
    law = {offsetMinutes: r.offsetMinutes, segmentId: r.segmentId, basis: r.basis}
  } catch {
    law = null
  }
  const ianaReading = {offsetMinutes: ianaOffset(zone, instantIso), version: ianaVersion()}
  let rt: ThreeClocks['runtime'] = runtime ?? null
  if (!rt) {
    try {
      rt = {offsetMinutes: runtimeOffset(zone, instantIso), version: runtimeTzVersion()}
    } catch {
      rt = null
    }
  }
  const reference = law?.offsetMinutes ?? ianaReading.offsetMinutes
  const drift: ThreeClocks['drift'] = []
  if (law && ianaReading.offsetMinutes !== law.offsetMinutes) drift.push('iana')
  if (rt && rt.offsetMinutes !== reference) drift.push('runtime')
  return {zone, instant: new Date(instantIso).toISOString(), law, iana: ianaReading, runtime: rt, agree: drift.length === 0, drift}
}
