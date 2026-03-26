import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Invoice } from '@/types/database'

/**
 * GET /api/invoices/export
 *
 * Exports the current user's invoices in the requested format.
 * Accepts the same filter params as the invoices list page:
 *   vendor, status, currency, dateFrom, dateTo
 *
 * format=csv  (default) — UTF-8 CSV with BOM for Excel compatibility
 * format=xlsx — prepared slot; returns 501 until exceljs is added
 * format=pdf  — prepared slot; returns 501 until pdfmake/pdf-lib is added
 *
 * Export never triggers AI analysis — it is a pure SELECT operation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const format = searchParams.get('format') ?? 'csv'

  // Stub future formats — architecture is in place, deps are pending
  if (format === 'xlsx' || format === 'pdf') {
    return NextResponse.json(
      {
        error: `${format.toUpperCase()} export is not yet implemented. Use format=csv.`,
        format,
        status: 501,
      },
      { status: 501 }
    )
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vendor = searchParams.get('vendor') ?? ''
  const status = searchParams.get('status') ?? ''
  const currency = searchParams.get('currency') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('invoices').select('*').eq('user_id', user.id)

  if (status) q = q.eq('status', status)
  if (currency) q = q.eq('currency', currency)
  if (vendor) q = q.ilike('vendor_name', `%${vendor}%`)
  if (dateFrom) q = q.gte('invoice_date', dateFrom)
  if (dateTo) q = q.lte('invoice_date', dateTo)

  q = q.order('created_at', { ascending: false })

  const { data, error } = await q
  if (error || !data) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const invoices = data as Invoice[]

  const headers = [
    'ID',
    'Vendor',
    'Vendor Tax ID',
    'Invoice No.',
    'Date',
    'Subtotal',
    'Tax',
    'Total',
    'Currency',
    'Tax Rate',
    'Status',
    'AI Confidence',
    'Notes',
    'Created',
  ]

  function esc(val: string | number | null | undefined): string {
    const s = val == null ? '' : String(val)
    return `"${s.replace(/"/g, '""')}"`
  }

  const rows = invoices.map((inv) => [
    esc(inv.id),
    esc(inv.vendor_name),
    esc(inv.vendor_tax_id),
    esc(inv.invoice_number),
    esc(inv.invoice_date),
    esc(inv.subtotal_cents != null ? (inv.subtotal_cents / 100).toFixed(2) : null),
    esc(inv.tax_cents != null ? (inv.tax_cents / 100).toFixed(2) : null),
    esc(inv.total_cents != null ? (inv.total_cents / 100).toFixed(2) : null),
    esc(inv.currency),
    esc(inv.tax_rate != null ? (inv.tax_rate * 100).toFixed(0) + '%' : null),
    esc(inv.status),
    esc(inv.ai_confidence != null ? Math.round(inv.ai_confidence * 100) + '%' : null),
    esc(inv.notes),
    esc(inv.created_at),
  ])

  const csv =
    '\uFEFF' + // BOM for Excel UTF-8 compatibility
    [headers.map((h) => esc(h)), ...rows].map((row) => row.join(',')).join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoices-${date}.csv"`,
    },
  })
}
