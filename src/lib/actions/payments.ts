'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { businessToday } from '@/lib/payments/dates'
import { buildPain001, type BatchTransaction } from '@/lib/payments/pain001'
import { buildQueue } from '@/lib/payments/queue'
import { loadWorkspace, RepositoryError } from '@/lib/payments/repository'
import { supplierKey } from '@/lib/payments/supplier'
import { createClient } from '@/lib/supabase/server'
import { typedRpc, type RpcError } from '@/lib/supabase/builder'
import {
  AcceptReviewSchema,
  BatchIdSchema,
  CancelBatchSchema,
  CreateBatchSchema,
  RegisterAccountSchema,
  RejectAccountSchema,
  SettingsSchema,
  VerifyAccountSchema,
} from '@/lib/validations/payments'
import type { z } from 'zod'

/**
 * Payment commands. Each one: authenticate, validate at the boundary,
 * (re)compute on the server whatever the client could have tampered with,
 * then call the matching database function — which re-checks the
 * invariant and writes the audit entry in the same transaction.
 */

export type PaymentErrorCode =
  | 'auth'
  | 'invalid'
  | 'not_found'
  | 'settings_missing'
  | 'not_payable'
  | 'not_in_review'
  | 'supplier_unknown'
  | 'iban_missing'
  | 'already_scheduled'
  | 'account_not_verified'
  | 'account_cooling_off'
  | 'account_has_open_batch'
  | 'state_changed'
  | 'db'

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: PaymentErrorCode; field?: string; detail?: string }

function fail(error: PaymentErrorCode, field?: string, detail?: string): { ok: false; error: PaymentErrorCode; field?: string; detail?: string } {
  return { ok: false, error, ...(field ? { field } : {}), ...(detail ? { detail } : {}) }
}

function invalid(issues: z.ZodIssue[]) {
  const first = issues[0]
  return fail('invalid', first?.path.join('.'), first?.message)
}

/** Maps the database functions' exceptions to messages the UI can translate. */
function fromDb(label: string, error: RpcError): { ok: false; error: PaymentErrorCode } {
  const message = error.message
  console.error(`[payments:${label}]`, error.code ?? '', message)
  if (/pay_payments_one_open_per_invoice/.test(message)) return fail('already_scheduled')
  if (/cooling-off/.test(message)) return fail('account_cooling_off')
  if (/not verified/.test(message)) return fail('account_not_verified')
  if (/open batch/.test(message)) return fail('account_has_open_batch')
  if (/not found/.test(message)) return fail('not_found')
  if (/not pending verification|already|only a generated batch|not approved|does not match/.test(message)) {
    return fail('state_changed')
  }
  if (/invalid IBAN/.test(message)) return fail('invalid', 'iban', 'iban_checksum')
  return fail('db')
}

async function session() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function refresh() {
  revalidatePath('/', 'layout')
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function savePaymentSettings(input: unknown): Promise<ActionResult> {
  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  const s = parsed.data
  const { error } = await typedRpc<null>(supabase, 'pay_save_settings', {
    p_debtor_name: s.debtor_name,
    p_debtor_iban: s.debtor_iban,
    p_debtor_bic: s.debtor_bic || null,
    p_review_threshold_cents: s.review_threshold * 100,
    p_cooling_off_hours: s.cooling_off_hours,
  })
  if (error) return fromDb('settings', error)
  refresh()
  return { ok: true }
}

// ── Accounts ──────────────────────────────────────────────────────────────────

/**
 * Registers the bank account of an invoice's supplier. The supplier's
 * identity always comes from the invoice row on the server, never from the
 * client; the IBAN is the one printed on the invoice unless the user typed
 * another. Either way it starts unverified.
 */
export async function registerSupplierAccount(input: unknown): Promise<ActionResult<{ account_id: string }>> {
  const parsed = RegisterAccountSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, vendor_name, vendor_tax_id, payment_iban')
    .eq('id', parsed.data.invoice_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return fromDb('register:invoice', error)
  if (!invoice) return fail('not_found')

  const row = invoice as { id: string; vendor_name: string | null; vendor_tax_id: string | null; payment_iban: string | null }
  const key = supplierKey(row.vendor_tax_id, row.vendor_name)
  if (!key || !row.vendor_name) return fail('supplier_unknown')

  const iban = parsed.data.iban ?? row.payment_iban
  if (!iban) return fail('iban_missing', 'iban')

  const { data, error: rpcError } = await typedRpc<string>(supabase, 'pay_register_account', {
    p_supplier_key: key,
    p_supplier_name: row.vendor_name.slice(0, 140),
    p_iban: iban,
    p_source: parsed.data.iban ? 'manual' : 'invoice',
    p_source_invoice_id: row.id,
  })
  if (rpcError || !data) return fromDb('register', rpcError ?? { message: 'no id returned' })
  refresh()
  return { ok: true, data: { account_id: data } }
}

export async function verifySupplierAccount(input: unknown): Promise<ActionResult> {
  const parsed = VerifyAccountSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  const { error } = await typedRpc<null>(supabase, 'pay_verify_account', {
    p_account_id: parsed.data.account_id,
    p_channel: parsed.data.channel,
    p_contact: parsed.data.contact,
    p_note: parsed.data.note,
  })
  if (error) return fromDb('verify', error)
  refresh()
  return { ok: true }
}

export async function rejectSupplierAccount(input: unknown): Promise<ActionResult> {
  const parsed = RejectAccountSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  const { error } = await typedRpc<null>(supabase, 'pay_reject_account', {
    p_account_id: parsed.data.account_id,
    p_reason: parsed.data.reason,
  })
  if (error) return fromDb('reject', error)
  refresh()
  return { ok: true }
}

// ── Reviews ───────────────────────────────────────────────────────────────────

/**
 * Accepts the review reasons of an invoice. The decision — and so the
 * fingerprint being accepted — is recomputed here, from the database: the
 * client only says which invoice and why.
 */
export async function acceptPaymentReview(input: unknown): Promise<ActionResult> {
  const parsed = AcceptReviewSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  try {
    const { workspace } = await loadWorkspace(supabase, user.id)
    const now = new Date()
    const queue = buildQueue(workspace, now, businessToday(now))
    const item = queue.review.find((q) => q.invoice.id === parsed.data.invoice_id)
    if (!item) return fail('not_in_review')

    const reasons = item.decision.reasons.filter((r) => r.severity === 'review')
    const { error } = await typedRpc<null>(supabase, 'pay_accept_review', {
      p_invoice_id: item.invoice.id,
      p_fingerprint: item.decision.fingerprint,
      p_note: parsed.data.note,
      p_reasons: reasons,
    })
    if (error) return fromDb('accept', error)
  } catch (err) {
    if (err instanceof RepositoryError) return fromDb('accept:load', { message: err.message })
    throw err
  }
  refresh()
  return { ok: true }
}

// ── Batches ───────────────────────────────────────────────────────────────────

function newId(prefix: string, bytes: number): string {
  return `${prefix}${randomBytes(bytes).toString('hex').toUpperCase()}`
}

/**
 * Builds a pain.001 file for the selected invoices. Every one of them is
 * decided again here; anything that is not `pay` right now is refused, so
 * a stale screen can never schedule a held payment.
 */
export async function createPaymentBatch(input: unknown): Promise<ActionResult<{ batch_id: string }>> {
  const parsed = CreateBatchSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  try {
    const { workspace, settings } = await loadWorkspace(supabase, user.id)
    if (!settings) return fail('settings_missing')

    const now = new Date()
    const today = businessToday(now)
    const queue = buildQueue(workspace, now, today)
    const payable = new Map(queue.pay.map((q) => [q.invoice.id, q]))

    const requested = [...new Set(parsed.data.invoice_ids)]
    const items = requested.map((id) => payable.get(id))
    const blocked = requested.filter((_, i) => !items[i])
    if (blocked.length > 0) return fail('not_payable', undefined, blocked.join(','))

    const selected = items.filter((q): q is NonNullable<typeof q> => Boolean(q))
    const messageId = `IA-${today.replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`
    const transactions: BatchTransaction[] = selected.map((q) => ({
      end_to_end_id: newId('IA', 12),
      plan: q.decision.plan!,
      remittance_text: q.invoice.invoice_number
        ? `${q.invoice.invoice_number}${q.invoice.invoice_date ? ` ${q.invoice.invoice_date}` : ''}`
        : `${q.invoice.vendor_name ?? ''} ${q.invoice.invoice_date ?? ''}`.trim() || q.invoice.id,
    }))

    const xml = buildPain001({
      message_id: messageId,
      created_at: now,
      debtor: { name: settings.debtor_name, iban: settings.debtor_iban, bic: settings.debtor_bic },
      transactions,
    })

    const { data, error } = await typedRpc<string>(supabase, 'pay_create_batch', {
      p_message_id: messageId,
      p_xml: xml,
      p_items: selected.map((q, i) => ({
        invoice_id: q.invoice.id,
        account_id: q.account!.id,
        amount_cents: q.decision.plan!.amount_cents,
        currency: q.decision.plan!.currency,
        end_to_end_id: transactions[i]!.end_to_end_id,
        requested_execution_date: q.decision.plan!.requested_execution_date,
      })),
      // The evidence of why each payment was allowed, frozen in the audit log.
      p_decisions: selected.map((q) => ({
        invoice_id: q.invoice.id,
        fingerprint: q.decision.fingerprint,
        overridden: q.decision.overridden,
        reasons: q.decision.reasons,
        route: q.decision.plan!.route,
      })),
    })
    if (error || !data) return fromDb('batch', error ?? { message: 'no id returned' })
    refresh()
    return { ok: true, data: { batch_id: data } }
  } catch (err) {
    if (err instanceof RepositoryError) return fromDb('batch:load', { message: err.message })
    throw err
  }
}

export async function markBatchExecuted(input: unknown): Promise<ActionResult> {
  const parsed = BatchIdSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  const { error } = await typedRpc<null>(supabase, 'pay_mark_batch_executed', { p_batch_id: parsed.data.batch_id })
  if (error) return fromDb('execute', error)
  refresh()
  return { ok: true }
}

export async function cancelBatch(input: unknown): Promise<ActionResult> {
  const parsed = CancelBatchSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const { supabase, user } = await session()
  if (!user) return fail('auth')

  const { error } = await typedRpc<null>(supabase, 'pay_cancel_batch', {
    p_batch_id: parsed.data.batch_id,
    p_reason: parsed.data.reason,
  })
  if (error) return fromDb('cancel', error)
  refresh()
  return { ok: true }
}
