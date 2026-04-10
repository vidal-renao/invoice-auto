import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Invoice } from '@/types/database'

/**
 * GET /api/invoices/export
 *
 * Exports invoices in the requested format.
 * Accepts the same filter params as the invoices list:
 *   vendor, status, currency, dateFrom, dateTo
 *
 * format=csv  — UTF-8 CSV with BOM for Excel compatibility
 * format=xlsx — Excel workbook via exceljs
 * format=pdf  — not yet implemented (501)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const format = searchParams.get('format') ?? 'csv'

  if (format === 'pdf') {
    return NextResponse.json(
      { error: 'PDF export is not yet implemented.', status: 501 },
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
  const date = new Date().toISOString().slice(0, 10)

  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Invoice Auto'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Invoices')

    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Vendor', key: 'vendor', width: 30 },
      { header: 'Vendor Tax ID', key: 'vendorTaxId', width: 20 },
      { header: 'Invoice No.', key: 'invoiceNumber', width: 20 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Tax', key: 'tax', width: 14 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Tax Rate', key: 'taxRate', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'AI Confidence', key: 'confidence', width: 16 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Created', key: 'created', width: 22 },
    ]

    // Header row styling
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
    headerRow.height = 22

    for (const inv of invoices) {
      sheet.addRow({
        id: inv.id,
        vendor: inv.vendor_name ?? '',
        vendorTaxId: inv.vendor_tax_id ?? '',
        invoiceNumber: inv.invoice_number ?? '',
        date: inv.invoice_date ?? '',
        subtotal: inv.subtotal_cents != null ? inv.subtotal_cents / 100 : null,
        tax: inv.tax_cents != null ? inv.tax_cents / 100 : null,
        total: inv.total_cents != null ? inv.total_cents / 100 : null,
        currency: inv.currency ?? '',
        taxRate: inv.tax_rate != null ? inv.tax_rate : null,
        status: inv.status ?? '',
        confidence: inv.ai_confidence != null ? Math.round(inv.ai_confidence * 100) / 100 : null,
        notes: inv.notes ?? '',
        created: inv.created_at ?? '',
      })
    }

    // Number format for amount columns (E=subtotal, F=tax, G=total)
    ;['subtotal', 'tax', 'total'].forEach((key) => {
      sheet.getColumn(key).numFmt = '#,##0.00'
    })
    sheet.getColumn('taxRate').numFmt = '0%'
    sheet.getColumn('confidence').numFmt = '0%'

    // Alternate row background
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F3FF' },
          }
        })
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="invoices-${date}.xlsx"`,
      },
    })
  }

  // ── CSV ─────────────────────────────────────────────────────────────────
  const headers = [
    'ID', 'Vendor', 'Vendor Tax ID', 'Invoice No.', 'Date',
    'Subtotal', 'Tax', 'Total', 'Currency', 'Tax Rate',
    'Status', 'AI Confidence', 'Notes', 'Created',
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
    '\uFEFF' +
    [headers.map((h) => esc(h)), ...rows].map((row) => row.join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoices-${date}.csv"`,
    },
  })
}
