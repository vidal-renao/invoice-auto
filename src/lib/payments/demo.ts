import { addDays } from './dates'
import { buildPain001 } from './pain001'
import { mod10Recursive } from './reference'
import { buildQueue, type Workspace, type WorkspaceInvoice, type WorkspacePayment } from './queue'
import { DEFAULT_SETTINGS, type SupplierAccount } from './types'

/**
 * A fictitious company's month of supplier invoices, built so that every
 * decision path of the engine appears at least once. It feeds the public
 * demo page and the tests; it never touches a database.
 *
 * All names, tax ids and IBANs are invented. The IBANs pass the checksum
 * (so the engine treats them as real accounts) but belong to nobody.
 * Dates are relative to "today", so the demo never goes stale.
 */

export const DEMO_DEBTOR = {
  name: 'Atelier Demo GmbH',
  iban: 'CH9300762011623852957', // the public SIX example account
  bic: null,
} as const

function qrr(base: string): string {
  const digits = base.padStart(26, '0')
  return digits + mod10Recursive(digits)
}

export function buildDemoWorkspace(now: Date, today: string): Workspace {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()
  const hoursAhead = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString()
  const day = (offset: number) => addDays(today, offset)

  let n = 0
  const invoice = (over: Partial<WorkspaceInvoice> & Pick<WorkspaceInvoice, 'vendor_name'>): WorkspaceInvoice => {
    n++
    return {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      status: 'approved',
      vendor_tax_id: null,
      invoice_number: `F-${1000 + n}`,
      invoice_date: day(-10),
      due_date: day(10),
      total_cents: 10_000,
      currency: 'EUR',
      payment_iban: null,
      payment_reference: null,
      created_at: hoursAgo(240 - n),
      ...over,
    }
  }

  let a = 0
  const account = (over: Partial<SupplierAccount> & Pick<SupplierAccount, 'supplier_key' | 'supplier_name' | 'iban'>): SupplierAccount => {
    a++
    return {
      id: `00000000-0000-4000-9000-${String(a).padStart(12, '0')}`,
      status: 'verified',
      is_change: false,
      registered_at: hoursAgo(24 * 120),
      cooling_off_until: null,
      verified_at: hoursAgo(24 * 119),
      verification_channel: 'phone_callback',
      ...over,
    }
  }

  const accounts: SupplierAccount[] = [
    account({ supplier_key: 'tax:B61234567', supplier_name: 'Papelería Llobet SL', iban: 'ES4421000418450200051111' }),
    account({ supplier_key: 'tax:CHE109876543', supplier_name: 'Stromwerk Basel AG', iban: 'CH0430000001234567890', verification_channel: 'signed_letter' }),
    account({ supplier_key: 'tax:B87654321', supplier_name: 'Nube Hosting SL', iban: 'ES5100810216700001987654' }),
    account({ supplier_key: 'tax:A50111222', supplier_name: 'Transportes Ebro SA', iban: 'ES6000491500051234567892' }),
    // Imprenta Rhein changed its bank last week: the old account is superseded,
    // the new one was verified by phone yesterday and is still cooling off.
    account({ supplier_key: 'tax:DE812345678', supplier_name: 'Imprenta Rhein GmbH', iban: 'DE44500105175407324931', status: 'superseded' }),
    account({
      supplier_key: 'tax:DE812345678',
      supplier_name: 'Imprenta Rhein GmbH',
      iban: 'DE29100100100987654321',
      is_change: true,
      registered_at: hoursAgo(30),
      verified_at: hoursAgo(20),
      cooling_off_until: hoursAhead(52),
    }),
    // A new supplier: its IBAN was taken from the invoice and nobody has called yet.
    account({
      supplier_key: 'tax:B39555666',
      supplier_name: 'Asesoría Cantábrica SL',
      iban: 'ES3720383356120600123456',
      status: 'pending_verification',
      registered_at: hoursAgo(5),
      verified_at: null,
      verification_channel: null,
    }),
    account({ supplier_key: 'tax:B17333444', supplier_name: 'Cafés Montseny SL', iban: 'ES1001822370420201234567' }),
    account({ supplier_key: 'tax:B28999000', supplier_name: 'Mensajería Delta SL', iban: 'ES0214650100911700123456' }),
    account({ supplier_key: 'name:fontaneriarius', supplier_name: 'Fontanería Rius', iban: 'ES3930580990272810012345', verification_channel: 'in_person' }),
    account({ supplier_key: 'tax:CHE222333444', supplier_name: 'Druckerei Aare AG', iban: 'CH5531000009876543210' }),
  ]

  const paid: WorkspaceInvoice[] = [
    invoice({ vendor_name: 'Papelería Llobet SL', vendor_tax_id: 'ESB61234567', invoice_number: 'F-2026-0412', invoice_date: day(-12), due_date: day(-2), total_cents: 18_150 }),
    invoice({ vendor_name: 'Mensajería Delta SL', vendor_tax_id: 'B28999000', invoice_number: 'MD-311', invoice_date: day(-95), total_cents: 4_520 }),
    invoice({ vendor_name: 'Mensajería Delta SL', vendor_tax_id: 'B28999000', invoice_number: 'MD-347', invoice_date: day(-65), total_cents: 5_080 }),
    invoice({ vendor_name: 'Mensajería Delta SL', vendor_tax_id: 'B28999000', invoice_number: 'MD-389', invoice_date: day(-35), total_cents: 4_890 }),
  ]

  const open: WorkspaceInvoice[] = [
    // pay — SEPA, due soon
    invoice({ vendor_name: 'Papelería Llobet SL', vendor_tax_id: 'ESB61234567', invoice_number: 'F-2026-0450', due_date: day(8), total_cents: 24_200 }),
    // pay — Swiss QR-bill in CHF with its QR reference
    invoice({
      vendor_name: 'Stromwerk Basel AG', vendor_tax_id: 'CHE-109.876.543 MWST', invoice_number: 'SB-77120',
      due_date: day(3), total_cents: 31_840, currency: 'CHF',
      payment_iban: 'CH0430000001234567890', payment_reference: qrr('4172002026091'),
    }),
    // pay after an accepted review — above the four-eyes threshold
    invoice({ vendor_name: 'Nube Hosting SL', vendor_tax_id: 'B87654321', invoice_number: 'NH-2026-09', due_date: day(14), total_cents: 1_240_000 }),
    // stop — the invoice asks for payment to a different IBAN (BEC pattern)
    invoice({ vendor_name: 'Transportes Ebro SA', vendor_tax_id: 'A50111222', invoice_number: 'TE-5521', due_date: day(5), total_cents: 186_300, payment_iban: 'DE68370400440532099999' }),
    // stop — changed account still cooling off
    invoice({ vendor_name: 'Imprenta Rhein GmbH', vendor_tax_id: 'DE812345678', invoice_number: 'IR-2026-118', due_date: day(6), total_cents: 72_900, payment_iban: 'DE29100100100987654321' }),
    // stop — new supplier, account not verified yet
    invoice({ vendor_name: 'Asesoría Cantábrica SL', vendor_tax_id: 'B39555666', invoice_number: 'AC-0031', due_date: day(12), total_cents: 60_500, payment_iban: 'ES3720383356120600123456' }),
    // stop — the same invoice as one already paid, number spelt differently
    invoice({ vendor_name: 'Papelería Llobet S.L.', vendor_tax_id: 'B-61234567', invoice_number: 'F-2026-412', invoice_date: day(-12), due_date: day(-2), total_cents: 18_150 }),
    // review — two invoices, same amount, three days apart
    invoice({ vendor_name: 'Cafés Montseny SL', vendor_tax_id: 'B17333444', invoice_number: 'CM-880', invoice_date: day(-6), due_date: day(9), total_cents: 14_520 }),
    invoice({ vendor_name: 'Cafés Montseny SL', vendor_tax_id: 'B17333444', invoice_number: 'CM-884', invoice_date: day(-3), due_date: day(12), total_cents: 14_520 }),
    // review — ten times what this supplier usually bills
    invoice({ vendor_name: 'Mensajería Delta SL', vendor_tax_id: 'B28999000', invoice_number: 'MD-421', due_date: day(4), total_cents: 48_000 }),
    // stop — no bank account on file at all, and the invoice printed none
    invoice({ vendor_name: 'Gestoría Albéniz', vendor_tax_id: 'B08777888', invoice_number: 'GA-19', due_date: day(-4), total_cents: 36_300 }),
    // review — supplier identified by name only
    invoice({ vendor_name: 'Fontanería Rius', invoice_number: '77', due_date: day(2), total_cents: 21_780 }),
    // stop — QR-IBAN but the reference is missing
    invoice({ vendor_name: 'Druckerei Aare AG', vendor_tax_id: 'CHE-222.333.444', invoice_number: 'DA-3310', due_date: day(7), total_cents: 45_600, currency: 'CHF' }),
    // not yet through the fiscal step
    invoice({ vendor_name: 'Ferretería Ordóñez SL', vendor_tax_id: 'B50444555', invoice_number: 'FO-12', status: 'review_needed', total_cents: 9_870 }),
  ]

  const payments: WorkspacePayment[] = paid.map((p) => ({ invoice_id: p.id, status: 'paid' as const }))

  const ws: Workspace = {
    invoices: [...paid, ...open],
    accounts,
    payments,
    overrides: [],
    settings: DEFAULT_SETTINGS,
  }

  // The accepted review: computed, not hard-coded, so it is exactly the
  // fingerprint the engine produces for that invoice today.
  const nube = open[2]!
  const pending = buildQueue(ws, now, today).review.find((q) => q.invoice.id === nube.id)
  if (!pending) throw new Error('Demo invariant: the Nube Hosting invoice must start in review')
  return {
    ...ws,
    overrides: [
      {
        invoice_id: nube.id,
        fingerprint: pending.decision.fingerprint,
        note: 'Renovación anual del contrato, aprobada por dirección el lunes.',
        created_at: hoursAgo(3),
      },
    ],
  }
}

/**
 * The pain.001 file the demo company would upload today: exactly the
 * invoices the engine let through. Ids are deterministic so the sample is
 * reproducible; the app itself uses random ids.
 */
export function buildDemoPaymentFile(now: Date, today: string): string {
  const queue = buildQueue(buildDemoWorkspace(now, today), now, today)
  const stamp = today.replace(/-/g, '')
  return buildPain001({
    message_id: `DEMO-${stamp}`,
    created_at: now,
    debtor: DEMO_DEBTOR,
    transactions: queue.pay.map((q, i) => ({
      end_to_end_id: `DEMO-${stamp}-${String(i + 1).padStart(3, '0')}`,
      plan: q.decision.plan!,
      remittance_text: q.invoice.invoice_number ?? q.invoice.id,
    })),
  })
}
