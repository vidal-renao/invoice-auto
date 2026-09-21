import { useLocale, useTranslations } from 'next-intl'

import { BUSINESS_TIME_ZONE } from '@/lib/payments/dates'
import type { Outcome, Reason } from '@/lib/payments/types'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

const SEVERITY_STYLE: Record<Reason['severity'], string> = {
  stop: 'border-red-500/30 bg-red-500/5 text-red-300',
  review: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
  info: 'border-[#2a2a2a] bg-transparent text-[#999]',
}

const SEVERITY_DOT: Record<Reason['severity'], string> = {
  stop: 'bg-red-400',
  review: 'bg-amber-400',
  info: 'bg-[#666]',
}

export const OUTCOME_STYLE: Record<Outcome, string> = {
  pay: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  stop: 'border-red-500/30 bg-red-500/10 text-red-300',
}

export function OutcomeBadge({ outcome, label }: { outcome: Outcome; label: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', OUTCOME_STYLE[outcome])}>
      {label}
    </span>
  )
}

function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(iso))
}

/**
 * One reason, rendered as a sentence with its evidence. Evidence arrives as
 * raw facts (cents, ISO dates, codes) and is formatted here for the locale.
 */
export function ReasonList({ reasons, currency }: { reasons: readonly Reason[]; currency: string }) {
  const t = useTranslations('payments')
  const tStatus = useTranslations('invoice.status')
  const locale = useLocale()

  if (reasons.length === 0) return null

  const param = (key: string, value: string | number): string => {
    if (key.endsWith('_cents') && typeof value === 'number') return formatCurrency(value, currency, locale)
    if ((key === 'until' || key === 'registered_at') && typeof value === 'string') return formatDateTime(value, locale)
    if (key === 'other_date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, locale)
    if (key === 'other_state' || key === 'status') {
      if (value === 'paid' || value === 'in_batch') return t(`paymentState.${value}`)
      if (['pending', 'processing', 'review_needed', 'approved', 'rejected'].includes(String(value))) {
        return tStatus(String(value))
      }
    }
    if (key === 'problem') return t(`errors.iban_${value}`)
    if (key === 'factor' && typeof value === 'number') return new Intl.NumberFormat(locale).format(value)
    return String(value)
  }

  return (
    <ul className="space-y-1.5">
      {reasons.map((reason, index) => {
        const values: Record<string, string | number> = {}
        for (const [key, value] of Object.entries(reason.evidence)) {
          // `days` feeds an ICU plural, so it stays a number.
          values[key] = key === 'days' ? value : param(key, value)
        }
        const key =
          reason.code === 'no_bank_account' && 'invoice_iban' in reason.evidence
            ? 'no_bank_account_with_iban'
            : reason.code
        return (
          <li
            key={`${reason.code}-${index}`}
            className={cn('flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed', SEVERITY_STYLE[reason.severity])}
          >
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', SEVERITY_DOT[reason.severity])} aria-hidden="true" />
            <span>{t(`reasons.${key}`, values)}</span>
          </li>
        )
      })}
    </ul>
  )
}
