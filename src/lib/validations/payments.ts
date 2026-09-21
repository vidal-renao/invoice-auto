import { z } from 'zod'

import { checkIban } from '@/lib/payments/iban'

/**
 * Boundary schemas for payment actions. The database re-checks the
 * critical invariants; these give the user a precise message first.
 */

const Uuid = z.string().uuid()

export const IbanSchema = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const check = checkIban(raw)
    if (!check.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `iban_${check.problem}` })
      return z.NEVER
    }
    return check.iban
  })

export const SettingsSchema = z.object({
  debtor_name: z.string().trim().min(1, 'required').max(70, 'too_long'),
  debtor_iban: IbanSchema,
  debtor_bic: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)?$/, 'bic_invalid'),
  // Entered in whole currency units, stored in cents.
  review_threshold: z.coerce.number().int('integer').positive('positive').max(100_000_000, 'too_large'),
  cooling_off_hours: z.coerce.number().int('integer').min(0, 'range').max(720, 'range'),
})

export const RegisterAccountSchema = z.object({
  /** The invoice whose supplier (and, by default, printed IBAN) is registered. */
  invoice_id: Uuid,
  /** Optional: an IBAN typed by the user instead of the one on the invoice. */
  iban: IbanSchema.optional(),
})

export const VerifyAccountSchema = z.object({
  account_id: Uuid,
  channel: z.enum(['phone_callback', 'in_person', 'signed_letter', 'bank_confirmation']),
  contact: z.string().trim().min(3, 'required').max(200, 'too_long'),
  note: z.string().trim().max(500, 'too_long').optional().default(''),
})

export const RejectAccountSchema = z.object({
  account_id: Uuid,
  reason: z.string().trim().min(3, 'required').max(500, 'too_long'),
})

export const AcceptReviewSchema = z.object({
  invoice_id: Uuid,
  note: z.string().trim().min(3, 'required').max(500, 'too_long'),
})

export const CreateBatchSchema = z.object({
  invoice_ids: z.array(Uuid).min(1, 'required').max(500, 'too_large'),
})

export const BatchIdSchema = z.object({ batch_id: Uuid })

export const CancelBatchSchema = z.object({
  batch_id: Uuid,
  reason: z.string().trim().min(3, 'required').max(500, 'too_long'),
})
