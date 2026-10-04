/** How the time-of-day in a transition rule is measured (zic semantics). */
export type AtType = 'wall' | 'std' | 'utc'

/**
 * One annual transition, in IANA zic notation.
 * `on` is "15", "lastSun", "Sun>=8" or "Fri<=1"; `at` is "2:00", "1:00", "24:00".
 */
export interface TransitionRule {
  month: number // 1-12
  on: string
  at: string
  atType: AtType
}

export interface DstRule {
  /** Minutes added to standard time while DST is in effect (usually 60). */
  save: number
  start: TransitionRule
  end: TransitionRule
}

/**
 * A span of time during which one legal regime governs a zone.
 * `from`/`to` are UTC instants (ISO 8601); null means open-ended.
 */
export interface RuleSegment {
  id: string
  zone: string
  from: string | null
  to: string | null
  /** Standard offset from UTC, in minutes (UTC-3 => -180). */
  stdOffset: number
  dst: DstRule | null
  /** Abbreviations, e.g. ["CET", "CEST"]. */
  abbreviations?: [string, string?]
  /** Reference to the legal instrument this regime rests on. */
  basis?: string[]
}

export interface OffsetResult {
  zone: string
  instant: string
  offsetMinutes: number
  isDst: boolean
  segmentId: string
  basis: string[]
  /** Next transition after `instant` within the same segment set, if any. */
  nextTransition: { instant: string; offsetMinutes: number } | null
}

export type LocalResolution =
  | { kind: 'unique'; instant: string; offsetMinutes: number; segmentId: string }
  | { kind: 'ambiguous'; candidates: { instant: string; offsetMinutes: number; segmentId: string }[] }
  | { kind: 'nonexistent'; gapStart: string; offsetBefore: number; offsetAfter: number }

// ---------------------------------------------------------------- calendar

export interface Holiday {
  id: string
  jurisdiction: string // ISO 3166-1 alpha-2, optionally "-SUB"
  date: string // YYYY-MM-DD local
  name: string
  /** Whether the law makes this a day off for the general workforce. */
  dayOff: boolean
  /** e.g. "statutory", "substitute", "bridge", "moon-sighted", "one-off" */
  kind: string
  basis?: string[]
}

export interface WeekendRegime {
  id: string
  jurisdiction: string
  from: string | null // YYYY-MM-DD
  to: string | null
  /** ISO weekdays that are rest days: 1 = Monday ... 7 = Sunday. */
  days: number[]
  basis?: string[]
}

/** A date whose working status is set explicitly (e.g. China's "adjusted" working Saturdays). */
export interface WorkdayOverride {
  id: string
  jurisdiction: string
  date: string
  isWorkday: boolean
  reason: string
  basis?: string[]
}

/** A legal suspension of holiday days-off (e.g. under martial law). */
export interface HolidaySuspension {
  id: string
  jurisdiction: string
  from: string
  to: string | null
  reason: string
  basis?: string[]
}

export interface CalendarData {
  holidays: Holiday[]
  weekends: WeekendRegime[]
  overrides: WorkdayOverride[]
  suspensions: HolidaySuspension[]
}

export interface DayVerdict {
  jurisdiction: string
  date: string
  workday: boolean
  reasons: { code: 'weekend' | 'holiday' | 'override' | 'suspension' | 'ordinary'; text: string; basis: string[] }[]
}
