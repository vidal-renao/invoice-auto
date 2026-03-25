'use server'

import { createClient } from '@/lib/supabase/server'
import { typedFrom } from '@/lib/supabase/builder'
import type { Invoice, InvoiceInsert } from '@/types/database'

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

  if (error || !data) return null
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
