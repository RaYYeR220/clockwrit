import {useActiveReleases} from '@sanity/sdk-react'

export function PendingLaws() {
  const releases = useActiveReleases()
  if (!releases.length) return <p className="muted">No pending laws.</p>
  return (
    <ul className="laws">
      {releases.map((r) => (
        <li key={r._id}>
          <b>{r.metadata.title}</b>
          {r.metadata.description ? <p className="muted small">{r.metadata.description}</p> : null}
        </li>
      ))}
    </ul>
  )
}
