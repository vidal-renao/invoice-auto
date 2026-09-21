import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { maskIban } from '@/lib/payments/iban'
import type { Queue, QueueItem } from '@/lib/payments/queue'
import type { Outcome } from '@/lib/payments/types'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

import { PayTable, type PayRow } from './PayTable'
import { AcceptReviewForm, RegisterAccountForm } from './QueueForms'
import { OUTCOME_STYLE, ReasonList } from './ReasonList'

interface QueueViewProps {
  queue: Queue
  /** Demo: everything visible, nothing actionable. */
  readOnly: boolean
  settingsMissing: boolean
  /** `/{locale}/payments`, used for links between the payment screens. */
  basePath: string
  /** `/{locale}/invoices`, or null when invoices cannot be opened. */
  invoiceBase: string | null
}

function toPayRow(item: QueueItem): PayRow {
  const plan = item.decision.plan!
  return {
    invoice_id: item.invoice.id,
    supplier: item.account?.supplier_name ?? item.invoice.vendor_name ?? '—',
    invoice_number: item.invoice.invoice_number,
    due_date: item.invoice.due_date,
    amount_cents: plan.amount_cents,
    currency: plan.currency,
    iban: plan.creditor_iban,
    route: plan.route,
    execution_date: plan.requested_execution_date,
    overridden: item.decision.overridden,
    reasons: item.decision.reasons,
  }
}

function StatTile({ outcome, label, count, hint }: { outcome: Outcome | 'settled'; label: string; count: number; hint?: string }) {
  const accent =
    outcome === 'settled' ? 'text-[#ededed]' : outcome === 'pay' ? 'text-emerald-300' : outcome === 'review' ? 'text-amber-300' : 'text-red-300'
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-[#888]">{label}</p>
      <p className={cn('mt-2 font-mono text-2xl font-semibold tabular-nums', accent)}>{count}</p>
      {hint && <p className="mt-1 text-xs text-[#888]">{hint}</p>}
    </div>
  )
}

function ItemCard({
  item,
  readOnly,
  basePath,
  invoiceBase,
}: {
  item: QueueItem
  readOnly: boolean
  basePath: string
  invoiceBase: string | null
}) {
  const t = useTranslations('payments')
  const locale = useLocale()
  const { invoice, decision, account } = item
  const currency = invoice.currency ?? 'EUR'
  const codes = new Set(decision.reasons.map((r) => r.code))

  // What the person can do from here. A mismatched IBAN deliberately gets no
  // "register" shortcut: the answer to that alarm is a phone call, not a click.
  const canRegister = !readOnly && !codes.has('iban_mismatch') && (codes.has('no_bank_account') || codes.has('account_rejected'))
  const canVerify = codes.has('account_unverified') && account

  return (
    <li className="rounded-xl border border-[#2a2a2a] bg-[#111] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[#ededed]">
            {invoiceBase ? (
              <Link href={`${invoiceBase}/${invoice.id}`} className="hover:text-white hover:underline">
                {invoice.vendor_name ?? '—'}
              </Link>
            ) : (
              (invoice.vendor_name ?? '—')
            )}
          </p>
          <p className="mt-0.5 text-xs text-[#888]">
            {invoice.invoice_number ?? '—'}
            {invoice.invoice_date && ` · ${formatDate(invoice.invoice_date, locale)}`}
            {invoice.due_date && ` · ${t('queue.due')} ${formatDate(invoice.due_date, locale)}`}
            {account && <span className="font-mono"> · {maskIban(account.iban)}</span>}
          </p>
        </div>
        <p className="font-mono text-sm font-medium tabular-nums text-[#ededed]">
          {invoice.total_cents != null ? formatCurrency(invoice.total_cents, currency, locale) : '—'}
        </p>
      </div>

      <div className="mt-3">
        <ReasonList reasons={decision.reasons} currency={currency} />
      </div>

      {canVerify && (
        <p className="mt-3 text-xs">
          <Link
            href={readOnly ? `#account-${account.id}` : `${basePath}/suppliers#account-${account.id}`}
            className="text-violet-300 underline hover:text-violet-200"
          >
            {t('queue.goVerify')}
          </Link>
        </p>
      )}
      {canRegister && <RegisterAccountForm invoiceId={invoice.id} printedIban={invoice.payment_iban} />}
      {!readOnly && decision.outcome === 'review' && <AcceptReviewForm invoiceId={invoice.id} />}
    </li>
  )
}

function Section({
  outcome,
  title,
  hint,
  count,
  children,
}: {
  outcome: Outcome
  title: string
  hint: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`section-${outcome}`} className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`section-${outcome}`} className="flex items-center gap-2 text-base font-semibold text-[#ededed]">
          <span className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs', OUTCOME_STYLE[outcome])}>
            {count}
          </span>
          {title}
        </h2>
        <p className="text-xs text-[#888]">{hint}</p>
      </div>
      {children}
    </section>
  )
}

export function QueueView({ queue, readOnly, settingsMissing, basePath, invoiceBase }: QueueViewProps) {
  const t = useTranslations('payments')
  const locale = useLocale()

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile outcome="pay" label={t('stats.pay')} count={queue.pay.length} />
        <StatTile outcome="review" label={t('stats.review')} count={queue.review.length} />
        <StatTile outcome="stop" label={t('stats.stop')} count={queue.stop.length} />
        <StatTile outcome="settled" label={t('stats.settled')} count={queue.settled.length} />
      </div>

      {queue.awaiting_approval > 0 && (
        <p className="text-xs text-[#888]">
          {invoiceBase ? (
            <Link href={`${invoiceBase}?status=review_needed`} className="underline hover:text-[#ededed]">
              {t('stats.awaitingApproval', { count: queue.awaiting_approval })}
            </Link>
          ) : (
            t('stats.awaitingApproval', { count: queue.awaiting_approval })
          )}
        </p>
      )}

      {settingsMissing && !readOnly && (
        <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {t('queue.settingsMissing')}{' '}
          <Link href={`${basePath}/settings`} className="underline hover:text-white">
            {t('tabs.settings')}
          </Link>
        </p>
      )}

      <Section outcome="pay" title={t('outcome.pay')} hint={t('outcome.payHint')} count={queue.pay.length}>
        <PayTable
          rows={queue.pay.map(toPayRow)}
          readOnly={readOnly}
          canGenerate={!settingsMissing}
          batchesHref={`${basePath}/batches`}
          invoiceBase={invoiceBase}
        />
      </Section>

      <Section outcome="review" title={t('outcome.review')} hint={t('outcome.reviewHint')} count={queue.review.length}>
        {queue.review.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#2a2a2a] px-4 py-6 text-center text-sm text-[#8a8a8a]">{t('queue.emptyReview')}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {queue.review.map((item) => (
              <ItemCard key={item.invoice.id} item={item} readOnly={readOnly} basePath={basePath} invoiceBase={invoiceBase} />
            ))}
          </ul>
        )}
      </Section>

      <Section outcome="stop" title={t('outcome.stop')} hint={t('outcome.stopHint')} count={queue.stop.length}>
        {queue.stop.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#2a2a2a] px-4 py-6 text-center text-sm text-[#8a8a8a]">{t('queue.emptyStop')}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {queue.stop.map((item) => (
              <ItemCard key={item.invoice.id} item={item} readOnly={readOnly} basePath={basePath} invoiceBase={invoiceBase} />
            ))}
          </ul>
        )}
      </Section>

      {queue.settled.length > 0 && (
        <section aria-labelledby="section-settled" className="space-y-3">
          <h2 id="section-settled" className="text-base font-semibold text-[#ededed]">
            {t('stats.settled')}
          </h2>
          <ul className="divide-y divide-[#1e1e1e] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
            {queue.settled.map(({ invoice, state }) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="text-[#ccc]">
                  {invoice.vendor_name ?? '—'} <span className="text-xs text-[#888]">{invoice.invoice_number}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-[#aaa]">
                    {invoice.total_cents != null ? formatCurrency(invoice.total_cents, invoice.currency ?? 'EUR', locale) : '—'}
                  </span>
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      state === 'paid'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-violet-500/30 bg-violet-500/10 text-violet-300',
                    )}
                  >
                    {t(`paymentState.${state}`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
