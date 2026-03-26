'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { typedFrom } from '@/lib/supabase/builder'
import type { Invoice, InvoiceInsert, InvoiceStatus } from '@/types/database'
import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete an invoice record and its associated Storage file.
 *
 * Storage deletion is best-effort — if the file is already gone the DB record
 * is still deleted. Returns { error } on auth or DB failure.
 */
export async function deleteInvoice(
  invoiceId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  // Fetch receipt_path before deleting so we can clean up Storage
  const { data: row } = await supabase
    .from('invoices')
    .select('receipt_path')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  const { error: dbError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('user_id', user.id)

  if (dbError) {
    console.error('[deleteInvoice] DB delete failed:', dbError.message)
    return { error: 'db' }
  }

  // Best-effort: remove the file from Storage (ignore errors)
  if (row?.receipt_path) {
    await supabase.storage.from('invoices').remove([row.receipt_path])
  }

  revalidatePath('/', 'layout')
  return {}
}

// ── Status-only poll ──────────────────────────────────────────────────────────

/**
 * Fetch ONLY the status of a single invoice (lightweight poll).
 *
 * Called by AnalysisStatusWrapper every 3 s to avoid full page re-renders
 * during AI processing. Returns null on auth failure or not found.
 */
export async function getInvoiceStatus(id: string): Promise<InvoiceStatus | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return null

  console.log(`[getInvoiceStatus] id=${id} status=${(data as { status: InvoiceStatus }).status}`)
  return (data as { status: InvoiceStatus }).status
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface InvoiceFilters {
  vendor?: string
  status?: string
  currency?: string
  dateFrom?: string
  dateTo?: string
}

/**
 * Create an invoice record after a receipt has been uploaded to Storage.
 *
 * Called client-side after the file is uploaded directly to the `invoices`
 * bucket (keeping binary data out of the Server Action payload).
 *
 * Returns the new invoice ID, or null on auth/DB failure.
 */
export async function createInvoiceRecord(
  receiptPath: string
): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const qb = typedFrom<Pick<Invoice, 'id'>, InvoiceInsert>(supabase, 'invoices')
  const { data, error } = await qb
    .insert({ user_id: user.id, receipt_path: receiptPath, status: 'pending' })
    .select('id')
    .single()

  if (error || !data) {
    // This error appears in Vercel → Deployments → Functions → Logs
    console.error('[createInvoiceRecord] DB insert failed:', error?.message, error)
    return null
  }
  return data.id
}

/**
 * Fetch a single invoice by ID, scoped to the current user.
 * Also generates a short-lived signed URL for the receipt file.
 *
 * Returns null if the user is not authenticated or the invoice does not exist / belongs to another user.
 */
export async function getInvoice(
  id: string
): Promise<{ invoice: Invoice; receiptUrl: string | null } | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const qb = typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
  const { data: invoice, error } = await qb
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !invoice) return null

  let receiptUrl: string | null = null
  if (invoice.receipt_path) {
    const { data: signed } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.receipt_path, 3600)
    receiptUrl = signed?.signedUrl ?? null
  }

  return { invoice, receiptUrl }
}

/**
 * Fetch all invoices for the current user, ordered by creation date descending.
 * Accepts optional filters for vendor search, status, currency, and date range.
 * Returns an empty array if unauthenticated or on DB error.
 */
export async function listInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Use a typed helper when no filters; fall back to flexible any-typed chaining
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('invoices').select('*').eq('user_id', user.id)

  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.currency) q = q.eq('currency', filters.currency)
  if (filters?.vendor) q = q.ilike('vendor_name', `%${filters.vendor}%`)
  if (filters?.dateFrom) q = q.gte('invoice_date', filters.dateFrom)
  if (filters?.dateTo) q = q.lte('invoice_date', filters.dateTo)

  q = q.order('created_at', { ascending: false })

  const { data, error } = await q
  if (error || !data) return []
  return data as Invoice[]
}

/**
 * Fetch dashboard aggregate stats for the current user.
 * All monetary values returned in cents (integer).
 */
export async function getDashboardStats(): Promise<{
  total: number
  pendingCents: number
  paidThisMonthCents: number
  overdue: number
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { total: 0, pendingCents: 0, paidThisMonthCents: 0, overdue: 0 }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  // "Overdue" = pending invoice older than 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, pendingRes, paidRes, overdueRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('invoices')
      .select('total_cents')
      .eq('user_id', user.id)
      .in('status', ['pending', 'review_needed']),

    supabase
      .from('invoices')
      .select('total_cents')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .gte('created_at', monthStart),

    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'review_needed'])
      .lt('created_at', thirtyDaysAgo),
  ])

  const pendingCents = (pendingRes.data ?? []).reduce(
    (sum, row) => sum + ((row as { total_cents: number | null }).total_cents ?? 0),
    0
  )
  const paidThisMonthCents = (paidRes.data ?? []).reduce(
    (sum, row) => sum + ((row as { total_cents: number | null }).total_cents ?? 0),
    0
  )

  return {
    total: totalRes.count ?? 0,
    pendingCents,
    paidThisMonthCents,
    overdue: overdueRes.count ?? 0,
  }
}

// ── VAT Breakdown ─────────────────────────────────────────────────────────────

export interface VatBreakdownRow {
  countryCode: string
  countryName: string
  flag: string
  quarter: string  // e.g. 'Q1 2025'
  year: number
  quarterNumber: 1 | 2 | 3 | 4
  taxCents: number
  subtotalCents: number
  invoiceCount: number
}

/**
 * Returns IVA Soportado (input VAT) broken down by country and quarter.
 * Only includes approved invoices with known country_code and tax_cents > 0.
 *
 * Used by the CFO Dashboard to generate quarterly tax declarations.
 */
export async function getVatBreakdown(): Promise<VatBreakdownRow[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('invoices')
    .select('country_code, invoice_date, tax_cents, subtotal_cents')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .not('country_code', 'is', null)
    .not('tax_cents', 'is', null)
    .gt('tax_cents', 0)
    .order('invoice_date', { ascending: true })

  if (error || !data) return []

  // Group by country + quarter
  const grouped = new Map<string, VatBreakdownRow>()

  for (const row of data as Array<{
    country_code: string | null
    invoice_date: string | null
    tax_cents: number | null
    subtotal_cents: number | null
  }>) {
    if (!row.country_code || !row.invoice_date || row.tax_cents == null) continue

    const date = new Date(row.invoice_date)
    const year = date.getFullYear()
    const quarterNumber = (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4
    const quarter = `Q${quarterNumber} ${year}`
    const key = `${row.country_code}__${quarter}`

    const config = COUNTRY_TAX_CONFIG[row.country_code]
    const existing = grouped.get(key)

    if (existing) {
      existing.taxCents += row.tax_cents
      existing.subtotalCents += row.subtotal_cents ?? 0
      existing.invoiceCount += 1
    } else {
      grouped.set(key, {
        countryCode: row.country_code,
        countryName: config?.nameEs ?? row.country_code,
        flag: config?.flag ?? '🏳️',
        quarter,
        year,
        quarterNumber,
        taxCents: row.tax_cents,
        subtotalCents: row.subtotal_cents ?? 0,
        invoiceCount: 1,
      })
    }
  }

  // Sort by year desc, quarter desc, then by tax amount desc
  return Array.from(grouped.values()).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    if (b.quarterNumber !== a.quarterNumber) return b.quarterNumber - a.quarterNumber
    return b.taxCents - a.taxCents
  })
}
