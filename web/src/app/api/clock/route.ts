import {legalTime} from '@/lib/tools'

export const runtime = 'nodejs'

/** GET /api/clock?zone=America/Winnipeg&at=2026-11-02T18:00:00Z  (or &local=2026-11-02T12:00) */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const zone = u.searchParams.get('zone')
  if (!zone || zone.length > 64) return Response.json({error: 'zone required'}, {status: 400})
  try {
    const r = await legalTime({
      zone,
      at: u.searchParams.get('at') ?? undefined,
      local: u.searchParams.get('local') ?? undefined,
      scenario: u.searchParams.get('scenario') ?? undefined,
    })
    return Response.json(r, {headers: {'cache-control': 'public, s-maxage=60'}})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 400})
  }
}
