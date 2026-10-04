import type {CalendarData, DayVerdict} from './types.ts'

const DAY = 86_400_000

function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

/** YYYY-MM-DD that names a real calendar day (rejects 2026-02-30). */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const t = Date.parse(`${date}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(date)
}

function within(date: string, from: string | null, to: string | null): boolean {
  return (from === null || from <= date) && (to === null || date <= to)
}

/**
 * Is `date` (local, YYYY-MM-DD) a working day in `jurisdiction`?
 * Precedence: explicit override > holiday (unless suspended) > weekend regime > ordinary day.
 */
export function dayVerdict(data: CalendarData, jurisdiction: string, date: string): DayVerdict {
  if (!isValidDate(date)) throw new Error(`Not a valid date: ${date}`)
  const weekend = data.weekends.find((w) => w.jurisdiction === jurisdiction && within(date, w.from, w.to))
  if (!weekend) throw new Error(`No calendar data for ${jurisdiction} on ${date}`)

  const reasons: DayVerdict['reasons'] = []
  const override = data.overrides.find((o) => o.jurisdiction === jurisdiction && o.date === date)
  if (override) {
    reasons.push({code: 'override', text: override.reason, basis: override.basis ?? []})
    return {jurisdiction, date, workday: override.isWorkday, reasons}
  }

  const holiday = data.holidays.find((h) => h.jurisdiction === jurisdiction && h.date === date && h.dayOff)
  if (holiday) {
    reasons.push({code: 'holiday', text: holiday.name, basis: holiday.basis ?? []})
    const suspension = data.suspensions.find((s) => s.jurisdiction === jurisdiction && within(date, s.from, s.to))
    if (!suspension) return {jurisdiction, date, workday: false, reasons}
    reasons.push({code: 'suspension', text: suspension.reason, basis: suspension.basis ?? []})
  }

  if (weekend.days.includes(isoWeekday(date))) {
    reasons.push({code: 'weekend', text: `Rest day under weekend regime ${weekend.id}`, basis: weekend.basis ?? []})
    return {jurisdiction, date, workday: false, reasons}
  }

  if (reasons.length === 0) reasons.push({code: 'ordinary', text: 'Ordinary working day', basis: weekend.basis ?? []})
  return {jurisdiction, date, workday: true, reasons}
}

/** The next `count` working days strictly after `date`. */
export function nextWorkdays(data: CalendarData, jurisdiction: string, date: string, count: number): string[] {
  const out: string[] = []
  let t = Date.parse(`${date}T00:00:00Z`)
  for (let guard = 0; out.length < count && guard < 400; guard++) {
    t += DAY
    const d = new Date(t).toISOString().slice(0, 10)
    if (dayVerdict(data, jurisdiction, d).workday) out.push(d)
  }
  return out
}
