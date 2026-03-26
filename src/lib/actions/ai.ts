'use server'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { typedFrom } from '@/lib/supabase/builder'
import type { Invoice, InvoiceInsert } from '@/types/database'
import {
  detectCountryFromTaxId,
  validateVatMath,
  detectReverseCharge,
} from '@/lib/tax/validation'

// ── Structured-output schema for Claude's extraction ─────────────────────────

const ExtractedInvoiceSchema = z.object({
  vendor_name: z
    .string()
    .nullable()
    .describe('Business name of the vendor or shop'),
  vendor_tax_id: z
    .string()
    .nullable()
    .describe(
      'Tax ID / NIF / CIF / UID / VAT number of the vendor, including country prefix if present (e.g. ESB12345678, DE123456789, CHE-123.456.789)'
    ),
  invoice_number: z
    .string()
    .nullable()
    .describe('Invoice or receipt reference number'),
  invoice_date: z
    .string()
    .nullable()
    .describe('Issue date in YYYY-MM-DD format'),
  subtotal_cents: z
    .number()
    .int()
    .nullable()
    .describe('Net amount before tax, in integer cents (e.g. €12.50 → 1250)'),
  tax_cents: z
    .number()
    .int()
    .nullable()
    .describe('Tax amount in integer cents'),
  total_cents: z
    .number()
    .int()
    .nullable()
    .describe('Total including tax in integer cents'),
  tax_rate: z
    .number()
    .nullable()
    .describe('Tax rate as a decimal fraction (e.g. 0.21 for 21 % IVA)'),
  currency: z
    .enum(['EUR', 'CHF', 'GBP', 'USD', 'SEK', 'DKK', 'NOK', 'PLN'])
    .nullable()
    .describe('ISO 4217 currency code detected from the document'),
  country_code: z
    .string()
    .nullable()
    .describe(
      'ISO 3166-1 alpha-2 country code of the vendor (e.g. ES, DE, CH, FR, IT). Infer from the Tax ID prefix, currency, address, or language of the document.'
    ),
  is_reverse_charge: z
    .boolean()
    .nullable()
    .describe(
      'True if the invoice explicitly mentions "Reverse Charge", "Inversión del Sujeto Pasivo", or equivalent in any language, or if the tax amount is 0 for an intra-community B2B supply.'
    ),
})

// ── Action ────────────────────────────────────────────────────────────────────

const AI_TIMEOUT_MS = 15_000

/**
 * Analyse a receipt with Claude Vision, extract all fiscal fields, and run the
 * Tax Intelligence Engine to validate VAT rates and detect reverse charge.
 *
 * Status flow:  pending → processing → review_needed (success) | pending (error)
 *
 * Called from ScanTicketButton after the file has been uploaded.
 * The Anthropic API key never touches the client.
 */
export async function analyzeReceipt(invoiceId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[analyzeReceipt] ANTHROPIC_API_KEY not set — skipping analysis')
    return
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Fetch the invoice row + user profile (for reverse-charge country comparison)
  const [invoiceRes, profileRes] = await Promise.all([
    typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single(),
    supabase.from('profiles').select('country').eq('id', user.id).single(),
  ])

  const invoice = invoiceRes.data
  if (!invoice?.receipt_path) return

  const userCountry = (profileRes.data as { country: string } | null)?.country ?? null

  // ── Mark as processing ─────────────────────────────────────────────────────
  await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('user_id', user.id)

  try {
    // Generate a signed URL (1 h) so Claude can fetch the file
    const { data: signed } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.receipt_path, 3600)

    if (!signed?.signedUrl) throw new Error('Could not generate signed URL')

    const isPDF = invoice.receipt_path.toLowerCase().endsWith('.pdf')

    // ── Call Claude Vision with 15 s hard timeout ──────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
    )

    const parsePromise = anthropic.messages.parse({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      output_config: {
        format: zodOutputFormat(ExtractedInvoiceSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            ...(isPDF
              ? [
                  {
                    type: 'document' as const,
                    source: { type: 'url' as const, url: signed.signedUrl },
                  },
                ]
              : [
                  {
                    type: 'image' as const,
                    source: { type: 'url' as const, url: signed.signedUrl },
                  },
                ]),
            {
              type: 'text' as const,
              text: [
                'Extract all invoice/receipt data from this document.',
                'Convert every monetary amount to integer cents (e.g. €12.50 → 1250, CHF 8.00 → 800).',
                'Dates must be formatted as YYYY-MM-DD.',
                'For currency use the ISO 4217 code (EUR, CHF, GBP, USD, SEK, DKK, NOK, PLN).',
                'For country_code use ISO 3166-1 alpha-2 (ES, DE, CH, FR, IT, GB, NL, …).',
                'Infer the country from the Tax ID prefix, address, document language, or currency.',
                'For vendor_tax_id include the country prefix if visible (e.g. ESB12345678).',
                'Set is_reverse_charge to true if the document mentions "Reverse Charge",',
                '"Inversión del Sujeto Pasivo", "Steuerschuldnerschaft des Leistungsempfängers",',
                '"autoliquidación", or if the VAT amount is 0 for a cross-border B2B supply.',
                'Return null for any field you cannot determine with confidence.',
              ].join(' '),
            },
          ],
        },
      ],
    })

    const response = await Promise.race([parsePromise, timeoutPromise])
    const extracted = response.parsed_output

    // ── Tax Intelligence Engine ────────────────────────────────────────────
    if (extracted) {
      // 1. Determine country: trust AI first, fall back to Tax ID detection
      const countryCode =
        extracted.country_code ??
        detectCountryFromTaxId(extracted.vendor_tax_id)

      // 2. Validate VAT math against legal rates
      const taxValidationStatus = validateVatMath(
        extracted.subtotal_cents,
        extracted.tax_cents,
        extracted.total_cents,
        countryCode
      )

      // 3. Detect reverse charge
      const isReverseCharge =
        extracted.is_reverse_charge ??
        detectReverseCharge(
          extracted.tax_cents,
          extracted.subtotal_cents,
          countryCode,
          userCountry,
          JSON.stringify(response)
        )

      // 4. Map extracted currency (schema now allows more codes, DB only stores EUR/CHF)
      const currency =
        extracted.currency === 'EUR' || extracted.currency === 'CHF'
          ? extracted.currency
          : invoice.currency

      // 5. Persist all fields
      await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
        .update({
          vendor_name: extracted.vendor_name,
          vendor_tax_id: extracted.vendor_tax_id,
          invoice_number: extracted.invoice_number,
          invoice_date: extracted.invoice_date,
          subtotal_cents: extracted.subtotal_cents,
          tax_cents: extracted.tax_cents,
          total_cents: extracted.total_cents,
          tax_rate: extracted.tax_rate,
          currency,
          country_code: countryCode,
          is_reverse_charge: isReverseCharge ?? false,
          tax_validation_status: taxValidationStatus,
          status: 'review_needed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('user_id', user.id)
    } else {
      // Claude responded but structured output parsing failed
      await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
        .update({ status: 'review_needed', updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('user_id', user.id)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (message === 'AI_TIMEOUT') {
      console.warn(
        `[analyzeReceipt] Timed out after ${AI_TIMEOUT_MS / 1000}s for invoice ${invoiceId}`
      )
      await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
        .update({ status: 'review_needed', updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('user_id', user.id)
      return
    }

    console.error('[analyzeReceipt] Error:', message)
    await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('user_id', user.id)
  }
}
