import ICAL from 'ical.js'
import {dayVerdict} from './calendar.ts'
import {runtimeOffset} from './runtime.ts'
import {formatOffset, offsetAt, resolveLocal, toLocal} from './time.ts'
import type {CalendarData, RuleSegment} from './types.ts'

export interface Participant {
  label: string
  zone: string
  jurisdiction: string
  /** Local working hours, inclusive start / exclusive end, e.g. [9, 18]. */
  hours?: [number, number]
}

export interface ScheduledEvent {
  title: string
  /** Local wall-clock start in the organiser's zone, "YYYY-MM-DDTHH:mm". */
  start: string
  zone: string
  /** Optional RFC 5545 recurrence rule, e.g. "FREQ=WEEKLY;BYDAY=MO". */
  rrule?: string
}

export type FlagCode =
  | 'nonexistent-local-time'
  | 'ambiguous-local-time'
  | 'runtime-drift'
  | 'holiday'
  | 'weekend'
  | 'outside-hours'
  | 'no-data'

export interface Flag {
  code: FlagCode
  severity: 'critical' | 'warning' | 'info'
  participant?: string
  message: string
  basis: string[]
}

export interface OccurrenceReport {
  event: string
  local: string
  zone: string
  instant: string | null
  flags: Flag[]
  participants: {label: string; local: string | null; offset: string | null; workday: boolean | null}[]
}

export interface AuditInput {
  events: ScheduledEvent[]
  participants: Participant[]
  /** Clock regimes keyed by IANA zone id. */
  segments: Record<string, RuleSegment[]>
  calendar: CalendarData
  /** Window to expand recurrences in (local dates, inclusive). */
  from: string
  to: string
  maxOccurrences?: number
}

const MAX_ITERATIONS = 20_000

/** Expand an event into local wall-clock starts inside [from, to]. */
export function expandOccurrences(event: ScheduledEvent, from: string, to: string, max = 200): string[] {
  const [date, time] = event.start.split('T') as [string, string]
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const [h, mi] = time.split(':').map(Number) as [number, number]
  const start = ICAL.Time.fromData({year: y, month: mo, day: d, hour: h, minute: mi, second: 0, isDate: false})
  if (!event.rrule) return withinWindow([event.start], from, to)
  const recur = ICAL.Recur.fromString(event.rrule)
  if (['SECONDLY', 'MINUTELY'].includes(recur.freq)) throw new Error(`Recurrence too frequent to audit: ${recur.freq}`)
  const it = recur.iterator(start)
  const out: string[] = []
  // Hard cap on iterator steps, so a rule that starts long before the window can't spin forever.
  let steps = 0
  for (let next = it.next(); next && out.length < max && steps < MAX_ITERATIONS; next = it.next(), steps++) {
    const local = `${pad(next.year, 4)}-${pad(next.month)}-${pad(next.day)}T${pad(next.hour)}:${pad(next.minute)}`
    if (local.slice(0, 10) > to) break
    if (local.slice(0, 10) >= from) out.push(local)
  }
  return out
}

function withinWindow(locals: string[], from: string, to: string): string[] {
  return locals.filter((l) => l.slice(0, 10) >= from && l.slice(0, 10) <= to)
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

/** Parse VEVENTs (summary, local DTSTART + TZID, RRULE) out of an iCalendar file. */
export function eventsFromIcs(ics: string, defaultZone = 'UTC'): ScheduledEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics))
  return root.getAllSubcomponents('vevent').map((ve) => {
    const prop = ve.getFirstProperty('dtstart')
    const value = prop?.getFirstValue() as ICAL.Time | undefined
    if (!value) throw new Error('VEVENT without DTSTART')
    const tzid = (prop?.getParameter('tzid') as string | undefined) ?? (value.zone?.tzid === 'UTC' ? 'UTC' : defaultZone)
    const rrule = ve.getFirstPropertyValue('rrule') as ICAL.Recur | null
    return {
      title: String(ve.getFirstPropertyValue('summary') ?? 'Untitled'),
      start: `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}`,
      zone: tzid,
      rrule: rrule ? rrule.toString() : undefined,
    }
  })
}

/**
 * Audit every occurrence: does the local time exist, will a stale runtime place it at the wrong instant,
 * and is it a working day and a working hour for every participant — by law?
 */
export function auditSchedule(input: AuditInput): OccurrenceReport[] {
  const reports: OccurrenceReport[] = []
  for (const event of input.events) {
    const segs = input.segments[event.zone]
    for (const local of expandOccurrences(event, input.from, input.to, input.maxOccurrences ?? 200)) {
      const flags: Flag[] = []
      if (!segs) {
        reports.push({
          event: event.title,
          local,
          zone: event.zone,
          instant: null,
          flags: [{code: 'no-data', severity: 'info', message: `No recorded clock regime for ${event.zone}.`, basis: []}],
          participants: [],
        })
        continue
      }
      const res = resolveLocal(segs, local)
      let instant: string | null = null
      if (res.kind === 'nonexistent') {
        flags.push({
          code: 'nonexistent-local-time',
          severity: 'critical',
          message: `${local} does not exist in ${event.zone}: clocks jump from ${formatOffset(res.offsetBefore)} to ${formatOffset(res.offsetAfter)}.`,
          basis: [],
        })
      } else if (res.kind === 'ambiguous') {
        instant = res.candidates[0]!.instant
        flags.push({
          code: 'ambiguous-local-time',
          severity: 'warning',
          message: `${local} happens twice in ${event.zone} (${res.candidates.map((c) => formatOffset(c.offsetMinutes)).join(' and ')}).`,
          basis: [],
        })
      } else {
        instant = res.instant
      }

      if (instant) {
        const law = offsetAt(segs, instant)
        let rt: number | null = null
        try {
          rt = runtimeOffset(event.zone, instant)
        } catch {
          rt = null
        }
        if (rt !== null && rt !== law.offsetMinutes) {
          flags.push({
            code: 'runtime-drift',
            severity: 'critical',
            message: `This runtime's tz data puts ${event.zone} at ${formatOffset(rt)}; the law says ${formatOffset(law.offsetMinutes)}. Systems on stale data will place this ${Math.abs(rt - law.offsetMinutes)} minutes off.`,
            basis: law.basis,
          })
        }
      }

      const participants: OccurrenceReport['participants'] = []
      for (const p of input.participants) {
        const psegs = input.segments[p.zone]
        if (!instant || !psegs) {
          participants.push({label: p.label, local: null, offset: null, workday: null})
          continue
        }
        const off = offsetAt(psegs, instant)
        const plocal = toLocal(instant, off.offsetMinutes)
        let workday: boolean | null = null
        try {
          const v = dayVerdict(input.calendar, p.jurisdiction, plocal.slice(0, 10))
          workday = v.workday
          for (const r of v.reasons) {
            if (r.code === 'holiday' && !v.workday)
              flags.push({code: 'holiday', severity: 'warning', participant: p.label, message: `${p.label}: ${r.text} (${plocal.slice(0, 10)}).`, basis: r.basis})
            if (r.code === 'weekend' && !v.workday)
              flags.push({code: 'weekend', severity: 'warning', participant: p.label, message: `${p.label}: rest day (${plocal.slice(0, 10)}).`, basis: r.basis})
          }
        } catch {
          flags.push({code: 'no-data', severity: 'info', participant: p.label, message: `No calendar data for ${p.jurisdiction}.`, basis: []})
        }
        const [startH, endH] = p.hours ?? [9, 18]
        const hour = Number(plocal.slice(11, 13)) + Number(plocal.slice(14, 16)) / 60
        if (hour < startH || hour >= endH)
          flags.push({code: 'outside-hours', severity: 'info', participant: p.label, message: `${p.label}: ${plocal.slice(11, 16)} local.`, basis: []})
        participants.push({label: p.label, local: plocal, offset: formatOffset(off.offsetMinutes), workday})
      }
      reports.push({event: event.title, local, zone: event.zone, instant, flags, participants})
    }
  }
  return reports
}
