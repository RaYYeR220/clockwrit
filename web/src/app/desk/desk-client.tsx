'use client'

import Link from 'next/link'
import {useState} from 'react'
import type {RulingDoc, RulingView} from '@/lib/rulings'
import styles from './desk.module.css'

const TIER_MARK = {primary: '§', secondary: '†', community: '‡'} as const

export function DeskClient({conflicts}: {conflicts: RulingView[]}) {
  const [items, setItems] = useState(conflicts)
  const update = (issueId: string, patch: Partial<RulingView>) =>
    setItems((xs) => xs.map((x) => (x.issueId === issueId ? {...x, ...patch} : x)))
  return (
    <div className={styles.conflicts}>
      {items.map((c) => (
        <Conflict key={c.issueId} c={c} onChange={(p) => update(c.issueId, p)} />
      ))}
    </div>
  )
}

function Conflict({c, onChange}: {c: RulingView; onChange: (p: Partial<RulingView>) => void}) {
  const [busy, setBusy] = useState<'draft' | 'decide' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewer, setReviewer] = useState('')
  const [passcode, setPasscode] = useState('')
  const [note, setNote] = useState('')
  const r = c.ruling

  const draft = async () => {
    setBusy('draft')
    setError(null)
    const res = await fetch('/api/rulings/draft', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({issueId: c.issueId})})
    const body = (await res.json()) as {ruling?: RulingDoc; error?: string}
    setBusy(null)
    if (!res.ok || !body.ruling) return setError(body.error ?? 'Draft failed')
    // Re-read so we hold the revision the reviewer will be approving.
    const fresh = await fetch('/api/rulings', {cache: 'no-store'}).then((x) => x.json() as Promise<{conflicts: RulingView[]}>)
    onChange({ruling: fresh.conflicts.find((x) => x.issueId === c.issueId)?.ruling ?? body.ruling})
  }

  const decide = async (decision: 'approve' | 'reject') => {
    if (!r?._rev) return
    setBusy('decide')
    setError(null)
    const res = await fetch('/api/rulings/decide', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({issueId: c.issueId, decision, reviewer, note, passcode, expectedRev: r._rev, expectedSide: r.proposedSide}),
    })
    const body = (await res.json()) as {ruling?: RulingDoc; error?: string}
    setBusy(null)
    if (!res.ok || !body.ruling) return setError(body.error ?? 'Decision failed')
    onChange({ruling: body.ruling, status: decision === 'approve' ? 'accepted' : c.status})
  }

  const ruled = r?.status === 'applied'
  return (
    <article className={styles.conflict} data-ruled={ruled || undefined}>
      <header className={styles.conflictHead}>
        <p className="kicker">
          {c.severity ?? 'conflict'} · {c.claimKey}
        </p>
        <h2 className={styles.question}>{r?.question ?? c.issue}</h2>
        {r?.question && c.issue ? <p className={styles.issue}>{c.issue}</p> : null}
      </header>

      <div className={styles.sides}>
        {c.sides.map((s) => {
          const chosen = r && r.proposedSide === s.index
          return (
            <section key={s.index} className={styles.side} data-chosen={chosen || undefined} data-lost={(r && !chosen) || undefined}>
              <p className={styles.sideHead}>
                <span className={`chip ${s.authority ?? 'secondary'}`}>
                  {TIER_MARK[s.authority ?? 'secondary']} {s.authority ?? 'unrated'}
                </span>
                <span>Side {s.index + 1}</span>
              </p>
              {s.value ? <p className={styles.value}>{s.value}</p> : null}
              <p className={styles.claim}>{s.claim}</p>
              {s.quote ? <blockquote className={styles.quote}>{s.quote}</blockquote> : null}
              <p className={styles.sources}>{s.sourceTitles.join(' · ')}</p>
            </section>
          )
        })}
      </div>

      {!r ? (
        <div className={styles.actions}>
          <button className="btn" onClick={draft} disabled={busy !== null || c.status !== 'open'}>
            {busy === 'draft' ? 'The agent is reading both sides…' : 'Ask the agent to draft a ruling'}
          </button>
        </div>
      ) : (
        <div className={styles.ruling}>
          <div className={styles.rationale}>
            <p className="kicker">
              Draft by {r.proposedBy?.replace('agent:', '') ?? 'the agent'} · side {r.proposedSide + 1}
            </p>
            <p>{r.rationale}</p>
            {r.structuredCheck ? (
              <p className={styles.check}>
                <b>Checked against the dataset:</b> {r.structuredCheck}
              </p>
            ) : null}
          </div>
          {r.status === 'proposed' ? (
            <form
              className={styles.approve}
              onSubmit={(e) => {
                e.preventDefault()
                void decide('approve')
              }}
            >
              <label>
                <span>Your name</span>
                <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer" maxLength={80} />
              </label>
              <label>
                <span>Reviewer passcode</span>
                <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required autoComplete="off" />
              </label>
              <label className={styles.wide}>
                <span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </label>
              <div className={styles.buttons}>
                <button className="btn" type="submit" disabled={busy !== null}>
                  {busy === 'decide' ? 'Applying…' : 'Approve and apply'}
                </button>
                <button className="btn ghost" type="button" disabled={busy !== null} onClick={() => void decide('reject')}>
                  Send back
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.verdict}>
              {ruled ? (
                <span className={styles.seal} aria-label="Ruled">
                  RULED
                </span>
              ) : null}
              <p>
                {r.status === 'rejected' ? 'Sent back' : 'Approved'} by <b>{r.reviewer}</b>
                {r.decidedAt ? ` on ${r.decidedAt.slice(0, 16).replace('T', ' ')} UTC` : ''}.
                {ruled ? ' The Knowledge Base now carries this as a standing instruction for every rebuild.' : ''}
              </p>
              {r.reviewNote ? <p className={styles.issue}>“{r.reviewNote}”</p> : null}
              {ruled && r.question ? (
                <Link className="btn ghost" href={`/ask?q=${encodeURIComponent(r.question)}`}>
                  Ask it again
                </Link>
              ) : null}
            </div>
          )}
        </div>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </article>
  )
}
