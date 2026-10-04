import {Fragment, type ReactNode} from 'react'

/** Minimal, safe rendering of the agent's markdown: paragraphs, bullet lists, **bold**, `code` and [links](https://…). */
export function Prose({text}: {text: string}) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*[-*] /.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, k) => (
                <li key={k}>{inline(l.replace(/^\s*[-*] /, ''))}</li>
              ))}
            </ul>
          )
        const heading = /^#{1,4} (.*)$/.exec(b)
        if (heading) return <h3 key={i}>{inline(heading[1]!)}</h3>
        return (
          <p key={i}>
            {lines.map((l, k) => (
              <Fragment key={k}>
                {k ? <br /> : null}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g
  let last = 0
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={m.index}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={m.index}>{t.slice(1, -1)}</code>)
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!
      out.push(
        <a key={m.index} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>,
      )
    }
    last = m.index! + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}
