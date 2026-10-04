import Link from 'next/link'
import {BrowserOffset} from '@/components/browser-offset'
import {LiveClock} from '@/components/live-clock'
import {fmtOffset, toMinutes} from '@/lib/format'
import {datasetCounts, evalSummary, HERO_CITIES, PROBE_INSTANT} from '@/lib/site'
import {legalTime} from '@/lib/tools'
import styles from './page.module.css'

export const revalidate = 300

export default async function Home() {
  const [readings, counts] = await Promise.all([
    Promise.all(
      HERO_CITIES.map(async (c) => {
        const [now, probe] = await Promise.all([legalTime({zone: c.zone}), legalTime({zone: c.zone, at: PROBE_INSTANT})])
        return {...c, now, probe}
      }),
    ),
    datasetCounts(),
  ])
  const evalRun = evalSummary()
  type Reading = Awaited<ReturnType<typeof legalTime>>
  const full = (r: Reading) => (r.ok && r.resolution !== 'nonexistent' ? r : null)
  const offsetOf = (r: Reading) => {
    const f = full(r)
    return f ? toMinutes(f.offset) : 0
  }
  const cities = readings.map((r) => ({zone: r.zone, city: r.city, from: r.from, now: offsetOf(r.now), after: offsetOf(r.probe)}))
  const first = readings[0] ? full(readings[0].probe) : null
  const versions = first?.clocks ?? null

  return (
    <main>
      <section className={styles.hero}>
        <LiveClock cities={cities} />
        <h1 className={styles.h1}>Every hour has a citation.</h1>
        <p className={styles.sub}>
          Clockwrit is an agent that reads the law, IANA tzdata and your runtime’s clock — and tells you which one is right, with the
          decree, the date and the source quote.
        </p>
        <Link className="btn" href="/ask">
          Ask a time
        </Link>
        <Link className={styles.link} href="/drift">
          See the zones your runtime gets wrong
        </Link>
      </section>

      <section className={`paper ${styles.clocks}`} aria-labelledby="clocks-h">
        <div className="wrap">
          <p className="kicker">Monday 2 November 2026, 15:00 UTC</p>
          <h2 id="clocks-h" className={styles.h2}>
            Four clocks, one instant.
          </h2>
          <p className={styles.lede}>
            Canada stopped changing its clocks province by province this year, and IANA shipped five tzdata releases to keep up. The
            server this page runs on ships an older one — and so, probably, does your browser.
          </p>
          <div className={styles.rows} role="table" aria-label="Offsets by authority">
            <div className={styles.rowHead} role="row">
              <span role="columnheader">Place and law</span>
              <span role="columnheader">The law</span>
              <span role="columnheader">IANA {versions?.iana?.version}</span>
              <span role="columnheader">This server {versions?.server?.version ? `(${versions.server.version})` : ''}</span>
              <span role="columnheader">Your browser</span>
            </div>
            {readings.map((r) => {
              const p = full(r.probe)
              if (!p) return null
              const law = toMinutes(p.offset)
              const server = p.clocks.server ? toMinutes(p.clocks.server.offset) : null
              return (
                <div key={r.zone} className={styles.row} role="row">
                  <span role="cell" className={styles.place}>
                    {r.city}
                    <small>{p.basis.find((b) => b.authority === 'primary')?.title ?? p.basis[0]?.title}</small>
                  </span>
                  <span role="cell" className={styles.law}>
                    {fmtOffset(law)}
                  </span>
                  <span role="cell">{p.clocks.iana ? fmtOffset(toMinutes(p.clocks.iana.offset)) : '—'}</span>
                  <span role="cell" data-wrong={server !== null && server !== law ? true : undefined}>
                    {server === null ? '—' : server !== law ? <s>{fmtOffset(server)}</s> : fmtOffset(server)}
                  </span>
                  <BrowserOffset zone={r.zone} at={PROBE_INSTANT} law={law} />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className={styles.ruling} aria-labelledby="ruling-h">
        <div className="wrap">
          <h2 id="ruling-h" className={styles.h2}>
            Sources disagree. A person signs.
          </h2>
          <ol className={styles.steps}>
            <li>
              <b>01</b>
              <span>Statutes, IANA notes, vendor notices and the news go into a Sanity Context Knowledge Base, each with its authority tier.</span>
            </li>
            <li>
              <b>02</b>
              <span>When a new source contradicts what the Knowledge Base already says, the rebuild files a conflict instead of blending them.</span>
            </li>
            <li>
              <b>03</b>
              <span>The agent drafts a ruling: which side, why, and what the typed records say. It cannot apply it.</span>
            </li>
            <li>
              <b>04</b>
              <span>A person approves. The ruling becomes a standing instruction for every later build, and the answer changes.</span>
            </li>
          </ol>
          <p className={styles.counts}>
            <span>
              <b>{counts.instruments}</b> instruments
            </span>
            <span>
              <b>{counts.primary}</b> of them primary law
            </span>
            <span>
              <b>{counts.jurisdictions}</b> jurisdictions
            </span>
            <span>
              <b>{counts.rulingsApplied}</b> rulings applied
            </span>
          </p>
          <Link className="btn ghost" href="/desk">
            Open the ruling desk
          </Link>
        </div>
      </section>

      <section className={styles.measured} aria-labelledby="measured-h">
        <div className="wrap">
          <p className="kicker">Measured, not claimed</p>
          <h2 id="measured-h" className={styles.h2}>
            A keyword search gets you the wrong hour.
          </h2>
          {evalRun ? (
            <>
              <div className={styles.score}>
                {(['agent', 'keyword', 'model'] as const).map((arm) =>
                  evalRun.summary[arm] ? (
                  <div key={arm}>
                    <b>
                      {evalRun.summary[arm].correct}
                      <small>/{evalRun.total}</small>
                    </b>
                    <span>{arm === 'agent' ? 'Clockwrit' : arm === 'keyword' ? 'Keyword search + the same model' : 'The same model, no tools'}</span>
                    <em>
                      traps {evalRun.summary[arm].trapsCorrect}/{evalRun.summary[arm].traps}
                    </em>
                  </div>
                  ) : null,
                )}
              </div>
              <Link className={styles.link} href="/eval">
                Every question, answer and verdict →
              </Link>
            </>
          ) : (
            <p className={styles.lede}>The held-out evaluation hasn’t been run on this deployment yet.</p>
          )}
        </div>
      </section>

      <section className={`paper ${styles.use}`} aria-labelledby="use-h">
        <div className="wrap">
          <h2 id="use-h" className={styles.h2}>
            Use it from anywhere.
          </h2>
          <div className={styles.cols}>
            <div>
              <p className="kicker">MCP, for your agent</p>
              <pre>{`{
  "clockwrit": {
    "url": "${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clockwrit.vercel.app'}/api/mcp"
  }
}`}</pre>
              <p>legal_time · working_day · audit_schedule</p>
            </div>
            <div>
              <p className="kicker">CLI, for your terminal</p>
              <pre>{`clockwrit now America/Winnipeg
clockwrit day PL 2026-12-24
clockwrit audit team.ics --with "Kyiv=Europe/Kyiv:UA"
clockwrit drift`}</pre>
              <p>drift runs offline against your own Node.</p>
            </div>
            <div>
              <p className="kicker">HTTP, for everything else</p>
              <pre>{`GET  /api/clock?zone=…&at=…
GET  /api/day?jurisdiction=…&date=…
POST /api/audit   {ics, participants}
POST /api/ask     {question}`}</pre>
              <p>Every answer carries its legal basis.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className="wrap">
          <span>
            Content: Sanity project <code>{process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}</code>, public dataset{' '}
            <a
              href={`https://${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v2026-09-01/data/query/production?query=*%5B_type%3D%3D%22instrument%22%5D%7Btitle%2Cauthority%2Cstatus%2Curl%7D`}
            >
              production
            </a>
          </span>
          <span>
            {counts.zones} zones · {counts.segments} clock regimes · {counts.holidays} holidays
          </span>
        </div>
      </footer>
    </main>
  )
}
