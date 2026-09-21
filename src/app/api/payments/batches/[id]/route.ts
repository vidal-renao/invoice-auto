import { NextResponse, type NextRequest } from 'next/server'

import { getBatchXml } from '@/lib/payments/repository'
import { createClient } from '@/lib/supabase/server'

/**
 * Downloads a generated pain.001 file. RLS limits the read to the owner;
 * the UUID check keeps malformed ids away from the database.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })

  const batch = await getBatchXml(supabase, user.id, id)
  if (!batch) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return new NextResponse(batch.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${batch.message_id}.xml"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
