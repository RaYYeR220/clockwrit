// Loads the reviewed dataset (knowledge/dataset/*.json) into Sanity.
// References are written as ids in the JSON and expanded here; pending laws become Content Releases.
// Usage: SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... pnpm --filter @wallclock/knowledge seed [--dry]
import {createClient, type SanityDocumentStub} from '@sanity/client'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const dir = join(import.meta.dirname, 'dataset')
const dry = process.argv.includes('--dry')

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET ?? 'production',
  apiVersion: '2026-09-01',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
})

type Raw = Record<string, unknown> & {_id: string}

function load(name: string): Raw[] {
  const f = join(dir, `${name}.json`)
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Raw[]) : []
}

const ref = (id: string) => ({_type: 'reference', _ref: id})
const refs = (ids: unknown) =>
  ((ids as string[] | undefined) ?? []).map((id) => ({_type: 'reference', _ref: id, _key: id.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}))
const keyed = <T extends object>(xs: T[] | undefined) => (xs ?? []).map((x, i) => ({_key: `k${i}`, ...x}))

const REF_FIELDS: Record<string, string[]> = {
  jurisdiction: ['parent'],
  zone: ['jurisdiction'],
  instrument: ['jurisdiction'],
  ruleSegment: ['zone'],
  holiday: ['jurisdiction'],
  weekendRegime: ['jurisdiction'],
  workdayOverride: ['jurisdiction'],
  holidaySuspension: ['jurisdiction'],
}
const REF_ARRAYS: Record<string, string[]> = {
  instrument: ['supersedes'],
  ruleSegment: ['basis'],
  holiday: ['basis'],
  weekendRegime: ['basis'],
  workdayOverride: ['basis'],
  holidaySuspension: ['basis'],
}

export function toDocument(type: string, raw: Raw): SanityDocumentStub & {_id: string} {
  if (raw._id.includes('.')) throw new Error(`${raw._id}: dots in ids hide documents from public queries`)
  const doc: Record<string, unknown> = {...raw, _type: type}
  for (const f of REF_FIELDS[type] ?? []) if (typeof doc[f] === 'string') doc[f] = ref(doc[f] as string)
  for (const f of REF_ARRAYS[type] ?? []) if (doc[f]) doc[f] = refs(doc[f])
  if (type === 'instrument' && Array.isArray(doc.quotes)) doc.quotes = keyed(doc.quotes as object[]).map((q) => ({_type: 'quote', ...q}))
  if (type === 'ruleSegment' && doc.dst) {
    const d = doc.dst as Record<string, unknown>
    doc.dst = {...d, start: {_type: 'transitionRule', ...(d.start as object)}, end: {_type: 'transitionRule', ...(d.end as object)}}
  }
  return doc as SanityDocumentStub & {_id: string}
}

const ORDER = ['jurisdiction', 'zone', 'instrument', 'ruleSegment', 'holiday', 'weekendRegime', 'workdayOverride', 'holidaySuspension'] as const
const FILES: Record<(typeof ORDER)[number], string> = {
  jurisdiction: 'jurisdictions',
  zone: 'zones',
  instrument: 'instruments',
  ruleSegment: 'segments',
  holiday: 'holidays',
  weekendRegime: 'weekends',
  workdayOverride: 'overrides',
  holidaySuspension: 'suspensions',
}

interface ReleaseSpec {
  id: string
  title: string
  description: string
  documents: {type: (typeof ORDER)[number]; doc: Raw}[]
}

async function main() {
  const docs = ORDER.flatMap((type) => load(FILES[type]).map((raw) => toDocument(type, raw)))
  const ids = new Set(docs.map((d) => d._id))
  // Every reference must resolve inside the dataset — catch typos before they become dangling links.
  for (const d of docs) {
    for (const r of JSON.stringify(d).matchAll(/"_ref":"([^"]+)"/g)) {
      if (!ids.has(r[1]!)) throw new Error(`${d._id} references missing ${r[1]}`)
    }
  }
  console.log(`${docs.length} documents`, Object.fromEntries(ORDER.map((t) => [t, docs.filter((d) => d._type === t).length])))
  if (dry) return

  for (let i = 0; i < docs.length; i += 100) {
    const tx = client.transaction()
    for (const d of docs.slice(i, i + 100)) tx.createOrReplace(d)
    await tx.commit({visibility: 'async'})
  }
  console.log('published documents written')

  const releasesFile = join(dir, 'releases.json')
  if (!existsSync(releasesFile)) return
  const releases = JSON.parse(readFileSync(releasesFile, 'utf8')) as ReleaseSpec[]
  for (const r of releases) {
    const existing = await client.fetch<string | null>(`releases::all()[name == $id][0].name`, {id: r.id})
    if (!existing) await client.releases.create({releaseId: r.id, metadata: {title: r.title, description: r.description, releaseType: 'undecided'}})
    // A version is the document as it would read once the release is published; writing it by its full id keeps reruns idempotent.
    const tx = client.transaction()
    for (const {type, doc} of r.documents) {
      const document = toDocument(type, doc)
      tx.createOrReplace({...document, _id: `versions.${r.id}.${document._id}`})
    }
    await tx.commit()
    console.log(`release ${r.id}: ${r.documents.length} versions`)
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('seed.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
