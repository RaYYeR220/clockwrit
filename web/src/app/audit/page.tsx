import type {Metadata} from 'next'
import {contentClient} from '@/lib/sanity'
import {Auditor, type AuditOptions} from './auditor'
import styles from './audit.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Schedule auditor',
  description: 'Check every occurrence of a recurring meeting against the law in force in each participant’s zone and calendar.',
}

const OPTIONS_QUERY = `{
  "zones": *[_type == "zone"] | order(ianaId asc) {ianaId, city},
  "jurisdictions": *[_type == "jurisdiction"] | order(code asc) {
    code, name, "calendar": count(*[_type == "weekendRegime" && references(^._id)]) > 0
  }
}`

export default async function AuditPage() {
  const options = await contentClient().fetch<AuditOptions>(OPTIONS_QUERY)
  return (
    <main>
      <header className={styles.head}>
        <div className="wrap">
          <p className="kicker">Schedule auditor</p>
          <h1 className={styles.h1}>Every occurrence, read by the law.</h1>
          <p className={styles.lede}>
            Paste a calendar or describe one recurring meeting. Each occurrence is placed by the law in force in the organiser’s zone, then read in
            every participant’s zone and calendar: local times that never happen or happen twice, runtimes that will put it at the wrong instant,
            holidays and rest days.
          </p>
        </div>
      </header>
      <Auditor options={options} />
    </main>
  )
}
