import type { createClient } from '@/lib/supabase/server'
import { typedFrom } from '@/lib/supabase/builder'

import type { Workspace, WorkspaceInvoice, WorkspaceOverride, WorkspacePayment } from './queue'
import type { EngineSettings, SupplierAccount, VerificationChannel } from './types'

/**
 * Reads what the payment engine needs, through the user's own session:
 * RLS scopes every query, the explicit user_id filter is only for the
 * query planner. No service-role key is involved anywhere in payments.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>

export interface PaymentSettingsRow extends EngineSettings {
  user_id: string
  debtor_name: string
  debtor_iban: string
  debtor_bic: string | null
  updated_at: string
}

export interface AccountRow extends SupplierAccount {
  user_id: string
  source: 'manual' | 'invoice'
  source_invoice_id: string | null
  verification_contact: string | null
  verification_note: string | null
  closed_at: string | null
  rejection_reason: string | null
}

export interface BatchRow {
  id: string
  message_id: string
  status: 'generated' | 'executed' | 'cancelled'
  tx_count: number
  control_sum_cents: number
  currencies: string[]
  created_at: string
  executed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

export interface PaymentRow {
  id: string
  batch_id: string
  invoice_id: string
  account_id: string
  amount_cents: number
  currency: 'EUR' | 'CHF'
  end_to_end_id: string
  requested_execution_date: string
  status: 'in_batch' | 'paid' | 'cancelled'
}

export interface AuditRow {
  id: number
  occurred_at: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
}

const INVOICE_COLUMNS =
  'id, status, vendor_name, vendor_tax_id, invoice_number, invoice_date, due_date, total_cents, currency, payment_iban, payment_reference, created_at'

const ACCOUNT_COLUMNS =
  'id, user_id, supplier_key, supplier_name, iban, status, is_change, source, source_invoice_id, registered_at, verified_at, verification_channel, verification_contact, verification_note, cooling_off_until, closed_at, rejection_reason'

export class RepositoryError extends Error {}

function unwrap<T>(label: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new RepositoryError(`${label}: ${result.error.message}`)
  return result.data as T
}

export async function loadWorkspace(supabase: Supabase, userId: string): Promise<{
  workspace: Workspace
  settings: PaymentSettingsRow | null
  accounts: AccountRow[]
}> {
  const [invoices, accounts, payments, overrides, settings] = await Promise.all([
    typedFrom<WorkspaceInvoice, never>(supabase, 'invoices')
      .select(INVOICE_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    typedFrom<AccountRow, never>(supabase, 'pay_supplier_accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('user_id', userId)
      .order('registered_at', { ascending: true }),
    typedFrom<WorkspacePayment, never>(supabase, 'pay_payments')
      .select('invoice_id, status')
      .eq('user_id', userId),
    typedFrom<WorkspaceOverride, never>(supabase, 'pay_overrides')
      .select('invoice_id, fingerprint, note, created_at')
      .eq('user_id', userId),
    typedFrom<PaymentSettingsRow, never>(supabase, 'pay_settings')
      .select('*')
      .eq('user_id', userId),
  ])

  const accountRows = unwrap('accounts', accounts) ?? []
  const settingsRow = (unwrap('settings', settings) ?? [])[0] ?? null

  return {
    workspace: {
      invoices: unwrap('invoices', invoices) ?? [],
      accounts: accountRows,
      payments: unwrap('payments', payments) ?? [],
      overrides: unwrap('overrides', overrides) ?? [],
      settings: settingsRow
        ? {
            review_threshold_cents: Number(settingsRow.review_threshold_cents),
            cooling_off_hours: settingsRow.cooling_off_hours,
          }
        : null,
    },
    settings: settingsRow,
    accounts: accountRows,
  }
}

export async function listBatches(supabase: Supabase, userId: string): Promise<{
  batches: BatchRow[]
  payments: PaymentRow[]
}> {
  const [batches, payments] = await Promise.all([
    typedFrom<BatchRow, never>(supabase, 'pay_batches')
      .select('id, message_id, status, tx_count, control_sum_cents, currencies, created_at, executed_at, cancelled_at, cancel_reason')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    typedFrom<PaymentRow, never>(supabase, 'pay_payments')
      .select('id, batch_id, invoice_id, account_id, amount_cents, currency, end_to_end_id, requested_execution_date, status')
      .eq('user_id', userId),
  ])
  return {
    batches: (unwrap('batches', batches) ?? []).map((b) => ({ ...b, control_sum_cents: Number(b.control_sum_cents) })),
    payments: (unwrap('payments', payments) ?? []).map((p) => ({ ...p, amount_cents: Number(p.amount_cents) })),
  }
}

export async function getBatchXml(
  supabase: Supabase,
  userId: string,
  batchId: string,
): Promise<{ message_id: string; xml: string } | null> {
  const result = await typedFrom<{ message_id: string; xml: string }, never>(supabase, 'pay_batches')
    .select('message_id, xml')
    .eq('user_id', userId)
    .eq('id', batchId)
  return (unwrap('batch', result) ?? [])[0] ?? null
}

export async function listAudit(supabase: Supabase, userId: string, limit = 200): Promise<AuditRow[]> {
  const result = await typedFrom<AuditRow, never>(supabase, 'pay_audit_log')
    .select('id, occurred_at, action, entity_type, entity_id, details')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  return unwrap('audit', result) ?? []
}

export const VERIFICATION_CHANNELS: readonly VerificationChannel[] = [
  'phone_callback',
  'in_person',
  'signed_letter',
  'bank_confirmation',
]
