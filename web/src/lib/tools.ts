import 'server-only'
import {
  auditSchedule,
  dayVerdict,
  formatOffset,
  nextWorkdays,
  offsetAt,
  resolveLocal,
  runtimeOffset,
  runtimeTzVersion,
  toLocal,
  type CalendarData,
  type RuleSegment,
} from '@wallclock/core'
import {ianaOffset, ianaVersion} from '@wallclock/core/iana'
import {tool} from 'ai'
import {z} from 'zod'
import {listScenarios, loadCalendar, loadZone, type Citation} from './data'

const scenario = z
  .string()
  .optional()
  .describe('Optional Content Release id of a pending or conditional law. Omit to answer under the law in force.')

function cite(ids: string[], all: Record<string, Citation>): Citation[] {
  return ids.map((id) => all[id]).filter((c): c is Citation => Boolean(c))
}

export async function legalTime(input: {zone: string; at?: string; local?: string; scenario?: string}) {
  const data = await loadZone(input.zone, input.scenario)
  if (data.segments.length === 0) {
    return {ok: false as const, zone: data.zone, error: `No recorded clock regime for ${data.zone}. It is outside this dataset; do not guess.`}
  }
  let instant: string
  let resolution: 'unique' | 'ambiguous' | 'nonexistent' | 'instant' = 'instant'
  let alternatives: {instant: string; offset: string}[] = []
  if (input.local) {
    const r = resolveLocal(data.segments, input.local)
    if (r.kind === 'nonexistent') {
      return {
        ok: true as const,
        zone: data.zone,
        local: input.local,
        resolution: 'nonexistent' as const,
        explanation: `${input.local} never appears on clocks in ${data.zone}: they jump from ${formatOffset(r.offsetBefore)} to ${formatOffset(r.offsetAfter)}.`,
        scenario: input.scenario ?? null,
      }
    }
    resolution = r.kind
    if (r.kind === 'ambiguous') {
      instant = r.candidates[0]!.instant
      alternatives = r.candidates.map((c) => ({instant: c.instant, offset: formatOffset(c.offsetMinutes)}))
    } else {
      instant = r.instant
    }
  } else {
    instant = new Date(input.at ?? Date.now()).toISOString()
  }

  const law = offsetAt(data.segments, instant)
  const seg = data.segments.find((s) => s.id === law.segmentId) as RuleSegment
  const abbreviation = seg.abbreviations?.[law.isDst ? 1 : 0] ?? null
  let iana: {offset: string; version: string} | null = null
  try {
    iana = {offset: formatOffset(ianaOffset(data.zone, instant)), version: ianaVersion()}
  } catch {
    iana = null
  }
  let server: {offset: string; version: string | null} | null = null
  try {
    server = {offset: formatOffset(runtimeOffset(data.zone, instant)), version: runtimeTzVersion()}
  } catch {
    server = null
  }
  const lawOffset = formatOffset(law.offsetMinutes)
  return {
    ok: true as const,
    zone: data.zone,
    instant,
    local: toLocal(instant, law.offsetMinutes),
    resolution,
    alternatives,
    offset: lawOffset,
    isDst: law.isDst,
    abbreviation,
    regime: law.segmentId,
    basis: cite(law.basis, data.citations),
    nextTransition: law.nextTransition
      ? {instant: law.nextTransition.instant, offset: formatOffset(law.nextTransition.offsetMinutes)}
      : null,
    clocks: {
      law: lawOffset,
      iana,
      server,
      disagreements: [
        ...(iana && iana.offset !== lawOffset ? [`IANA tzdata ${iana.version} says ${iana.offset}`] : []),
        ...(server && server.offset !== lawOffset ? [`this server's tz data (${server.version ?? 'unknown'}) says ${server.offset}`] : []),
      ],
    },
    scenario: input.scenario ?? null,
  }
}

export async function workingDay(input: {jurisdiction: string; date: string; scenario?: string}) {
  const {calendar, citations} = await loadCalendar(input.jurisdiction.toUpperCase(), input.scenario)
  try {
    const v = dayVerdict(calendar, input.jurisdiction.toUpperCase(), input.date)
    return {
      ok: true as const,
      jurisdiction: v.jurisdiction,
      date: v.date,
      workday: v.workday,
      reasons: v.reasons.map((r) => ({code: r.code, text: r.text, basis: cite(r.basis, citations)})),
      nextWorkdays: nextWorkdays(calendar, v.jurisdiction, input.date, 3),
      scenario: input.scenario ?? null,
    }
  } catch (e) {
    return {ok: false as const, jurisdiction: input.jurisdiction, error: `${(e as Error).message}. It is outside this dataset; do not guess.`}
  }
}

export async function auditFor(input: {
  events: {title: string; start: string; zone: string; rrule?: string}[]
  participants: {label: string; zone: string; jurisdiction: string; hours?: [number, number]}[]
  from: string
  to: string
  scenario?: string
}) {
  const zones = [...new Set([...input.events.map((e) => e.zone), ...input.participants.map((p) => p.zone)])]
  const jurisdictions = [...new Set(input.participants.map((p) => p.jurisdiction.toUpperCase()))]
  const segments: Record<string, RuleSegment[]> = {}
  const citations: Record<string, Citation> = {}
  for (const z of zones) {
    const d = await loadZone(z, input.scenario)
    if (d.segments.length) segments[z] = d.segments
    Object.assign(citations, d.citations)
  }
  const calendar: CalendarData = {holidays: [], weekends: [], overrides: [], suspensions: []}
  for (const j of jurisdictions) {
    const c = await loadCalendar(j, input.scenario)
    calendar.holidays.push(...c.calendar.holidays)
    calendar.weekends.push(...c.calendar.weekends)
    calendar.overrides.push(...c.calendar.overrides)
    calendar.suspensions.push(...c.calendar.suspensions)
    Object.assign(citations, c.citations)
  }
  const reports = auditSchedule({
    events: input.events,
    participants: input.participants.map((p) => ({...p, jurisdiction: p.jurisdiction.toUpperCase()})),
    segments,
    calendar,
    from: input.from,
    to: input.to,
    maxOccurrences: 120,
  })
  return {
    occurrences: reports.map((r) => ({...r, flags: r.flags.map((f) => ({...f, basis: cite(f.basis, citations)}))})),
    flagged: reports.filter((r) => r.flags.some((f) => f.severity !== 'info')).length,
    total: reports.length,
  }
}

export const localTools = {
  legal_time: tool({
    description:
      'Compute the legal UTC offset and local wall-clock reading for a time zone at an instant (or resolve a local wall-clock reading to UTC). ' +
      'Reads the clock regimes recorded in the dataset and the instruments they rest on, and reports what IANA tzdata and this server runtime say. ' +
      'Always use this instead of stating an offset from memory.',
    inputSchema: z.object({
      zone: z.string().describe('IANA zone id, e.g. "America/Vancouver"'),
      at: z.string().optional().describe('UTC instant, ISO 8601. Defaults to now.'),
      local: z.string().optional().describe('Local wall-clock reading "YYYY-MM-DDTHH:mm" to resolve instead of `at`.'),
      scenario,
    }),
    execute: legalTime,
  }),
  working_day: tool({
    description:
      'Decide whether a local date is a legal working day in a jurisdiction (holidays, weekend regime, working-Saturday overrides, holiday suspensions), with the instruments behind it. ' +
      'Always use this instead of deciding from memory.',
    inputSchema: z.object({
      jurisdiction: z.string().describe('ISO 3166 code, e.g. "PL", "CN", "AE", "CA-BC"'),
      date: z.string().describe('Local date YYYY-MM-DD'),
      scenario,
    }),
    execute: workingDay,
  }),
  audit_schedule: tool({
    description:
      'Audit recurring events: flags local times that do not exist or happen twice, runtimes whose tz data disagrees with the law, and participants for whom it falls on a holiday, rest day or outside hours.',
    inputSchema: z.object({
      events: z.array(z.object({title: z.string(), start: z.string(), zone: z.string(), rrule: z.string().optional()})).max(10),
      participants: z
        .array(z.object({label: z.string(), zone: z.string(), jurisdiction: z.string(), hours: z.tuple([z.number(), z.number()]).optional()}))
        .max(12),
      from: z.string(),
      to: z.string(),
      scenario,
    }),
    execute: auditFor,
  }),
  list_scenarios: tool({
    description: 'List pending or conditional laws modelled as Content Releases, so you can answer "what if this passes".',
    inputSchema: z.object({}),
    execute: async () => ({scenarios: await listScenarios()}),
  }),
}
