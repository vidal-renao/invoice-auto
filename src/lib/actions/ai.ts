'use server'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { typedFrom } from '@/lib/supabase/builder'
import type { Invoice, InvoiceInsert } from '@/types/database'

// ── Structured-output schema for Claude's extraction ─────────────────────────

const ExtractedInvoiceSchema = z.object({
  vendor_name: z
    .string()
    .nullable()
    .describe('Business name of the vendor or shop'),
  vendor_tax_id: z
    .string()
    .nullable()
    .describe('Tax ID / NIF / CIF / UID / VAT number of the vendor'),
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
    .enum(['EUR', 'CHF'])
    .nullable()
    .describe('ISO currency code: EUR for euros, CHF for Swiss francs'),
})

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Analyse a receipt with Claude Vision and persist the extracted fields.
 *
 * Status flow:  pending → processing → review_needed (success) | pending (error)
 *
 * Called from ScanTicketButton after the file has been uploaded and the invoice
 * record created.  Runs server-side — the API key never touches the client.
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

  // Fetch the invoice row
  const qb = typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
  const { data: invoice } = await qb
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!invoice?.receipt_path) return

  // ── Mark as processing ────────────────────────────────────────────────────
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

    // ── Call Claude Vision ─────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.parse({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      output_config: {
        format: zodOutputFormat(ExtractedInvoiceSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            // Receipt content — image or PDF document
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
                'For currency: EUR for euros (€), CHF for Swiss francs (Fr./CHF).',
                'Return null for any field you cannot determine with confidence.',
              ].join(' '),
            },
          ],
        },
      ],
    })

    const extracted = response.parsed_output

    // ── Persist extracted fields ───────────────────────────────────────────
    if (extracted) {
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
          currency: extracted.currency ?? invoice.currency,
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
    console.error('[analyzeReceipt] Error:', message)

    // Revert to pending so the user can retry
    await typedFrom<Invoice, InvoiceInsert>(supabase, 'invoices')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('user_id', user.id)
  }
}
