import { NextResponse } from 'next/server'

import { businessToday } from '@/lib/payments/dates'
import { buildDemoPaymentFile } from '@/lib/payments/demo'

/**
 * Public sample of the payment file, built from the fictitious demo data.
 * No database, no session: it cannot expose anyone's information.
 */
export function GET() {
  const now = new Date()
  const today = businessToday(now)
  return new NextResponse(buildDemoPaymentFile(now, today), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="demo-pain001-${today}.xml"`,
      'Cache-Control': 'no-store',
    },
  })
}
