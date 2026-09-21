import { decide } from './decision'
import { supplierKey } from './supplier'
import {
  DEFAULT_SETTINGS,
  type Decision,
  type EngineSettings,
  type HistoricInvoice,
  type Override,
  type PayableInvoice,
  type PaymentState,
  type SupplierAccount,
} from './types'

/**
 * Everything the payment queue is computed from, as loaded for one user.
 * Kept free of Supabase types so the same function serves the app, the
 * public demo and the tests.
 */
export interface WorkspaceInvoice extends PayableInvoice {
  created_at: string
}

export interface WorkspacePayment {
  invoice_id: string
  status: PaymentState | 'cancelled'
}

export interface WorkspaceOverride extends Override {
  invoice_id: string
}

export interface Workspace {
  invoices: readonly WorkspaceInvoice[]
  /** All accounts, any status; the live one per supplier is picked here. */
  accounts: readonly SupplierAccount[]
  payments: readonly WorkspacePayment[]
  overrides: readonly WorkspaceOverride[]
  settings: EngineSettings | null
}

export interface QueueItem {
  invoice: WorkspaceInvoice
  supplier_key: string | null
  account: SupplierAccount | null
  decision: Decision
}

export interface Queue {
  pay: QueueItem[]
  review: QueueItem[]
  stop: QueueItem[]
  /** Approved and already in a batch or paid: shown for context, not decided again. */
  settled: { invoice: WorkspaceInvoice; state: PaymentState }[]
  /** Invoices the fiscal step has not approved yet. */
  awaiting_approval: number
}

function liveAccounts(accounts: readonly SupplierAccount[]): Map<string, SupplierAccount> {
  const live = new Map<string, SupplierAccount>()
  for (const a of accounts) {
    if (a.status === 'superseded') continue
    const current = live.get(a.supplier_key)
    // A rejected account stays visible until a newer one is registered.
    if (!current || a.registered_at > current.registered_at) live.set(a.supplier_key, a)
  }
  return live
}

function paymentStates(payments: readonly WorkspacePayment[]): Map<string, PaymentState> {
  const states = new Map<string, PaymentState>()
  for (const p of payments) {
    if (p.status === 'paid') states.set(p.invoice_id, 'paid')
    else if (p.status === 'in_batch' && states.get(p.invoice_id) !== 'paid') states.set(p.invoice_id, 'in_batch')
  }
  return states
}

function latestOverrides(overrides: readonly WorkspaceOverride[]): Map<string, WorkspaceOverride> {
  const latest = new Map<string, WorkspaceOverride>()
  for (const o of overrides) {
    const current = latest.get(o.invoice_id)
    if (!current || o.created_at > current.created_at) latest.set(o.invoice_id, o)
  }
  return latest
}

export function buildQueue(ws: Workspace, now: Date, today: string): Queue {
  const accounts = liveAccounts(ws.accounts)
  const states = paymentStates(ws.payments)
  const overrides = latestOverrides(ws.overrides)
  const settings = ws.settings ?? DEFAULT_SETTINGS

  const keyed = ws.invoices.map((invoice) => ({
    invoice,
    key: supplierKey(invoice.vendor_tax_id, invoice.vendor_name),
  }))

  const history: HistoricInvoice[] = keyed
    .filter((k): k is { invoice: WorkspaceInvoice; key: string } => k.key !== null)
    .map(({ invoice, key }) => ({
      id: invoice.id,
      supplier_key: key,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      total_cents: invoice.total_cents,
      currency: invoice.currency,
      status: invoice.status,
      payment_state: states.get(invoice.id) ?? null,
    }))

  const queue: Queue = { pay: [], review: [], stop: [], settled: [], awaiting_approval: 0 }

  for (const { invoice, key } of keyed) {
    if (invoice.status === 'rejected') continue
    if (invoice.status !== 'approved') {
      queue.awaiting_approval++
      continue
    }
    const state = states.get(invoice.id)
    if (state) {
      queue.settled.push({ invoice, state })
      continue
    }

    const account = key ? (accounts.get(key) ?? null) : null
    const decision = decide(invoice, {
      today,
      now,
      account,
      history,
      payment_state: null,
      settings,
      override: overrides.get(invoice.id) ?? null,
    })
    queue[decision.outcome].push({ invoice, supplier_key: key, account, decision })
  }

  const byDue = (a: QueueItem, b: QueueItem) =>
    (a.invoice.due_date ?? '9999').localeCompare(b.invoice.due_date ?? '9999')
  queue.pay.sort(byDue)
  queue.review.sort(byDue)
  queue.stop.sort(byDue)
  return queue
}
