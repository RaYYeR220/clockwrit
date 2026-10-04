import {type SanityConfig} from '@sanity/sdk'
import {SanityApp} from '@sanity/sdk-react'
import {Suspense} from 'react'
import {PendingLaws} from './PendingLaws'
import {Rulings} from './Rulings'
import './App.css'

const config: SanityConfig[] = [{projectId: 'c9x90tjo', dataset: 'production'}]

function App() {
  return (
    <SanityApp config={config} fallback={<p className="muted pad">Loading…</p>}>
      <main className="desk">
        <header className="head">
          <p className="kicker">Clockwrit · ruling desk</p>
          <h1>Sources disagree. You sign.</h1>
          <p className="lede">
            Rulings the agent drafted on Knowledge Base conflicts. Approving here signs the decision with your Sanity identity, resolves the
            conflict in the Knowledge Base, and makes it a standing instruction for every later build.
          </p>
        </header>
        <div className="cols">
          <section>
            <h2>Rulings</h2>
            <Suspense fallback={<p className="muted">Loading rulings…</p>}>
              <Rulings />
            </Suspense>
          </section>
          <aside>
            <h2>Pending laws</h2>
            <p className="muted small">Each pending or conditional law is a Content Release: the agent can answer as if it had passed.</p>
            <Suspense fallback={<p className="muted">Loading releases…</p>}>
              <PendingLaws />
            </Suspense>
          </aside>
        </div>
      </main>
    </SanityApp>
  )
}

export default App
