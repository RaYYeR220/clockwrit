import type {Metadata} from 'next'
import {ianaOffset} from '@wallclock/core/iana'
import {BrowserOffset} from '@/components/browser-offset'
import {probeFor, serverDrift} from '@/lib/drift'
import {fmtOffset, toMinutes} from '@/lib/format'
import {legalTime} from '@/lib/tools'
import {BrowserScore} from './browser-score'
import styles from './drift.module.css'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Drift',
  description: 'The zones where this server’s tz data disagrees with IANA, the law behind them, and whether your browser gets them wrong too.',
}

export default async function DriftPage() {
  const report = serverDrift()
  const rows = await Promise.all(
    report.drifting.map(async (d) => {
      const probe = probeFor(d.from)
      const reading = await legalTime({zone: d.zone, at: probe}).catch(() => null)
      const law = reading?.ok && reading.resolution !== 'nonexistent' ? reading : null
      return {
        ...d,
        probe,
        expected: ianaOffset(d.zone, probe),
        canonical: law && law.zone !== d.zone ? law.zone : null,
        basis: law ? (law.basis.find((b) => b.authority === 'primary') ?? law.basis[0] ?? null) : null,
      }
    }),
  )
  rows.sort((a, b) => a.from.localeCompare(b.from) || a.zone.localeCompare(b.zone))

  return (
    <main>
      <header className={styles.head}>
        <div className="wrap">
          <p className="kicker">Drift</p>
          <h1 className={styles.h1}>Your runtime vs the law.</h1>
          <p className={styles.lede}>
            Every zone name in IANA tzdata, read at noon UTC each day for the next fifteen months: once from the current IANA release, once from the
            tz data this server ships. Where they part, anything this server schedules in that zone lands at the wrong instant.
          </p>
          <dl className={styles.stats}>
            <div>
              <dt>This server</dt>
              <dd>{report.runtime ?? '?'}</dd>
            </div>
            <div>
              <dt>IANA</dt>
              <dd>{report.iana}</dd>
            </div>
            <div>
              <dt>Zone names that disagree</dt>
              <dd>
                {rows.length}
                <small>/{report.zones}</small>
              </dd>
            </div>
          </dl>
          {rows.length > 0 && <BrowserScore zones={rows.map((r) => ({zone: r.zone, at: r.probe, expected: r.expected}))} />}
        </div>
      </header>

      <section className={`paper ${styles.list}`} aria-labelledby="zones-h">
        <div className="wrap">
          <h2 id="zones-h" className={styles.h2}>
            {rows.length > 0 ? `${rows.length} zones, three clocks.` : 'No zone disagrees.'}
          </h2>
          {rows.length === 0 ? (
            <p className={styles.note}>
              This server’s tz data ({report.runtime ?? 'unknown version'}) agrees with IANA {report.iana} on every zone for the next fifteen months.
            </p>
          ) : (
            <div className={styles.rows} role="table" aria-label="Zones where this server disagrees with IANA">
              <div className={styles.rowHead} role="row">
                <span role="columnheader">Zone and law</span>
                <span role="columnheader">Disagrees from</span>
                <span role="columnheader">IANA {report.iana}</span>
                <span role="columnheader">This server ({report.runtime ?? '?'})</span>
                <span role="columnheader">Your browser</span>
              </div>
              {rows.map((r) => (
                <div key={r.zone} className={styles.row} role="row">
                  <span role="cell" className={styles.zone}>
                    {r.zone}
                    {r.canonical && <small>a link to {r.canonical}</small>}
                    {r.basis && (
                      <a className={styles.basis} href={r.basis.url} target="_blank" rel="noreferrer">
                        {r.basis.title}
                      </a>
                    )}
                  </span>
                  <span role="cell" className={styles.from}>
                    <small className={styles.label}>Disagrees from</small>
                    {r.from}
                    <small>
                      {r.days} {r.days === 1 ? 'day' : 'days'} wrong
                    </small>
                  </span>
                  <span role="cell" className={styles.offset}>
                    <small className={styles.label}>IANA {report.iana}</small>
                    {fmtOffset(toMinutes(r.iana))}
                  </span>
                  <span role="cell" className={styles.offset} data-wrong>
                    <small className={styles.label}>This server</small>
                    <s>{fmtOffset(toMinutes(r.runtime))}</s>
                  </span>
                  <span role="cell" className={styles.offset}>
                    <small className={styles.label}>Your browser</small>
                    <BrowserOffset zone={r.zone} at={r.probe} law={r.expected} className={styles.browser} />
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className={styles.note}>
            Read daily at 12:00 UTC from today for 460 days with the pinned IANA release and with this server’s own Intl data. “Disagrees from” is the
            first such day; your browser is read at noon UTC the day after. Links are aliases IANA keeps for older names. The legal basis is the
            primary instrument the dataset records for the zone, where it has one.
          </p>
        </div>
      </section>
    </main>
  )
}
