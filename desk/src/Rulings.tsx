import {type DocumentHandle, useAuthToken, useDocumentProjection, useDocuments} from '@sanity/sdk-react'
import {Suspense, useState} from 'react'

const API = import.meta.env.SANITY_APP_API_URL ?? 'https://clockwrit.vercel.app'

interface RulingProjection {
  _rev: string
  issueId: string
  question?: string
  claimKey?: string
  status: 'proposed' | 'approved' | 'rejected' | 'applied'
  proposedSide: number
  rationale?: string
  structuredCheck?: string
  reviewer?: string
  decidedAt?: string
  sides?: {index: number; value?: string; authority?: string; sourceTitles?: string[]}[]
}

const PROJECTION = `{_rev, issueId, question, claimKey, status, proposedSide, rationale, structuredCheck, reviewer, decidedAt,
  "sides": sides[]{index, value, authority, sourceTitles}}`

export function Rulings() {
  const {data, hasMore, loadMore} = useDocuments({documentType: 'ruling', orderings: [{field: 'proposedAt', direction: 'desc'}]})
  if (!data.length) return <p className="muted">No rulings yet. Draft one from the public desk.</p>
  return (
    <>
      <ul className="rulings">
        {data.map((handle) => (
          <Suspense key={handle.documentId} fallback={<li className="muted">…</li>}>
            <Ruling handle={handle} />
          </Suspense>
        ))}
      </ul>
      {hasMore ? (
        <button className="ghost" onClick={loadMore}>
          More
        </button>
      ) : null}
    </>
  )
}

function Ruling({handle}: {handle: DocumentHandle}) {
  const {data} = useDocumentProjection<RulingProjection>({...handle, projection: PROJECTION})
  const token = useAuthToken()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!data) return null

  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/rulings/decide`, {
        method: 'POST',
        headers: {'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {})},
        body: JSON.stringify({issueId: data.issueId, decision, note, expectedRev: data._rev, expectedSide: data.proposedSide}),
      })
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as {error?: string}).error ?? `Failed (${res.status})`)
    } catch {
      setError('The request failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="ruling" data-status={data.status}>
      <p className="kicker">
        {data.claimKey} · <b>{data.status}</b>
      </p>
      <h3>{data.question}</h3>
      <ol className="sides">
        {(data.sides ?? []).map((s) => (
          <li key={s.index} data-chosen={s.index === data.proposedSide || undefined}>
            <span className={`tier ${s.authority ?? ''}`}>{s.authority ?? 'unrated'}</span> {s.value}
            <small>{(s.sourceTitles ?? []).join(' · ')}</small>
          </li>
        ))}
      </ol>
      <p>{data.rationale}</p>
      {data.structuredCheck ? <p className="muted small">Dataset check: {data.structuredCheck}</p> : null}
      {data.status === 'proposed' || data.status === 'approved' ? (
        <div className="decide">
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <button onClick={() => decide('approve')} disabled={busy}>
            {busy ? 'Applying…' : 'Approve and apply'}
          </button>
          <button className="ghost" onClick={() => decide('reject')} disabled={busy}>
            Send back
          </button>
        </div>
      ) : (
        <p className="muted small">
          {data.status === 'applied' ? <span className="seal">RULED</span> : null} {data.reviewer ? `by ${data.reviewer}` : ''}{' '}
          {data.decidedAt ? `on ${data.decidedAt.slice(0, 16).replace('T', ' ')} UTC` : ''}
        </p>
      )}
      {error ? <p className="error">{error}</p> : null}
    </li>
  )
}
