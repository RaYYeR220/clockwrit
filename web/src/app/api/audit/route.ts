import {eventsFromIcs} from '@wallclock/core'
import {rateLimit} from '@/lib/rate-limit'
import {auditFor} from '@/lib/tools'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ICS_BYTES = 256 * 1024

/** POST {ics?: string, events?: [...], participants: [...], from, to, scenario?} */
export async function POST(req: Request) {
  if (!rateLimit(req, 'audit', 30, 10 * 60_000)) return Response.json({error: 'Rate limited'}, {status: 429})
  const raw = await req.text()
  if (raw.length > MAX_ICS_BYTES + 16 * 1024) return Response.json({error: 'Request too large'}, {status: 413})
  let body: {
    ics?: string
    defaultZone?: string
    events?: {title: string; start: string; zone: string; rrule?: string}[]
    participants?: {label: string; zone: string; jurisdiction: string}[]
    from?: string
    to?: string
    scenario?: string
  }
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({error: 'Invalid JSON'}, {status: 400})
  }
  try {
    const events = body.ics ? eventsFromIcs(body.ics, body.defaultZone).slice(0, 20) : (body.events ?? []).slice(0, 20)
    if (!events.length) return Response.json({error: 'No events'}, {status: 400})
    const result = await auditFor({
      events,
      participants: (body.participants ?? []).slice(0, 20),
      from: body.from ?? new Date().toISOString().slice(0, 10),
      to: body.to ?? new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10),
      scenario: body.scenario,
    })
    return Response.json({events, ...result})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 400})
  }
}
