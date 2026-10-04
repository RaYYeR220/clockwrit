import {workingDay} from '@/lib/tools'

export const runtime = 'nodejs'

/** GET /api/day?jurisdiction=PL&date=2026-12-24 */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const jurisdiction = u.searchParams.get('jurisdiction')
  const date = u.searchParams.get('date')
  if (!jurisdiction || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({error: 'jurisdiction and date (YYYY-MM-DD) required'}, {status: 400})
  try {
    const r = await workingDay({jurisdiction, date, scenario: u.searchParams.get('scenario') ?? undefined})
    return Response.json(r, {headers: {'cache-control': 'public, s-maxage=60'}})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 400})
  }
}
