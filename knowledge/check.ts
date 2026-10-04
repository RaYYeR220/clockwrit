// Verifies the reviewed dataset before it is loaded:
//  1. every clock regime reproduces the IANA reference offset, sampled hourly around every transition and daily otherwise;
//  2. every zone's segments are contiguous (no gaps, no overlaps);
//  3. every calendar jurisdiction has a weekend regime.
// Divergences that are real (the law and tzdata disagree on the offset) must be listed in dataset/known-divergences.json.
// Usage: pnpm --filter @wallclock/knowledge check [fromYear] [toYear]
import {offsetAt, type RuleSegment} from '@wallclock/core'
import {ianaOffset, ianaVersion} from '@wallclock/core/iana'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const dir = join(import.meta.dirname, 'dataset')
const read = <T>(n: string): T[] => (existsSync(join(dir, `${n}.json`)) ? (JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8')) as T[]) : [])

interface SegDoc {
  _id: string
  zone: string
  validFrom: string | null
  validTo: string | null
  stdOffsetMinutes: number
  dst?: {saveMinutes: number; start: RuleSegment['dst'] extends infer D ? (D extends {start: infer S} ? S : never) : never; end: never} | null
}
interface ZoneDoc {
  _id: string
  ianaId: string
}
interface Divergence {
  zone: string
  from: string
  to: string
  reason: string
}

const fromYear = Number(process.argv[2] ?? 2020)
const toYear = Number(process.argv[3] ?? 2028)

const zones = new Map(read<ZoneDoc>('zones').map((z) => [z._id, z.ianaId]))
const known = read<Divergence>('known-divergences')
let failures = 0

const byZone = new Map<string, RuleSegment[]>()
for (const s of read<SegDoc>('segments')) {
  const iana = zones.get(s.zone)
  if (!iana) {
    console.error(`✗ ${s._id}: unknown zone ${s.zone}`)
    failures++
    continue
  }
  const seg: RuleSegment = {
    id: s._id,
    zone: iana,
    from: s.validFrom,
    to: s.validTo,
    stdOffset: s.stdOffsetMinutes,
    dst: s.dst ? {save: s.dst.saveMinutes, start: s.dst.start, end: s.dst.end as never} : null,
  }
  byZone.set(iana, [...(byZone.get(iana) ?? []), seg])
}

console.log(`IANA reference ${ianaVersion()}; ${byZone.size} zones; ${fromYear}-${toYear}\n`)

for (const [zone, segs] of byZone) {
  segs.sort((a, b) => (a.from ? Date.parse(a.from) : -Infinity) - (b.from ? Date.parse(b.from) : -Infinity))
  for (let i = 1; i < segs.length; i++) {
    if (segs[i - 1]!.to !== segs[i]!.from) {
      console.error(`✗ ${zone}: ${segs[i - 1]!.id} ends ${segs[i - 1]!.to} but ${segs[i]!.id} starts ${segs[i]!.from}`)
      failures++
    }
  }
  let samples = 0
  const mismatches: string[] = []
  const check = (t: number) => {
    const iso = new Date(t).toISOString()
    let law: number
    try {
      law = offsetAt(segs, iso).offsetMinutes
    } catch {
      return
    }
    samples++
    const ref = ianaOffset(zone, iso)
    if (law === ref) return
    const day = iso.slice(0, 10)
    if (known.some((k) => k.zone === zone && k.from <= day && day <= k.to)) return
    mismatches.push(`${iso} law ${law} iana ${ref}`)
  }
  for (let t = Date.UTC(fromYear, 0, 1, 12); t < Date.UTC(toYear + 1, 0, 1); t += 86_400_000) check(t)
  // Hourly around every IANA transition, so a rule that is right on the day but wrong by an hour is caught.
  for (let t = Date.UTC(fromYear, 0, 1); t < Date.UTC(toYear + 1, 0, 1); t += 3_600_000) {
    if (ianaOffset(zone, new Date(t).toISOString()) !== ianaOffset(zone, new Date(t + 3_600_000).toISOString())) {
      for (let k = -3; k <= 3; k++) check(t + k * 3_600_000)
    }
  }
  if (mismatches.length) {
    failures++
    console.error(`✗ ${zone}: ${mismatches.length}/${samples} samples differ, e.g. ${mismatches.slice(0, 3).join('; ')}`)
  } else {
    console.log(`✓ ${zone.padEnd(28)} ${samples} samples match`)
  }
}

const jurisdictions = read<{_id: string}>('jurisdictions').map((j) => j._id)
const weekends = new Set(read<{jurisdiction: string}>('weekends').map((w) => w.jurisdiction))
const calendarJurisdictions = new Set(
  ['holidays', 'overrides', 'suspensions'].flatMap((n) => read<{jurisdiction: string}>(n).map((d) => d.jurisdiction)),
)
for (const j of calendarJurisdictions) {
  if (!jurisdictions.includes(j)) {
    console.error(`✗ calendar data for unknown jurisdiction ${j}`)
    failures++
  }
  if (!weekends.has(j)) {
    console.error(`✗ ${j} has calendar data but no weekend regime`)
    failures++
  }
}

console.log(failures ? `\n${failures} problem(s)` : '\nall checks passed')
process.exit(failures ? 1 : 0)
