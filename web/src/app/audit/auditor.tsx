'use client'

import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react'
import {browserOffset, fmtOffset, toMinutes} from '@/lib/format'
import type {auditFor} from '@/lib/tools'
import styles from './audit.module.css'

export interface AuditOptions {
  zones: {ianaId: string; city?: string}[]
  jurisdictions: {code: string; name: string; calendar: boolean}[]
}

type Repeat = 'none' | 'weekly' | 'weekdays' | 'monthly'
type Mode = 'event' | 'ics'
type AuditEvent = {title: string; start: string; zone: string; rrule?: string}
type Result = Awaited<ReturnType<typeof auditFor>> & {events: AuditEvent[]}
type Occurrence = Result['occurrences'][number]
type Severity = Occurrence['flags'][number]['severity']

interface Person {
  key: number
  label: string
  zone: string
  jurisdiction: string
}

interface AuditBody {
  ics?: string
  defaultZone?: string
  events?: AuditEvent[]
  participants: {label: string; zone: string; jurisdiction: string}[]
  from: string
  to: string
}

type Run = {status: 'idle'} | {status: 'running'} | {status: 'error'; error: string} | {status: 'done'; result: Result; people: Person[]}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SEVERITY: Record<Severity, {label: string; rank: number}> = {
  critical: {label: 'Critical', rank: 0},
  warning: {label: 'Warning', rank: 1},
  info: {label: 'Note', rank: 2},
}
const MAX_PEOPLE = 20
const MAX_ICS_BYTES = 256 * 1024

const EXAMPLE = {
  event: {title: 'Platform sync', start: '2026-10-01T10:00', zone: 'America/New_York', repeat: 'weekly' as Repeat},
  people: [
    {key: 1, label: 'New York', zone: 'America/New_York', jurisdiction: 'US'},
    {key: 2, label: 'Winnipeg', zone: 'America/Winnipeg', jurisdiction: 'CA-MB'},
    {key: 3, label: 'Warsaw', zone: 'Europe/Warsaw', jurisdiction: 'PL'},
    {key: 4, label: 'Kyiv', zone: 'Europe/Kyiv', jurisdiction: 'UA'},
    {key: 5, label: 'São Paulo', zone: 'America/Sao_Paulo', jurisdiction: 'BR'},
  ],
  from: '2026-10-01',
  to: '2027-01-31',
}

const utcDay = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`)

function rruleFor(repeat: Repeat, start: string): string | undefined {
  const d = utcDay(start)
  if (Number.isNaN(d.getTime())) return undefined
  if (repeat === 'weekly') return `FREQ=WEEKLY;BYDAY=${BYDAY[d.getUTCDay()]}`
  if (repeat === 'weekdays') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
  if (repeat === 'monthly') return `FREQ=MONTHLY;BYMONTHDAY=${d.getUTCDate()}`
  return undefined
}

function sampleIcs(): string {
  const {title, start, zone, repeat} = EXAMPLE.event
  const stamp = (local: string) => `${local.replace(/[-:]/g, '')}00`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clockwrit//Schedule auditor//EN',
    'BEGIN:VEVENT',
    'UID:platform-sync@clockwrit',
    'DTSTAMP:20260915T120000Z',
    `DTSTART;TZID=${zone}:${stamp(start)}`,
    `DTEND;TZID=${zone}:${stamp(`${start.slice(0, 11)}10:30`)}`,
    `RRULE:${rruleFor(repeat, start)}`,
    `SUMMARY:${title}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

const SAMPLE_ICS = sampleIcs()

const EXAMPLE_BODY: AuditBody = {
  events: [
    {title: EXAMPLE.event.title, start: EXAMPLE.event.start, zone: EXAMPLE.event.zone, rrule: rruleFor(EXAMPLE.event.repeat, EXAMPLE.event.start)},
  ],
  participants: EXAMPLE.people.map(({label, zone, jurisdiction}) => ({label, zone, jurisdiction})),
  from: EXAMPLE.from,
  to: EXAMPLE.to,
}

function fmtDay(local: string): string {
  const d = utcDay(local)
  return `${WEEKDAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const needsAttention = (o: Occurrence) => o.flags.some((f) => f.severity !== 'info')

export function Auditor({options}: {options: AuditOptions}) {
  const [mode, setMode] = useState<Mode>('event')
  const [event, setEvent] = useState(EXAMPLE.event)
  const [ics, setIcs] = useState(SAMPLE_ICS)
  const [defaultZone, setDefaultZone] = useState(EXAMPLE.event.zone)
  const [people, setPeople] = useState<Person[]>(EXAMPLE.people)
  const [from, setFrom] = useState(EXAMPLE.from)
  const [to, setTo] = useState(EXAMPLE.to)
  const [run, setRun] = useState<Run>({status: 'idle'})
  const [showAll, setShowAll] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const nextKey = useRef(EXAMPLE.people.length + 1)

  const send = useCallback(async (body: AuditBody, snapshot: Person[]) => {
    setRun({status: 'running'})
    setShowAll(false)
    try {
      const res = await fetch('/api/audit', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)})
      const json = (await res.json().catch(() => null)) as (Result & {error?: string}) | null
      if (!res.ok || !json || json.error) throw new Error(json?.error ?? `The audit failed (${res.status}).`)
      setRun({status: 'done', result: json, people: snapshot})
    } catch (e) {
      setRun({status: 'error', error: (e as Error).message})
    }
  }, [])

  // ?demo=1 audits the example as soon as the page loads.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return
    const t = setTimeout(() => void send(EXAMPLE_BODY, EXAMPLE.people), 0)
    return () => clearTimeout(t)
  }, [send])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const participants = people.map(({label, zone, jurisdiction}) => ({label: label.trim(), zone, jurisdiction}))
    const body: AuditBody =
      mode === 'ics'
        ? {ics, defaultZone, participants, from, to}
        : {
            events: [{title: event.title.trim() || 'Untitled', start: event.start, zone: event.zone, rrule: rruleFor(event.repeat, event.start)}],
            participants,
            from,
            to,
          }
    void send(body, people)
  }

  async function onFile(file: File | undefined) {
    setFileError(null)
    if (!file) return
    if (file.size > MAX_ICS_BYTES) {
      setFileError(`That file is ${Math.round(file.size / 1024)} KB; the auditor reads up to 256 KB.`)
      return
    }
    setIcs(await file.text())
  }

  const updatePerson = (key: number, patch: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? {...p, ...patch} : p)))
  const addPerson = () => {
    const key = nextKey.current++
    const jurisdiction = options.jurisdictions.find((j) => j.calendar)?.code ?? options.jurisdictions[0]?.code ?? ''
    setPeople((ps) => [...ps, {key, label: '', zone: options.zones[0]?.ianaId ?? 'UTC', jurisdiction}])
  }
  const removePerson = (key: number) => setPeople((ps) => ps.filter((p) => p.key !== key))

  const weekday = utcDay(event.start).getUTCDay()
  const withCalendar = options.jurisdictions.filter((j) => j.calendar)
  const clockOnly = options.jurisdictions.filter((j) => !j.calendar)
  const zoneOptions = options.zones.map((z) => (
    <option key={z.ianaId} value={z.ianaId}>
      {z.ianaId}
    </option>
  ))

  return (
    <section className={`paper ${styles.desk}`} aria-label="Audit a schedule">
      <div className="wrap">
        <form className={styles.form} onSubmit={onSubmit}>
          <fieldset className={styles.block}>
            <legend className={styles.legend}>
              <b>01</b> The meeting
            </legend>
            <div className={styles.modes} role="group" aria-label="Describe the meeting as">
              <button type="button" aria-pressed={mode === 'event'} onClick={() => setMode('event')}>
                One recurring event
              </button>
              <button type="button" aria-pressed={mode === 'ics'} onClick={() => setMode('ics')}>
                An .ics calendar
              </button>
            </div>
            {mode === 'event' ? (
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span>Title</span>
                  <input value={event.title} maxLength={120} onChange={(e) => setEvent({...event, title: e.target.value})} />
                </label>
                <label className={styles.field}>
                  <span>Local start</span>
                  <input type="datetime-local" required value={event.start} onChange={(e) => setEvent({...event, start: e.target.value})} />
                </label>
                <label className={styles.field}>
                  <span>Organiser’s zone</span>
                  <select value={event.zone} onChange={(e) => setEvent({...event, zone: e.target.value})}>
                    {zoneOptions}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Repeats</span>
                  <select value={event.repeat} onChange={(e) => setEvent({...event, repeat: e.target.value as Repeat})}>
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Weekly on {Number.isNaN(weekday) ? 'the same day' : WEEKDAYS[weekday]}</option>
                    <option value="weekdays">Every weekday, Monday to Friday</option>
                    <option value="monthly">Monthly on day {Number.isNaN(weekday) ? '—' : utcDay(event.start).getUTCDate()}</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className={styles.fields}>
                <label className={`${styles.field} ${styles.wide}`}>
                  <span>iCalendar text</span>
                  <textarea rows={11} required spellCheck={false} value={ics} onChange={(e) => setIcs(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Or read a file</span>
                  <input type="file" accept=".ics,text/calendar" onChange={(e) => void onFile(e.target.files?.[0])} />
                </label>
                <label className={styles.field}>
                  <span>Zone for times without a TZID</span>
                  <select value={defaultZone} onChange={(e) => setDefaultZone(e.target.value)}>
                    {zoneOptions}
                  </select>
                </label>
                {fileError && (
                  <p className={`${styles.wide} ${styles.error}`} role="alert">
                    {fileError}
                  </p>
                )}
              </div>
            )}
            <a className={styles.sample} href={`data:text/calendar;charset=utf-8,${encodeURIComponent(SAMPLE_ICS)}`} download="platform-sync.ics">
              Download sample .ics
            </a>
          </fieldset>

          <fieldset className={styles.block}>
            <legend className={styles.legend}>
              <b>02</b> Who attends
            </legend>
            <div className={styles.editorHead} aria-hidden="true">
              <span>Label</span>
              <span>Zone</span>
              <span>Jurisdiction</span>
            </div>
            <ul className={styles.editor}>
              {people.map((p, i) => (
                <li key={p.key} className={styles.personRow}>
                  <label className={styles.cell}>
                    <span className={styles.cellLabel}>
                      <span className={styles.sr}>Participant {i + 1} </span>Label
                    </span>
                    <input value={p.label} required maxLength={40} onChange={(e) => updatePerson(p.key, {label: e.target.value})} />
                  </label>
                  <label className={styles.cell}>
                    <span className={styles.cellLabel}>
                      <span className={styles.sr}>Participant {i + 1} </span>Zone
                    </span>
                    <select value={p.zone} onChange={(e) => updatePerson(p.key, {zone: e.target.value})}>
                      {zoneOptions}
                    </select>
                  </label>
                  <label className={styles.cell}>
                    <span className={styles.cellLabel}>
                      <span className={styles.sr}>Participant {i + 1} </span>Jurisdiction
                    </span>
                    <select value={p.jurisdiction} onChange={(e) => updatePerson(p.key, {jurisdiction: e.target.value})}>
                      <optgroup label="With a holiday calendar">
                        {withCalendar.map((j) => (
                          <option key={j.code} value={j.code}>
                            {j.code} · {j.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Clock only, no holiday calendar">
                        {clockOnly.map((j) => (
                          <option key={j.code} value={j.code}>
                            {j.code} · {j.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                  <button type="button" className={styles.remove} onClick={() => removePerson(p.key)} disabled={people.length === 1}>
                    Remove<span className={styles.sr}> {p.label || `participant ${i + 1}`}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn ghost" onClick={addPerson} disabled={people.length >= MAX_PEOPLE}>
              Add participant
            </button>
          </fieldset>

          <fieldset className={`${styles.block} ${styles.window}`}>
            <legend className={styles.legend}>
              <b>03</b> Over which dates
            </legend>
            <label className={styles.field}>
              <span>From</span>
              <input type="date" required value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>To</span>
              <input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="submit" className={`btn ${styles.run}`} disabled={run.status === 'running'}>
              {run.status === 'running' ? 'Auditing…' : 'Audit every occurrence'}
            </button>
          </fieldset>
        </form>

        <div className={styles.status} aria-live="polite">
          {run.status === 'running' && <p className={styles.pending}>Reading every occurrence against the law…</p>}
          {run.status === 'error' && (
            <p className={styles.error} role="alert">
              {run.error}
            </p>
          )}
          {run.status === 'done' && <Summary result={run.result} />}
        </div>

        {run.status === 'done' && run.result.total > 0 && (
          <Results result={run.result} people={run.people} showAll={showAll} setShowAll={setShowAll} />
        )}
      </div>
    </section>
  )
}

function Summary({result}: {result: Result}) {
  const tally = {critical: 0, warning: 0, info: 0}
  for (const o of result.occurrences) for (const f of o.flags) tally[f.severity]++
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  return (
    <div className={styles.summary}>
      <h2 className={styles.h2}>
        <b>{result.flagged}</b> of {n(result.total, 'occurrence', 'occurrences')} {result.flagged === 1 ? 'needs' : 'need'} attention.
      </h2>
      <p className={styles.tally}>
        {n(tally.critical, 'critical flag', 'critical flags')} · {n(tally.warning, 'warning', 'warnings')} · {n(tally.info, 'note', 'notes')}
        {result.events.length > 0 && (
          <>
            {' '}
            · read {result.events.length === 1 ? `“${result.events[0]!.title}”` : `${result.events.length} events`},{' '}
            {result.events.map((e) => `${e.start.replace('T', ' ')} ${e.zone}${e.rrule ? ` ${e.rrule}` : ''}`).join('; ')}
          </>
        )}
      </p>
    </div>
  )
}

function Results({result, people, showAll, setShowAll}: {result: Result; people: Person[]; showAll: boolean; setShowAll: (v: boolean) => void}) {
  const visible = showAll ? result.occurrences : result.occurrences.filter(needsAttention)
  const multi = new Set(result.occurrences.map((o) => o.event)).size > 1
  const zones = people.map((p) => p.zone)
  return (
    <>
      <div className={styles.modes} role="group" aria-label="Show occurrences">
        <button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
          Needing attention ({result.flagged})
        </button>
        <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>
          All {result.total}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className={styles.empty}>No occurrence carries a critical or warning flag in this window.</p>
      ) : (
        <ol className={styles.occurrences}>
          {visible.map((o, i) => (
            <OccurrenceRow key={`${o.event}-${o.local}-${i}`} o={o} multi={multi} zones={zones} />
          ))}
        </ol>
      )}
    </>
  )
}

function OccurrenceRow({o, multi, zones}: {o: Occurrence; multi: boolean; zones: string[]}) {
  const offset = o.instant ? Math.round((Date.parse(`${o.local}:00Z`) - Date.parse(o.instant)) / 60_000) : null
  const flags = [...o.flags].sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank)
  return (
    <li className={styles.occ} data-flagged={needsAttention(o) || undefined}>
      <div className={styles.when}>
        {multi && <p className={styles.event}>{o.event}</p>}
        <p className={styles.day}>{fmtDay(o.local)}</p>
        <p className={styles.time}>{o.local.slice(11, 16)}</p>
        <p className={styles.meta}>
          <span className={styles.zone}>{o.zone}</span>{' '}
          {offset !== null && (
            <span>
              {fmtOffset(offset)} · {o.instant!.slice(11, 16)} UTC
            </span>
          )}
        </p>
      </div>
      {o.participants.length > 0 && (
        <ul className={styles.people}>
          {o.participants.map((p, i) => (
            <ParticipantCell key={i} p={p} instant={o.instant} organiserDay={o.local.slice(0, 10)} zone={zones[i]} />
          ))}
        </ul>
      )}
      {flags.length > 0 && (
        <ul className={styles.flags}>
          {flags.map((f, i) => (
            <li key={i} className={styles.flag} data-severity={f.severity}>
              <span className={styles.sev}>{SEVERITY[f.severity].label}</span>
              <span className={styles.msg}>{f.message}</span>
              {f.basis.length > 0 && (
                <span className={styles.basis}>
                  {f.basis.map((b) => (
                    <a key={b.id} className={`chip ${b.authority} ${styles.cite}`} href={b.url} target="_blank" rel="noreferrer" title={b.title}>
                      <b>{b.authority}</b>
                      <span>{b.title}</span>
                    </a>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function ParticipantCell({
  p,
  instant,
  organiserDay,
  zone,
}: {
  p: Occurrence['participants'][number]
  instant: string | null
  organiserDay: string
  zone: string | undefined
}) {
  const law = p.offset ? toMinutes(p.offset) : null
  let browser: number | null = null
  if (instant && zone) {
    try {
      browser = browserOffset(zone, new Date(instant))
    } catch {
      browser = null
    }
  }
  const clock = (m: number) => new Date(Date.parse(instant!) + m * 60_000).toISOString().slice(11, 16)
  return (
    <li className={styles.person} data-off={p.workday === false || undefined}>
      <span className={styles.who}>{p.label}</span>
      <span className={styles.ptime}>
        {p.local ? p.local.slice(11, 16) : '—'}
        {p.local && p.local.slice(0, 10) !== organiserDay && <small>{fmtDay(p.local).slice(0, -5)}</small>}
      </span>
      <span className={styles.poff}>{law !== null ? fmtOffset(law) : '—'}</span>
      <span className={styles.workday}>{p.local === null ? '' : p.workday === null ? 'No calendar' : p.workday ? 'Working day' : 'Day off'}</span>
      {law !== null && browser !== null && browser !== law && (
        <span className={styles.browser} title="The local time your browser’s own tz data gives for this instant">
          Your browser: <s>{clock(browser)}</s>
        </span>
      )}
    </li>
  )
}
