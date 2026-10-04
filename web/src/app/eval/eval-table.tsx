'use client'

import {useState, type ReactNode} from 'react'
import type {EvalRow} from '@/lib/site'
import {ARMS} from './arms'
import styles from './eval.module.css'

type Filter = 'all' | 'traps' | 'split' | 'agent'

const LIST_ITEM = /^\s*[-*] /

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

/** Answers come back as light markdown: paragraphs, "- " lists, **bold**, *italic* and `code`. Nothing else is interpreted. */
function Answer({text}: {text: string}) {
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{para.flatMap((l, i) => (i ? [<br key={`br${i}`} />, ...inline(l)] : inline(l)))}</p>)
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      )
    para = []
    list = []
  }
  for (const line of text.trim().split('\n')) {
    if (!line.trim()) flush()
    else if (LIST_ITEM.test(line)) {
      if (para.length) flush()
      list.push(line.replace(LIST_ITEM, ''))
    } else {
      if (list.length) flush()
      para.push(line)
    }
  }
  flush()
  return <div className={styles.answer}>{blocks}</div>
}

const FILTERS: {id: Filter; label: string; title?: string; test: (r: EvalRow) => boolean}[] = [
  {id: 'all', label: 'All', test: () => true},
  {id: 'traps', label: 'Traps', test: (r) => r.trap},
  {id: 'split', label: 'Arms disagree', test: (r) => new Set(ARMS.filter((a) => r.arms[a.arm]).map((a) => r.arms[a.arm]!.verdict)).size > 1},
  {
    id: 'agent',
    label: 'Agent wrong',
    title: 'Clockwrit answered incorrectly, abstained or errored',
    test: (r) => Boolean(r.arms.agent) && r.arms.agent!.verdict !== 'correct',
  },
]

export function EvalTable({rows}: {rows: EvalRow[]}) {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = rows.filter(FILTERS.find((f) => f.id === filter)!.test)
  return (
    <>
      <div className={styles.filters} role="group" aria-label="Filter questions">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} title={f.title} onClick={() => setFilter(f.id)}>
            {f.label} <span>{rows.filter(f.test).length}</span>
          </button>
        ))}
      </div>
      <p className={styles.showing} aria-live="polite">
        {visible.length ? `Showing ${visible.length} of ${rows.length} questions.` : 'No question matches this filter.'}
      </p>
      <ol className={styles.questions}>
        {visible.map((r) => (
          <li key={r.id} className={styles.q}>
            <div className={styles.qhead}>
              <p className={styles.qmeta}>
                <span>{r.id}</span>
                <span>{r.category}</span>
                {r.trap && <span className={styles.trap}>Trap</span>}
              </p>
              <h3 className={styles.qtext}>{r.question}</h3>
              <p className={styles.key}>
                <span>Key</span>
                {r.key}
              </p>
            </div>
            <div className={styles.arms}>
              {ARMS.map(({arm, short}) => {
                const a = r.arms[arm]
                if (!a) return null
                return (
                  <div key={arm} className={styles.arm} data-verdict={a.verdict}>
                    <p className={styles.armHead}>
                      <span>{short}</span>
                      <span className={styles.verdict}>{a.verdict}</span>
                    </p>
                    {a.error ? (
                      <p className={styles.answer}>Error: {a.error}</p>
                    ) : a.answer ? (
                      <Answer text={a.answer} />
                    ) : (
                      <p className={styles.answer}>(no answer)</p>
                    )}
                    {a.reason && (
                      <p className={styles.reason}>
                        <span>Judge</span> {a.reason}
                      </p>
                    )}
                    {a.retrieved && a.retrieved.length > 0 && (
                      <p className={styles.trace}>
                        <span>Retrieved</span>
                        {a.retrieved.map((id, i) => (
                          <code key={`${id}-${i}`}>{id}</code>
                        ))}
                      </p>
                    )}
                    {a.tools && (
                      <p className={styles.trace}>
                        <span>Tools</span>
                        {a.tools.length ? a.tools.map((t, i) => <code key={`${t}-${i}`}>{t}</code>) : <em>none called</em>}
                      </p>
                    )}
                    <p className={styles.ms}>{(a.ms / 1000).toFixed(1)} s</p>
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
