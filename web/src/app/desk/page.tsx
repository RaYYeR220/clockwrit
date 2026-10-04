import type {Metadata} from 'next'
import {listRulings, type RulingView} from '@/lib/rulings'
import {DeskClient} from './desk-client'
import styles from './desk.module.css'

export const metadata: Metadata = {title: 'Ruling desk'}
export const dynamic = 'force-dynamic'

export default async function DeskPage() {
  let conflicts: RulingView[] = []
  let failure: string | null = null
  try {
    conflicts = await listRulings()
  } catch (e) {
    failure = (e as Error).message
  }
  const open = conflicts.filter((c) => c.status === 'open').length
  const applied = conflicts.filter((c) => c.ruling?.status === 'applied').length
  return (
    <main>
      <header className={styles.head}>
        <div className="wrap">
          <p className="kicker">Ruling desk</p>
          <h1 className={styles.h1}>Sources disagree. A person signs.</h1>
          <p className={styles.lede}>
            These conflicts were raised by the Sanity Context Knowledge Base itself, when a newer source contradicted what it already said.
            The agent drafts a ruling; it cannot apply one. A reviewer approves, the ruling becomes a standing instruction for every later
            build, and the answer changes.
          </p>
          <p className={styles.counts}>
            <span>
              <b>{conflicts.length}</b> conflicts
            </span>
            <span>
              <b>{open}</b> open
            </span>
            <span>
              <b>{applied}</b> ruled
            </span>
          </p>
        </div>
      </header>
      <section className={`paper ${styles.list}`}>
        <div className="wrap">
          {failure ? <p className={styles.failure}>The Knowledge Base could not be read just now: {failure}</p> : null}
          {!failure && conflicts.length === 0 ? <p className={styles.failure}>No conflicts on record yet.</p> : null}
          <DeskClient conflicts={conflicts} />
        </div>
      </section>
    </main>
  )
}
