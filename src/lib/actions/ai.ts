'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { typedFrom } from '@/lib/supabase/builder'
import type { Invoice, InvoiceInsert } from '@/types/database'
import {
  detectCountryFromTaxId,
  validateVatMath,
  detectReverseCharge,
} from '@/lib/tax/validation'

// ── Tool schema for Claude's extraction (plain JSON Schema — no Zod dependency) ─

interface ExtractedInvoice {
  vendor_name: string | null
  vendor_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  subtotal_cents: number | null
  tax_cents: number | null
  total_cents: number | null
  tax_rate: number | null
  currency: 'EUR' | 'CHF' | 'GBP' | 'USD' | 'SEK' | 'DKK' | 'NOK' | 'PLN' | null
  country_code: string | null
  is_reverse_charge: boolean | null
  is_invoice: boolean | null
  failure_reason: string | null
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_invoice',
  description: 'Extract all fiscal fields from an invoice or receipt document.',
  input_schema: {
    type: 'object',
    properties: {
      vendor_name: { type: ['string', 'null'], description: 'Business name of the vendor or shop' },
      vendor_tax_id: { type: ['string', 'null'], description: 'Tax ID / NIF / CIF / UID / VAT number including country prefix (e.g. ESB12345678, DE123456789)' },
      invoice_number: { type: ['string', 'null'], description: 'Invoice or receipt reference number' },
      invoice_date: { type: ['string', 'null'], description: 'Issue date in YYYY-MM-DD format' },
      subtotal_cents: { type: ['integer', 'null'], description: 'Net amount before tax in integer cents (€12.50 → 1250)' },
      tax_cents: { type: ['integer', 'null'], description: 'Tax amount in integer cents' },
      total_cents: { type: ['integer', 'null'], description: 'Total including tax in integer cents' },
      tax_rate: { type: ['number', 'null'], description: 'Tax rate as decimal fraction (0.21 for 21%)' },
      currency: { type: ['string', 'null'], enum: ['EUR', 'CHF', 'GBP', 'USD', 'SEK', 'DKK', 'NOK', 'PLN', null], description: 'ISO 4217 currency code' },
      country_code: { type: ['string', 'null'], description: 'ISO 3166-1 alpha-2 country code (ES, DE, CH, FR, IT…)' },
      is_reverse_charge: { type: ['boolean', 'null'], description: 'True if invoice mentions Reverse Charge or VAT is 0 for cross-border B2B' },
      is_invoice: { type: ['boolean', 'null'], description: 'True if this is an invoice/receipt/expense document. False for photos, IDs, contracts, etc.' },
      failure_reason: { type: ['string', 'null'], description: 'Only when is_invoice is false or unreadable: "not_invoice", "image_unclear", or "handwritten_only". Null otherwise.' },
    },
    required: ['vendor_name', 'vendor_tax_id', 'invoice_number', 'invoice_date', 'subtotal_cents', 'tax_cents', 'total_cents', 'tax_rate', 'currency', 'country_code', 'is_reverse_charge', 'is_invoice', 'failure_reason'],
  },
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Hard timeout for the Anthropic API call.
 * Must be comfortably below Vercel's serverless function limit (10s Hobby / 60s Pro).
 * Set conservatively so the catch block always runs before Vercel kills the process.
 */
const AI_TIMEOUT_MS = 8_000

/**
 * Analyse a receipt with Claude Vision, extract all fiscal fields, and run the
 * Tax Intelligence Engine to validate VAT rates and detect reverse charge.
 *
 * Status flow:  pending → processing → review_needed (success) | pending (error)
 *
 * Key design decisions:
 *  - Uses AbortController to *actually* cancel the Anthropic HTTP request on timeout.
 *    Without this, Promise.race fires but the Node.js HTTP connection stays open,
 *    keeping the serverless function alive and leaving the client awaiting forever.
 *  - maxRetries: 0 prevents the SDK from retrying (which would multiply the timeout).
 *  - Every DB operation's error is logged explicitly — no silent failures.
 */
export async function analyzeReceipt(invoiceId: string): Promise<void> {
  console.log(`[analyzeReceipt] --- INICIANDO ANÁLISIS --- invoiceId=${invoiceId}`)

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[analyzeReceipt] ANTHROPIC_API_KEY not set — skipping analysis')
    return
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[analyzeReceipt] No authenticated user — aborting')
    return
  }

  console.log(`[analyzeReceipt] user=${user.id} — fetching invoice + profile`)

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
  if (invoiceRes.error) {
    console.error('[analyzeReceipt] Failed to fetch invoice:', invoiceRes.error.message)
  }
  if (!invoice?.receipt_path) {
    console.warn('[analyzeReceipt] Invoice not found or missing receipt_path — aborting')
    return
  }

  const userCountry =
    (profileRes.data as { country: string } | null)?.country ?? null

  // ── Mark as processing ─────────────────────────────────────────────────────
  const { error: processingErr } = await typedFrom<Invoice, InvoiceInsert>(
    supabase,
    'invoices'
  )
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('user_id', user.id)

  if (processingErr) {
    console.error('[analyzeReceipt] Failed to mark as processing:', processingErr.message)
  }

  console.log(`[analyzeReceipt] Marked as processing — calling Claude Vision`)

  // ── AbortController — cancels the actual HTTP connection on timeout ────────
  // Unlike Promise.race alone, this ensures Node.js releases the socket so the
  // serverless function can complete and return a response to the client.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.warn(`[analyzeReceipt] Aborting after ${AI_TIMEOUT_MS / 1000}s`)
    controller.abort()
  }, AI_TIMEOUT_MS)

  try {
    // Generate a signed URL (1 h) so Claude can fetch the file
    const { data: signed } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.receipt_path, 3600)

    if (!signed?.signedUrl) throw new Error('Could not generate signed URL')

    const isPDF = invoice.receipt_path.toLowerCase().endsWith('.pdf')

    // ── Call Claude Vision ─────────────────────────────────────────────────
    // maxRetries: 0 prevents the SDK from issuing silent retries that would
    // each consume up to AI_TIMEOUT_MS, blowing past the Vercel function limit.
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 0,
    })

    const response = await anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_invoice' },
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
      },
      // Pass the abort signal so the HTTP connection is cancelled when the
      // AbortController fires — this allows the serverless function to exit cleanly.
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)
    console.log(`[analyzeReceipt] Claude responded — stop_reason=${response.stop_reason}`)

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'extract_invoice'
    )
    const extracted = toolBlock ? (toolBlock.input as ExtractedInvoice) : null

    // ── Guard: document is not an invoice ─────────────────────────────────
    if (extracted && extracted.is_invoice === false) {
      const reason = extracted.failure_reason ?? 'not_invoice'
      console.warn(`[analyzeReceipt] Document is not an invoice — failure_reason=${reason}`)
      const { error: notInvErr } = await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
        .update({ status: 'review_needed', failure_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('user_id', user.id)
      if (notInvErr) console.error('[analyzeReceipt] not_invoice UPDATE failed:', notInvErr.message)
      return
    }

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

      // 4. Map extracted currency (schema allows more codes; DB only stores EUR/CHF)
      const currency =
        extracted.currency === 'EUR' || extracted.currency === 'CHF'
          ? extracted.currency
          : invoice.currency

      console.log(
        `[analyzeReceipt] Extracted: country=${countryCode} vatStatus=${taxValidationStatus} rc=${isReverseCharge}`
      )

      // 5. Persist all fields
      const { error: updateErr } = await typedFrom<Invoice, InvoiceInsert>(
        supabase,
        'invoices'
      )
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
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('user_id', user.id)

      if (updateErr) {
        console.error('[analyzeReceipt] Final UPDATE failed:', updateErr.message)
      } else {
        console.log(`[analyzeReceipt] ✓ Invoice ${invoiceId} → review_needed`)
      }
    } else {
      // Claude responded but structured output parsing failed
      console.warn('[analyzeReceipt] parsed_output is null — setting review_needed with no data')
      const { error: updateErr } = await typedFrom<Invoice, InvoiceInsert>(
        supabase,
        'invoices'
      )
        .update({ status: 'review_needed', failure_reason: 'parsing_failed', updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('user_id', user.id)

      if (updateErr) {
        console.error('[analyzeReceipt] review_needed UPDATE failed:', updateErr.message)
      }
    }
  } catch (err) {
    clearTimeout(timeoutId)

    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('abort'))

    if (isAbort) {
      console.warn(
        `[analyzeReceipt] Request aborted after ${AI_TIMEOUT_MS / 1000}s for invoice ${invoiceId} — setting review_needed`
      )
      const { error: updateErr } = await typedFrom<Invoice, InvoiceInsert>(
        supabase,
        'invoices'
      )
        .update({ status: 'review_needed', failure_reason: 'timeout_8s', updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('user_id', user.id)

      if (updateErr) {
        console.error('[analyzeReceipt] Abort recovery UPDATE failed:', updateErr.message)
      }
      return
    }

    const message = err instanceof Error ? err.message : String(err)
    console.error(`[analyzeReceipt] Unexpected error for invoice ${invoiceId}:`, message)

    // Set review_needed (NOT pending) — reverting to pending would cause an
    // infinite retry loop in the client if analysis is re-triggered automatically,
    // burning API credits on each cycle.
    const { error: revertErr } = await typedFrom<Invoice, InvoiceInsert>(
      supabase,
      'invoices'
    )
      .update({ status: 'review_needed', failure_reason: message.slice(0, 200), updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('user_id', user.id)

    if (revertErr) {
      console.error('[analyzeReceipt] Error recovery UPDATE failed:', revertErr.message)
    }
  }
}
