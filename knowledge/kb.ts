// Creates the Knowledge Base, imports the original sources and builds it.
// Sources live in knowledge/sources/*.md with front matter: title, url, authority, kind.
// Usage: SANITY_ORGANIZATION_ID=... SANITY_CONTEXT_TOKEN=... pnpm --filter @wallclock/knowledge kb <create|import [A|B]|build|status|issues>
import {createClient} from '@sanity/client'
import {readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

const orgId = process.env.SANITY_ORGANIZATION_ID!
const token = process.env.SANITY_CONTEXT_TOKEN!
const apiVersion = '2026-09-01'

const PURPOSE = `Legal civil time and civil calendars, as stated by the original sources: statutes, decrees, government announcements, IANA tzdata release notes, vendor notices and news.
For each jurisdiction: what UTC offset and daylight-saving rules apply and since when, which instrument made the change, whether it is in force, enacted-but-not-effective, conditional or only proposed; and which days are public holidays, rest days or working days.
Keep claims attributed to their source. Where sources disagree (a news headline vs. the unsigned bill, the legal date vs. the date tzdata models, a calculated date vs. the announced one), keep both claims visible.`

function orgClient() {
  return createClient({apiVersion, token, useProjectHostname: false, context: {organizationId: orgId}} as Parameters<typeof createClient>[0])
}
function kbClient(kb: string) {
  return createClient({
    apiVersion,
    token,
    useProjectHostname: false,
    resource: {type: 'knowledge-base', id: kb},
    context: {organizationId: orgId},
  } as Parameters<typeof createClient>[0])
}

interface Source {
  file: string
  title: string
  url?: string
  authority?: string
  phase?: string
  body: string
}

function readSources(): Source[] {
  const dir = join(import.meta.dirname, 'sources')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8')
      const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw)
      const meta = Object.fromEntries((fm?.[1] ?? '').split('\n').map((l) => [l.split(':')[0]!.trim(), l.slice(l.indexOf(':') + 1).trim()]))
      return {file, title: meta.title ?? file, url: meta.url, authority: meta.authority, phase: meta.phase, body: raw.slice(fm?.[0].length ?? 0)}
    })
}

async function main() {
  const [cmd = 'status'] = process.argv.slice(2)
  const kbId = process.env.SANITY_KNOWLEDGE_BASE_ID
  // The client's Context API is marked beta; keep the surface we use typed loosely.
  type Ctx = {context: Record<string, Record<string, (...a: unknown[]) => Promise<unknown>> & ((...a: unknown[]) => Promise<unknown>)>}

  if (cmd === 'create') {
    const kb = (await (orgClient() as unknown as Ctx).context.knowledgeBases!.create!({organizationId: orgId, title: 'Clockwrit — legal time & calendars', description: PURPOSE})) as {publicId: string; id: string}
    console.log('created', kb)
    writeFileSync(join(import.meta.dirname, '.kb-id'), kb.publicId)
    return
  }
  if (!kbId) throw new Error('Set SANITY_KNOWLEDGE_BASE_ID')
  const kb = kbClient(kbId) as unknown as Ctx

  if (cmd === 'import') {
    // Phase A (the law and references) is built first; phase B (news, vendors, libraries) is fed in afterwards,
    // so the rebuild files the disagreements as issues instead of silently blending them.
    const phase = process.argv[3]
    for (const s of readSources().filter((x) => !phase || x.phase === phase)) {
      const header = `Source: ${s.title}\nURL: ${s.url ?? 'n/a'}\nAuthority tier: ${s.authority ?? 'unknown'}\n\n`
      const job = await kb.context.imports!.create!({type: 'text', title: s.title.slice(0, 200), content: header + s.body, contentType: 'text/markdown'})
      console.log('import', s.file, job)
    }
    return
  }
  if (cmd === 'crawl') {
    const url = process.argv[3]
    if (!url) throw new Error('usage: kb crawl <url>')
    console.log(await kb.context.imports!.create!({type: 'crawl', url, options: {pageLimit: 1, maxDepth: 0}}))
    return
  }
  if (cmd === 'build') {
    console.log(await (kb.context.build as unknown as () => Promise<unknown>)())
    return
  }
  if (cmd === 'status') {
    const meta = await (orgClient() as unknown as Ctx).context.knowledgeBases!.get!({knowledgeBaseId: kbId}).catch((e: Error) => ({error: e.message}))
    console.log(JSON.stringify(meta, null, 2).slice(0, 3000))
    return
  }
  if (cmd === 'issues') {
    const issues = (await kb.context.issues!.list!({})) as unknown[]
    console.log(JSON.stringify(issues, null, 2).slice(0, 12000))
    return
  }
  throw new Error(`unknown command ${cmd}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
