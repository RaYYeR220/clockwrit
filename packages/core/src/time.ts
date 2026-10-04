import type {LocalResolution, OffsetResult, RuleSegment, TransitionRule} from './types.ts'

const MIN = 60_000
const DAY = 86_400_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

interface Transition {
  instant: number
  offsetMinutes: number
  isDst: boolean
}

/** Day of month for a zic `ON` field ("15", "lastSun", "Sun>=8", "Fri<=1"). */
export function dayOfMonth(year: number, month: number, on: string): number {
  if (/^\d+$/.test(on)) return Number(on)
  const last = /^last(\w{3})$/.exec(on)
  if (last) {
    const wd = weekdayIndex(last[1]!)
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const lastWd = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay()
    return lastDay - ((lastWd - wd + 7) % 7)
  }
  const cmp = /^(\w{3})(>=|<=)(\d+)$/.exec(on)
  if (cmp) {
    const wd = weekdayIndex(cmp[1]!)
    const pivot = Number(cmp[3])
    const pivotWd = new Date(Date.UTC(year, month - 1, pivot)).getUTCDay()
    return cmp[2] === '>=' ? pivot + ((wd - pivotWd + 7) % 7) : pivot - ((pivotWd - wd + 7) % 7)
  }
  throw new Error(`Unsupported ON field: ${on}`)
}

function weekdayIndex(name: string): number {
  const i = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number])
  if (i < 0) throw new Error(`Unknown weekday: ${name}`)
  return i
}

function parseAt(at: string): number {
  const [h = '0', m = '0', s = '0'] = at.split(':')
  return Number(h) * 60 + Number(m) + Number(s) / 60
}

/** Local clock reading of a rule in a given year, expressed as minutes on a UTC-based axis. */
function ruleLocalMs(rule: TransitionRule, year: number): number {
  const day = dayOfMonth(year, rule.month, rule.on)
  return Date.UTC(year, rule.month - 1, day) + parseAt(rule.at) * MIN
}

function inSegment(seg: RuleSegment, t: number): boolean {
  return (seg.from === null || Date.parse(seg.from) <= t) && (seg.to === null || t < Date.parse(seg.to))
}

/** The DST start/end instants a segment's rules produce in `year`, sorted. */
export function transitionsInYear(seg: RuleSegment, year: number): {instant: string; offsetMinutes: number; isDst: boolean}[] {
  return rawTransitions(seg, year).map((t) => ({...t, instant: new Date(t.instant).toISOString()}))
}

function rawTransitions(seg: RuleSegment, year: number): Transition[] {
  if (!seg.dst) return []
  const {save, start, end} = seg.dst
  const std = seg.stdOffset
  const startLocal = ruleLocalMs(start, year)
  const endLocal = ruleLocalMs(end, year)
  // Before the start transition the wall clock shows standard time; before the end it shows DST.
  const startUtc = start.atType === 'utc' ? startLocal : startLocal - std * MIN
  const endUtc =
    end.atType === 'utc' ? endLocal : end.atType === 'std' ? endLocal - std * MIN : endLocal - (std + save) * MIN
  return [
    {instant: startUtc, offsetMinutes: std + save, isDst: true},
    {instant: endUtc, offsetMinutes: std, isDst: false},
  ].sort((a, b) => a.instant - b.instant)
}

function segmentTransitions(seg: RuleSegment, t: number): Transition[] {
  const year = new Date(t).getUTCFullYear()
  return [year - 1, year, year + 1]
    .flatMap((y) => rawTransitions(seg, y))
    .filter((x) => inSegment(seg, x.instant))
    .sort((a, b) => a.instant - b.instant)
}

function findSegment(segments: RuleSegment[], t: number): RuleSegment {
  const seg = segments.find((s) => inSegment(s, t))
  if (!seg) throw new Error(`No rule segment covers ${new Date(t).toISOString()}`)
  return seg
}

function stateAt(seg: RuleSegment, t: number): {offsetMinutes: number; isDst: boolean} {
  if (!seg.dst) return {offsetMinutes: seg.stdOffset, isDst: false}
  const ts = segmentTransitions(seg, t)
  const prev = ts.filter((x) => x.instant <= t).at(-1)
  if (prev) return {offsetMinutes: prev.offsetMinutes, isDst: prev.isDst}
  const next = ts.find((x) => x.instant > t)
  const inDst = next ? !next.isDst : false
  return {offsetMinutes: seg.stdOffset + (inDst ? seg.dst.save : 0), isDst: inDst}
}

/** The legal UTC offset in force at a UTC instant, with the regime it comes from. */
export function offsetAt(segments: RuleSegment[], instantIso: string): OffsetResult {
  const t = Date.parse(instantIso)
  if (Number.isNaN(t)) throw new Error(`Invalid instant: ${instantIso}`)
  const seg = findSegment(segments, t)
  const state = stateAt(seg, t)
  return {
    zone: seg.zone,
    instant: new Date(t).toISOString(),
    offsetMinutes: state.offsetMinutes,
    isDst: state.isDst,
    segmentId: seg.id,
    basis: seg.basis ?? [],
    nextTransition: nextTransition(segments, seg, t, state.offsetMinutes),
  }
}

function nextTransition(
  segments: RuleSegment[],
  seg: RuleSegment,
  t: number,
  current: number,
): {instant: string; offsetMinutes: number} | null {
  const inside = segmentTransitions(seg, t).find((x) => x.instant > t && x.offsetMinutes !== current)
  if (inside) return {instant: new Date(inside.instant).toISOString(), offsetMinutes: inside.offsetMinutes}
  if (seg.to === null) return null
  const boundary = Date.parse(seg.to)
  const after = segments.find((s) => inSegment(s, boundary))
  if (!after) return null
  const state = stateAt(after, boundary)
  return state.offsetMinutes === current ? null : {instant: new Date(boundary).toISOString(), offsetMinutes: state.offsetMinutes}
}

/**
 * Map a local wall-clock reading ("YYYY-MM-DDTHH:mm[:ss]") to UTC.
 * Readings skipped by a spring-forward are `nonexistent`; readings repeated by a fall-back are `ambiguous`.
 */
export function resolveLocal(segments: RuleSegment[], local: string): LocalResolution {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!m) throw new Error(`Expected YYYY-MM-DDTHH:mm, got ${local}`)
  const localMs = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0))

  const probes = [localMs - 2 * DAY, localMs - DAY, localMs, localMs + DAY, localMs + 2 * DAY]
  const offsets = new Set<number>()
  for (const p of probes) {
    try {
      offsets.add(offsetAt(segments, new Date(p).toISOString()).offsetMinutes)
    } catch {
      // outside coverage; ignore this probe
    }
  }

  const valid: {instant: string; offsetMinutes: number; segmentId: string}[] = []
  for (const o of offsets) {
    const utc = localMs - o * MIN
    try {
      const r = offsetAt(segments, new Date(utc).toISOString())
      if (r.offsetMinutes === o) valid.push({instant: r.instant, offsetMinutes: o, segmentId: r.segmentId})
    } catch {
      // not covered
    }
  }
  valid.sort((a, b) => Date.parse(a.instant) - Date.parse(b.instant))

  if (valid.length === 1) return {kind: 'unique', ...valid[0]!}
  if (valid.length > 1) return {kind: 'ambiguous', candidates: valid}

  const sorted = [...offsets].sort((a, b) => a - b)
  const before = sorted[0] ?? 0
  const after = sorted.at(-1) ?? 0
  return {
    kind: 'nonexistent',
    gapStart: new Date(localMs - before * MIN - (after - before) * MIN).toISOString(),
    offsetBefore: before,
    offsetAfter: after,
  }
}

/** "+05:30" style label for an offset in minutes. */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/** Local wall-clock reading ("YYYY-MM-DDTHH:mm") for an instant and offset. */
export function toLocal(instantIso: string, offsetMinutes: number): string {
  return new Date(Date.parse(instantIso) + offsetMinutes * MIN).toISOString().slice(0, 16)
}
