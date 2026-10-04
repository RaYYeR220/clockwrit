import {draftRuling} from '@/lib/rulings'
import {rateLimit} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(req: Request) {
  if (!rateLimit(req, 'draft', 6, 10 * 60_000)) return Response.json({error: 'Too many drafts, try again later'}, {status: 429})
  const {issueId} = (await req.json().catch(() => ({}))) as {issueId?: string}
  if (!issueId) return Response.json({error: 'issueId required'}, {status: 400})
  try {
    return Response.json({ruling: await draftRuling(issueId)})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 409})
  }
}
