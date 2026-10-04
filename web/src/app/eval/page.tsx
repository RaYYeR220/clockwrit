import type {Metadata} from 'next'
import {evalSummary} from '@/lib/site'
import {ARMS} from './arms'
import {EvalTable} from './eval-table'
import styles from './eval.module.css'

export const metadata: Metadata = {
  title: 'Eval',
  description: 'Thirty held-out questions about legal time, answered by Clockwrit, by keyword search with the same model, and by the model alone.',
}

const QUESTIONS_PATH = 'eval/questions.jsonl'
const REPO = process.env.NEXT_PUBLIC_REPO_URL

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fmtDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export default function EvalPage() {
  const run = evalSummary()
  const key = REPO ? (
    <a href={`${REPO.replace(/\/$/, '')}/blob/main/${QUESTIONS_PATH}`}>
      <code>{QUESTIONS_PATH}</code>
    </a>
  ) : (
    <code>{QUESTIONS_PATH}</code>
  )

  return (
    <main>
      <header className={styles.head}>
        <div className="wrap">
          <p className="kicker">Evaluation</p>
          <h1 className={styles.h1}>Measured, not claimed.</h1>
          {run ? (
            <>
              <div className={styles.score}>
                {ARMS.map(({arm, label}) => {
                  const s = run.summary[arm]
                  if (!s) return null
                  return (
                    <div key={arm}>
                      <b>
                        {s.correct}
                        <small>/{run.total}</small>
                      </b>
                      <span>{label}</span>
                      <em>
                        traps {s.trapsCorrect}/{s.traps} · {s.incorrect} wrong · {s.abstained} abstained
                        {s.errors > 0 && ` · ${s.errors} errors`}
                      </em>
                    </div>
                  )
                })}
              </div>
              <dl className={styles.meta}>
                <div>
                  <dt>Answering model</dt>
                  <dd>{run.answerModel}</dd>
                </div>
                <div>
                  <dt>Judge</dt>
                  <dd>{run.judgeModel}</dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>
                    {run.total}, {run.split} split
                  </dd>
                </div>
                <div>
                  <dt>Asked as of</dt>
                  <dd>{fmtDate(run.today)}</dd>
                </div>
                <div>
                  <dt>Run</dt>
                  <dd>
                    {fmtDate(run.ranAt)}, {run.ranAt.slice(11, 16)} UTC
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className={styles.lede}>
              The held-out evaluation hasn’t been run on this deployment yet, so there are no scores to show. The runner is{' '}
              <code>pnpm --filter @wallclock/eval eval</code>.
            </p>
          )}
          <div className={styles.method}>
            <h2 className={styles.h2}>How it was measured</h2>
            <p>
              Forty questions were written from verified sources before the agent was built, each with an answer key and the computation behind it.
              Ten were used while developing the agent; the thirty held out are the ones scored here. The keyword arm and the no-tools arm use the
              same model as the agent: only what it can look up changes.
            </p>
            <p>
              The judge is a different model family from the one answering, grades each answer against the key alone and gives a one-line reason.
              Traps are questions where a stale library, a headline or a pending bill points to the wrong answer. Negative controls are questions
              where the obvious answer is the right one, so doubting everything doesn’t score. The questions, keys and trap reasons are in the repo:{' '}
              {key}.
            </p>
          </div>
        </div>
      </header>

      {run && run.rows.length > 0 && (
        <section className={`paper ${styles.list}`} aria-labelledby="questions-h">
          <div className="wrap">
            <h2 id="questions-h" className={styles.listH}>
              Every question, answer and verdict.
            </h2>
            <EvalTable rows={run.rows} />
          </div>
        </section>
      )}
    </main>
  )
}
