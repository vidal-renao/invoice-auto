import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

const CurrencySchema = z.enum(['EUR', 'CHF'])

const InvoiceStatusSchema = z.enum([
  'pending',
  'processing',
  'review_needed',
  'approved',
  'rejected',
])

/** Storage path inside the `invoices` bucket: {user_id}/{uuid}.{ext} */
const ReceiptPathSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i,
    'Invalid receipt path — expected {uuid}/{uuid}.{ext}'
  )

/** ISO date string YYYY-MM-DD */
const IsoDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .nullable()

/** Integer cents — must be non-negative */
const CentsSchema = z.number().int('Must be integer cents').min(0).nullable()

/** Tax rate as decimal 0–1 (e.g. 0.21 for 21% IVA) */
const TaxRateSchema = z.number().min(0).max(1).nullable()

/** AI confidence 0.000–1.000 */
const ConfidenceSchema = z.number().min(0).max(1).nullable()

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * Validates the payload passed to `createInvoiceRecord`.
 * Only receipt_path is required at creation time.
 */
export const CreateInvoiceSchema = z.object({
  receipt_path: ReceiptPathSchema,
})

/**
 * Validates the AI-extracted payload before writing to the `invoices` table.
 * All fields are optional — partial updates are allowed.
 */
export const AiInvoiceUpdateSchema = z
  .object({
    vendor_name: z.string().max(255).nullable(),
    vendor_tax_id: z
      .string()
      .max(50)
      .regex(
        /^([A-Z0-9]{6,20}|CHE-\d{3}\.\d{3}\.\d{3})$/i,
        'Must be a valid NIF/CIF or Swiss UID (CHE-xxx.xxx.xxx)'
      )
      .nullable(),
    invoice_number: z.string().max(100).nullable(),
    invoice_date: IsoDaySchema,
    subtotal_cents: CentsSchema,
    tax_cents: CentsSchema,
    total_cents: CentsSchema,
    tax_rate: TaxRateSchema,
    currency: CurrencySchema.nullable(),
    ai_confidence: ConfidenceSchema,
    status: InvoiceStatusSchema,
    updated_at: z.string().datetime(),
  })
  .partial()
  .required({ status: true, updated_at: true })

/**
 * Validates user-driven updates (notes, status approvals/rejections).
 */
export const UserInvoiceUpdateSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['approved', 'rejected']).optional(),
  updated_at: z.string().datetime(),
})

/**
 * Validates query filters for the invoice list.
 */
export const InvoiceFiltersSchema = z.object({
  status: InvoiceStatusSchema.optional(),
  currency: CurrencySchema.optional(),
  from: IsoDaySchema.optional(),
  to: IsoDaySchema.optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

// ── Exports ───────────────────────────────────────────────────────────────────

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>
export type AiInvoiceUpdate = z.infer<typeof AiInvoiceUpdateSchema>
export type UserInvoiceUpdate = z.infer<typeof UserInvoiceUpdateSchema>
export type InvoiceFilters = z.infer<typeof InvoiceFiltersSchema>
