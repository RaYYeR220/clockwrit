import 'server-only'
import type {CalendarData, RuleSegment, TransitionRule} from '@wallclock/core'
import {defineQuery} from 'next-sanity'
import {contentClient} from './sanity'

export interface Citation {
  id: string
  title: string
  kind: string
  authority: 'primary' | 'secondary' | 'community'
  status: string
  url: string
  publisher?: string
  reviewedAt?: string
}

const INSTRUMENT = `{_id, title, kind, authority, status, url, publisher, reviewedAt}`

export const SEGMENTS_QUERY = defineQuery(`*[_type == "ruleSegment" && zone->ianaId == $zone] | order(validFrom asc) {
  _id, "zone": zone->ianaId, validFrom, validTo, stdOffsetMinutes, dst, abbreviations,
  "basis": basis[]->${INSTRUMENT}
}`)

export const ZONE_QUERY = defineQuery(`*[_type == "zone" && ($id == ianaId || $id in aliases)][0] {
  ianaId, aliases, city, "jurisdiction": jurisdiction->{code, name, timeAuthority}
}`)

export const CALENDAR_QUERY = defineQuery(`{
  "coverage": *[_type == "jurisdiction" && code == $code][0].calendarCoverage[]{year, completeness, note},
  "holidays": *[_type == "holiday" && jurisdiction->code == $code] {_id, date, name, nameLocal, dayOff, kind, dateCertainty, status, "basis": basis[]->${INSTRUMENT}},
  "weekends": *[_type == "weekendRegime" && jurisdiction->code == $code] {_id, from, to, days, note, "basis": basis[]->${INSTRUMENT}},
  "overrides": *[_type == "workdayOverride" && jurisdiction->code == $code] {_id, date, isWorkday, reason, "basis": basis[]->${INSTRUMENT}},
  "suspensions": *[_type == "holidaySuspension" && jurisdiction->code == $code] {_id, from, to, reason, "basis": basis[]->${INSTRUMENT}}
}`)

export const RELEASES_QUERY = defineQuery(`releases::all()[state == "active"] {
  "id": name, "title": metadata.title, "description": metadata.description, "type": metadata.releaseType
}`)

interface SegmentDoc {
  _id: string
  zone: string
  validFrom: string | null
  validTo: string | null
  stdOffsetMinutes: number
  dst: {saveMinutes: number; start: TransitionRule; end: TransitionRule} | null
  abbreviations?: string[]
  basis: Citation[] | null
}

export interface ZoneData {
  zone: string
  segments: RuleSegment[]
  citations: Record<string, Citation>
}

export async function loadZone(zone: string, scenario?: string): Promise<ZoneData> {
  const release = await resolveScenario(scenario)
  const client = contentClient(release ? [release] : undefined)
  const meta = await client.fetch<{ianaId: string} | null>(ZONE_QUERY, {id: zone})
  const ianaId = meta?.ianaId ?? zone
  const docs = await client.fetch<SegmentDoc[]>(SEGMENTS_QUERY, {zone: ianaId})
  const citations: Record<string, Citation> = {}
  const segments: RuleSegment[] = docs.map((d) => {
    for (const c of d.basis ?? []) {
      const n = normalise(c)
      citations[n.id] = n
    }
    return {
      id: d._id,
      zone: d.zone,
      from: d.validFrom,
      to: d.validTo,
      stdOffset: d.stdOffsetMinutes,
      dst: d.dst
        ? {save: d.dst.saveMinutes, start: d.dst.start, end: d.dst.end}
        : null,
      abbreviations: d.abbreviations as RuleSegment['abbreviations'],
      basis: (d.basis ?? []).map((c) => normalise(c).id),
    }
  })
  return {zone: ianaId, segments, citations}
}

interface CalendarDocs {
  coverage: {year: number; completeness: 'complete' | 'partial'; note?: string}[] | null
  holidays: {_id: string; date: string; name: string; dayOff: boolean; kind: string; basis: Citation[] | null}[]
  weekends: {_id: string; from: string | null; to: string | null; days: number[]; basis: Citation[] | null}[]
  overrides: {_id: string; date: string; isWorkday: boolean; reason: string; basis: Citation[] | null}[]
  suspensions: {_id: string; from: string; to: string | null; reason: string; basis: Citation[] | null}[]
}

export async function loadCalendar(
  code: string,
  scenario?: string,
): Promise<{calendar: CalendarData; citations: Record<string, Citation>; coverage: NonNullable<CalendarDocs['coverage']>}> {
  const release = await resolveScenario(scenario)
  const docs = await contentClient(release ? [release] : undefined).fetch<CalendarDocs>(CALENDAR_QUERY, {code})
  const citations: Record<string, Citation> = {}
  const ids = (b: Citation[] | null) =>
    (b ?? []).map((c) => {
      const n = normalise(c)
      citations[n.id] = n
      return n.id
    })
  return {
    calendar: {
      holidays: docs.holidays.map((h) => ({id: h._id, jurisdiction: code, date: h.date, name: h.name, dayOff: h.dayOff, kind: h.kind, basis: ids(h.basis)})),
      weekends: docs.weekends.map((w) => ({id: w._id, jurisdiction: code, from: w.from, to: w.to, days: w.days, basis: ids(w.basis)})),
      overrides: docs.overrides.map((o) => ({id: o._id, jurisdiction: code, date: o.date, isWorkday: o.isWorkday, reason: o.reason, basis: ids(o.basis)})),
      suspensions: docs.suspensions.map((s) => ({id: s._id, jurisdiction: code, from: s.from, to: s.to, reason: s.reason, basis: ids(s.basis)})),
    },
    citations,
    coverage: docs.coverage ?? [],
  }
}

let scenarioCache: {at: number; list: {id: string; title: string; description?: string}[]} | null = null

/** Pending or conditional laws, modelled as active Content Releases. */
export async function listScenarios(): Promise<{id: string; title: string; description?: string}[]> {
  if (scenarioCache && Date.now() - scenarioCache.at < 5 * 60_000) return scenarioCache.list
  // Release documents are system documents: only visible in the raw perspective.
  const list = await contentClient().withConfig({perspective: 'raw'}).fetch<{id: string; title: string; description?: string}[]>(RELEASES_QUERY)
  scenarioCache = {at: Date.now(), list}
  return list
}

/**
 * Only an active release we published as a scenario may become a read perspective.
 * Anything else (drafts, raw, unknown ids) is refused, so callers can't read unpublished content.
 */
export async function resolveScenario(scenario: string | undefined | null): Promise<string | undefined> {
  if (!scenario) return undefined
  if (!/^r[A-Za-z0-9_-]{1,64}$/.test(scenario)) throw new Error(`Unknown scenario: ${scenario}`)
  const list = await listScenarios()
  if (!list.some((s) => s.id === scenario)) throw new Error(`Unknown scenario: ${scenario}`)
  return scenario
}

function normalise(c: Citation & {_id?: string}): Citation {
  return {...c, id: c._id ?? c.id}
}
