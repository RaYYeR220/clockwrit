import {createRequire} from 'node:module'
import {runtimeOffset, runtimeTzVersion} from './runtime.ts'
import {offsetAt} from './time.ts'
import type {RuleSegment} from './types.ts'

const require = createRequire(import.meta.url)

interface TzDatabase {
  totalOffset(zone: string, utcMillis: number): {minutes(): number}
}

let db: TzDatabase | null = null
let version: string | null = null

function iana(): TzDatabase {
  if (!db) {
    // timezonecomplete picks up the `tzdata` package; we pin it so the reference version is explicit.
    const tc = require('timezonecomplete') as {TzDatabase: {instance(): TzDatabase}}
    db = tc.TzDatabase.instance()
  }
  return db
}

/** The IANA tzdata release the reference clock is compiled from (e.g. "2026e"). */
export function ianaVersion(): string {
  if (!version) version = (require('tzdata/timezone-data.json') as {version: string}).version
  return version
}

/** Offset according to the pinned IANA tzdata release. */
export function ianaOffset(zone: string, instantIso: string): number {
  return iana().totalOffset(zone, Date.parse(instantIso)).minutes()
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
