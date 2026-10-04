'use client'

import {BrowserOffset} from '@/components/browser-offset'
import {fmtOffset, toMinutes} from '@/lib/format'
import styles from './ask.module.css'

export interface Citation {
  id: string
  title: string
  kind: string
  authority: 'primary' | 'secondary' | 'community'
  status: string
  url: string
}

export type TimeResult =
  | {ok: false; zone: string; error: string}
  | {ok: true; zone: string; local: string; resolution: 'nonexistent'; explanation: string; scenario: string | null}
  | {
      ok: true
      zone: string
      instant: string
      local: string
      resolution: 'unique' | 'ambiguous' | 'instant'
      alternatives: {instant: string; offset: string}[]
      offset: string
      isDst: boolean
      abbreviation: string | null
      basis: Citation[]
      nextTransition: {instant: string; offset: string} | null
      clocks: {law: string; iana: {offset: string; version: string} | null; server: {offset: string; version: string | null} | null; disagreements: string[]}
      scenario: string | null
    }

export type DayResult =
  | {ok: false; jurisdiction: string; error: string}
  | {
      ok: true
      jurisdiction: string
      date: string
      workday: boolean
      reasons: {code: string; text: string; basis: Citation[]}[]
      nextWorkdays: string[]
      coverage: 'complete' | 'partial'
      caveat: string | null
      scenario: string | null
    }

const TIER_MARK = {primary: '§', secondary: '†', community: '‡'} as const

export function Basis({items}: {items: Citation[]}) {
  if (!items.length) return null
  return (
    <ul className={styles.basis}>
      {items.map((c) => (
        <li key={c.id}>
          <span className={`chip ${c.authority}`} title={`${c.authority} source`}>
            {TIER_MARK[c.authority]} {c.authority}
          </span>
          <a href={c.url} target="_blank" rel="noreferrer">
            {c.title}
          </a>
          <em>{c.status.replace(/_/g, ' ')}</em>
        </li>
      ))}
    </ul>
  )
}

const humanLocal = (local: string) => {
  const d = new Date(`${local}:00Z`)
  return {
    time: local.slice(11, 16),
    date: d.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}),
  }
}

export function TimeCard({r}: {r: TimeResult}) {
  if (!r.ok) return <div className={styles.card}>{r.error}</div>
  if (r.resolution === 'nonexistent')
    return (
      <div className={`${styles.card} ${styles.alert}`}>
        <p className="kicker">{r.zone}</p>
        <p className={styles.big}>{r.local.slice(11, 16)} never happens</p>
        <p>{r.explanation}</p>
      </div>
    )
  const h = humanLocal(r.local)
  const law = toMinutes(r.offset)
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className="kicker">
          {r.zone}
          {r.scenario ? <span className={styles.scenarioTag}>if {r.scenario} passes</span> : null}
        </p>
        <p className={styles.big}>{h.time}</p>
        <p className={styles.date}>
          {h.date} · {fmtOffset(law)}
          {r.abbreviation ? ` · ${r.abbreviation}` : ''}
          {r.isDst ? ' · daylight time' : ''}
        </p>
        {r.resolution === 'ambiguous' ? (
          <p className={styles.warn}>This reading happens twice: {r.alternatives.map((a) => `${a.instant.slice(11, 16)} UTC (${a.offset})`).join(' and ')}.</p>
        ) : null}
      </div>
      <div className={styles.clocks}>
        <div>
          <span>The law</span>
          <b>{fmtOffset(law)}</b>
        </div>
        <div>
          <span>IANA {r.clocks.iana?.version}</span>
          <b data-wrong={r.clocks.iana && r.clocks.iana.offset !== r.offset ? true : undefined}>
            {r.clocks.iana ? fmtOffset(toMinutes(r.clocks.iana.offset)) : '—'}
          </b>
        </div>
        <div>
          <span>Server {r.clocks.server?.version ? `(${r.clocks.server.version})` : ''}</span>
          <b data-wrong={r.clocks.server && r.clocks.server.offset !== r.offset ? true : undefined}>
            {r.clocks.server ? fmtOffset(toMinutes(r.clocks.server.offset)) : '—'}
          </b>
        </div>
        <div>
          <span>Your browser</span>
          <b>
            <BrowserOffset zone={r.zone} at={r.instant} law={law} />
          </b>
        </div>
      </div>
      <Basis items={r.basis} />
      {r.nextTransition ? (
        <p className={styles.next}>
          Next change: {r.nextTransition.instant.replace('T', ' ').slice(0, 16)} UTC → {fmtOffset(toMinutes(r.nextTransition.offset))}
        </p>
      ) : null}
    </div>
  )
}

export function DayCard({r}: {r: DayResult}) {
  if (!r.ok) return <div className={styles.card}>{r.error}</div>
  const d = new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className="kicker">
          {r.jurisdiction}
          {r.scenario ? <span className={styles.scenarioTag}>if {r.scenario} passes</span> : null}
        </p>
        <p className={styles.big} data-off={!r.workday || undefined}>
          {r.workday ? 'Working day' : 'Not a working day'}
        </p>
        <p className={styles.date}>{d}</p>
      </div>
      <ul className={styles.reasons}>
        {r.reasons.map((x, i) => (
          <li key={i}>
            <b>{x.text}</b>
            <Basis items={x.basis} />
          </li>
        ))}
      </ul>
      {r.caveat ? <p className={styles.warn}>{r.caveat}</p> : null}
      {r.nextWorkdays.length ? <p className={styles.next}>Next working days: {r.nextWorkdays.join(', ')}</p> : null}
    </div>
  )
}

const LABELS: Record<string, string> = {
  catalog_groq_query: 'GROQ over the structured dataset',
  catalog_schema_explorer: 'Read the schema',
  catalog_array_field_reader: 'Read a field',
  sources_knowledge_base_read: 'Read the Knowledge Base',
  sources_knowledge_base_search: 'Searched the Knowledge Base',
  list_scenarios: 'Listed pending laws',
  audit_schedule: 'Audited a schedule',
  legal_time: 'Computed legal time',
  working_day: 'Checked the calendar',
}

/** A tool call the agent made, shown as evidence: what it asked Sanity and what came back. */
export function EvidenceRow({name, input, state, output}: {name: string; input: unknown; state: string; output: unknown}) {
  const args = input as Record<string, unknown> | undefined
  const detail = String(
    typeof args?.query === 'string' ? args.query : Array.isArray(args?.paths) ? args.paths.join(', ') : args ? JSON.stringify(args) : '',
  )
  const done = state === 'output-available'
  return (
    <details className={styles.evidence}>
      <summary>
        <span className={styles.dot} data-done={done || undefined} />
        <b>{LABELS[name] ?? name}</b>
        <code>{detail.length > 140 ? `${detail.slice(0, 140)}…` : detail}</code>
      </summary>
      {done ? <pre>{typeof output === 'string' ? output : JSON.stringify(output, null, 2).slice(0, 6000)}</pre> : null}
    </details>
  )
}
