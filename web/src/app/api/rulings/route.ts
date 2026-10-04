import {listRulings} from '@/lib/rulings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return Response.json({conflicts: await listRulings()})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 502})
  }
}
