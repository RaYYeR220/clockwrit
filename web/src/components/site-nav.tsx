import Link from 'next/link'
import styles from './site-nav.module.css'

const LINKS = [
  {href: '/ask', label: 'Ask'},
  {href: '/desk', label: 'Ruling desk'},
  {href: '/audit', label: 'Audit'},
  {href: '/drift', label: 'Drift'},
  {href: '/eval', label: 'Eval'},
]

export function SiteNav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <Link href="/" className={styles.brand}>
        Clockwrit
      </Link>
      <div className={styles.links}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
