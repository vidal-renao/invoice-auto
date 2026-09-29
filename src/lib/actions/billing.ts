'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/profile'
import { decideTaxTreatment, type Client, type Issuer } from '@/lib/billing/treatment'
import { computeLineNet, computeTotals, type InvoiceLine } from '@/lib/billing/totals'
import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'

// ── Tipos que devuelve la capa ───────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  tax_id: string | null
  country: string
  kind: 'business' | 'individual'
  email: string | null
  payment_terms_days: number
  vat_validated: boolean
  equivalence_surcharge: boolean
}

export interface IssuedInvoice {
  id: string
  reference: string
  issue_date: string
  due_date: string
  currency: string
  tax_case: string
  vat_rate: number
  retention_rate: number
  net_cents: number
  vat_cents: number
  retention_cents: number
  equivalence_cents: number
  total_cents: number
  legal_mentions: string[]
  status: 'issued' | 'paid' | 'cancelled'
  customer_id: string
  notes: string | null
}

export type ActionState = { ok: boolean; error?: string; id?: string }

// ── Clientes ─────────────────────────────────────────────────────────────────

const CustomerSchema = z.object({
  name: z.string().min(1).max(140),
  tax_id: z.string().max(50).nullable(),
  country: z.string().length(2),
  kind: z.enum(['business', 'individual']),
  email: z.string().email().nullable().or(z.literal('').transform(() => null)),
  payment_terms_days: z.coerce.number().int().min(0).max(365),
  equivalence_surcharge: z.boolean(),
})

export async function listCustomers(): Promise<Customer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bill_customers')
    .select('id, name, tax_id, country, kind, email, payment_terms_days, vat_validated, equivalence_surcharge')
    .order('name')

  if (error) {
    console.error('[listCustomers] failed:', error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as Customer[]
}

export async function createCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'auth' }

  const parsed = CustomerSchema.safeParse({
    name: formData.get('name'),
    tax_id: (formData.get('tax_id') as string) || null,
    country: formData.get('country'),
    kind: formData.get('kind'),
    email: (formData.get('email') as string) || null,
    payment_terms_days: formData.get('payment_terms_days') ?? 30,
    equivalence_surcharge: formData.get('equivalence_surcharge') === 'on',
  })

  if (!parsed.success) {
    console.error('[createCustomer] validation:', parsed.error.flatten())
    return { ok: false, error: 'validation' }
  }

  const { data, error } = await supabase
    .from('bill_customers')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single()

  if (error) {
    console.error('[createCustomer] db:', error.message)
    return { ok: false, error: 'db' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, id: (data as { id: string }).id }
}

// ── Emisión ──────────────────────────────────────────────────────────────────

const LineSchema = z.object({
  description: z.string().min(1).max(500),
  quantityMilli: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  discountRate: z.number().min(0).max(0.99).optional(),
})

const IssueSchema = z.object({
  customerId: z.string().uuid(),
  series: z.string().regex(/^[A-Z0-9-]{1,10}$/),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vatRateOverride: z.number().optional(),
  notes: z.string().max(1000).nullable().optional(),
  lines: z.array(LineSchema).min(1),
})

export interface IssuePreview {
  treatment: ReturnType<typeof decideTaxTreatment>
  totals: ReturnType<typeof computeTotals>
  currency: string
}

/**
 * Calcula impuestos y totales sin emitir nada.
 *
 * La pantalla muestra esto mientras el usuario escribe: ve el IVA, la
 * retención y el motivo de cada uno antes de comprometerse. Es el mismo
 * cálculo que se usará al emitir, no una aproximación para la vista.
 */
export async function previewInvoice(input: {
  customerId: string
  lines: InvoiceLine[]
  vatRateOverride?: number
}): Promise<IssuePreview | null> {
  const supabase = await createClient()
  const [{ data: cliente }, perfil] = await Promise.all([
    supabase
      .from('bill_customers')
      .select('country, tax_id, kind, vat_validated, equivalence_surcharge')
      .eq('id', input.customerId)
      .single(),
    getProfile(),
  ])

  if (!cliente || !perfil) return null

  const emisor: Issuer = {
    country: perfil.country,
    taxId: perfil.tax_id,
    // Un autónomo con NIF de persona física factura servicios profesionales:
    // hasta que exista el ajuste en el perfil, se asume cuando el país es ES
    // y el identificador no es de sociedad (que empieza por letra A-W).
    professionalActivity: perfil.country === 'ES' && /^\d/.test(perfil.tax_id ?? ''),
  }

  const c = cliente as unknown as {
    country: string
    tax_id: string | null
    kind: 'business' | 'individual'
    vat_validated: boolean
    equivalence_surcharge: boolean
  }

  const treatment = decideTaxTreatment(
    emisor,
    {
      country: c.country,
      taxId: c.tax_id,
      kind: c.kind,
      vatValidated: c.vat_validated,
      equivalenceSurcharge: c.equivalence_surcharge,
    } satisfies Client,
    input.vatRateOverride
  )

  return {
    treatment,
    totals: computeTotals(input.lines, treatment),
    currency: COUNTRY_TAX_CONFIG[emisor.country]?.currency === 'CHF' ? 'CHF' : 'EUR',
  }
}

/**
 * Emite la factura. Los importes se calculan aquí con el código probado y la
 * base de datos los vuelve a comprobar antes de escribir nada: si alguna vez
 * discrepan, no se emite.
 */
export async function issueInvoice(input: z.input<typeof IssueSchema>): Promise<ActionState> {
  const parsed = IssueSchema.safeParse(input)
  if (!parsed.success) {
    console.error('[issueInvoice] validation:', parsed.error.flatten())
    return { ok: false, error: 'validation' }
  }

  const preview = await previewInvoice({
    customerId: parsed.data.customerId,
    lines: parsed.data.lines,
    vatRateOverride: parsed.data.vatRateOverride,
  })
  if (!preview) return { ok: false, error: 'not_found' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('bill_issue_invoice', {
    p_customer_id: parsed.data.customerId,
    p_series: parsed.data.series,
    p_issue_date: parsed.data.issueDate,
    p_currency: preview.currency,
    p_tax: {
      case: preview.treatment.case,
      vatRate: preview.treatment.vatRate,
      retentionRate: preview.treatment.retentionRate,
      equivalenceRate: preview.treatment.equivalenceRate,
      legalMentions: preview.treatment.legalMentions,
    },
    p_amounts: {
      netCents: preview.totals.netCents,
      vatCents: preview.totals.vatCents,
      equivalenceCents: preview.totals.equivalenceCents,
      retentionCents: preview.totals.retentionCents,
      totalCents: preview.totals.totalCents,
    },
    p_lines: parsed.data.lines.map((l) => ({
      description: l.description,
      quantityMilli: l.quantityMilli,
      unitPriceCents: l.unitPriceCents,
      discountRate: l.discountRate ?? 0,
      netCents: computeLineNet(l),
    })),
    p_notes: parsed.data.notes ?? null,
  })

  if (error) {
    console.error('[issueInvoice] rpc failed:', error.message)
    return { ok: false, error: 'db' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, id: data as string }
}

export async function listIssuedInvoices(): Promise<Array<IssuedInvoice & { customer: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bill_invoices')
    .select('*, bill_customers(name)')
    .order('issue_date', { ascending: false })
    .order('number', { ascending: false })

  if (error) {
    console.error('[listIssuedInvoices] failed:', error.message)
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const r = row as unknown as IssuedInvoice & { bill_customers: { name: string } | null }
    return { ...r, customer: r.bill_customers?.name ?? '—' }
  })
}

export async function getIssuedInvoice(id: string) {
  const supabase = await createClient()
  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase.from('bill_invoices').select('*, bill_customers(*)').eq('id', id).single(),
    supabase.from('bill_invoice_lines').select('*').eq('invoice_id', id).order('position'),
  ])
  if (!invoice) return null
  return { invoice: invoice as unknown as IssuedInvoice & { bill_customers: Customer }, lines: lines ?? [] }
}

export async function markInvoicePaid(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('bill_mark_paid', { p_invoice_id: id })
  if (error) {
    console.error('[markInvoicePaid] failed:', error.message)
    return { ok: false, error: 'db' }
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}
