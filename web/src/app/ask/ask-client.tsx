'use client'

import {useChat} from '@ai-sdk/react'
import {DefaultChatTransport, type UIMessage} from 'ai'
import {useEffect, useRef, useState} from 'react'
import {DayCard, EvidenceRow, TimeCard, type DayResult, type TimeResult} from './cards'
import {Prose} from './prose'
import styles from './ask.module.css'

interface Scenario {
  id: string
  title: string
  description?: string
}

type Part = UIMessage['parts'][number]
type ToolPart = Extract<Part, {toolCallId: string}> & {toolName?: string; input?: unknown; output?: unknown; state: string}

function toolName(p: ToolPart): string {
  return p.type === 'dynamic-tool' ? (p.toolName ?? 'tool') : p.type.replace(/^tool-/, '')
}

export function AskClient({scenarios, suggestions, initialQuestion = ''}: {scenarios: Scenario[]; suggestions: string[]; initialQuestion?: string}) {
  const [scenario, setScenario] = useState('')
  const [draft, setDraft] = useState(initialQuestion)
  const {messages, sendMessage, status, error, stop} = useChat({transport: new DefaultChatTransport({api: '/api/agent'})})
  const endRef = useRef<HTMLDivElement>(null)
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    endRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
  }, [messages])

  const ask = (text: string) => {
    if (!text.trim() || busy) return
    void sendMessage({text: text.trim()}, {body: {scenario: scenario || undefined}})
    setDraft('')
  }

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <div className="wrap">
          <p className="kicker">Ask</p>
          <h1 className={styles.h1}>What time is it, legally?</h1>
          <div className={styles.controls}>
            <label className={styles.scenario}>
              <span>Answer under</span>
              <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                <option value="">the law in force today</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            {scenario ? (
              <p className={styles.scenarioNote}>Pending laws are Content Releases: the agent reads the dataset as if this one had been published.</p>
            ) : null}
          </div>
        </div>
      </header>

      <section className={`paper ${styles.thread}`} aria-live="polite">
        <div className="wrap">
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <p className="kicker">Try one</p>
              <ul className={styles.suggestions}>
                {suggestions.map((s) => (
                  <li key={s}>
                    <button onClick={() => ask(s)}>{s}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {messages.map((m) => (
            <article key={m.id} className={m.role === 'user' ? styles.user : styles.assistant}>
              {m.parts.map((p, i) => {
                if (p.type === 'text') return m.role === 'user' ? <p key={i}>{p.text}</p> : <Prose key={i} text={p.text} />
                if (!('toolCallId' in p)) return null
                const t = p as ToolPart
                const name = toolName(t)
                if (t.state === 'output-available' && name === 'legal_time') return <TimeCard key={i} r={t.output as TimeResult} />
                if (t.state === 'output-available' && name === 'working_day') return <DayCard key={i} r={t.output as DayResult} />
                return <EvidenceRow key={i} name={name} input={t.input} state={t.state} output={t.output} />
              })}
            </article>
          ))}

          {status === 'submitted' ? <p className={styles.thinking}>Reading the law…</p> : null}
          {error ? <p className={styles.error}>Something failed: {error.message}</p> : null}
          <div ref={endRef} />
        </div>
      </section>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault()
          ask(draft)
        }}
      >
        <div className={`wrap ${styles.composerInner}`}>
          <label htmlFor="q" className={styles.srOnly}>
            Your question
          </label>
          <textarea
            id="q"
            rows={2}
            value={draft}
            placeholder="Ask about any time, place or date…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(draft)
              }
            }}
          />
          {busy ? (
            <button type="button" className="btn ghost" onClick={() => stop()}>
              Stop
            </button>
          ) : (
            <button type="submit" className="btn" disabled={!draft.trim()}>
              Ask
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
