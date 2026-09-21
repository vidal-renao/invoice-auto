'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { createPaymentBatch } from '@/lib/actions/payments'
import { maskIban } from '@/lib/payments/iban'
import type { PaymentRoute, Reason } from '@/lib/payments/types'
import { formatCurrency, formatDate } from '@/lib/utils'

import { ReasonList } from './ReasonList'

export interface PayRow {
  invoice_id: string
  supplier: string
  invoice_number: string | null
  due_date: string | null
  amount_cents: number
  currency: string
  iban: string
  route: PaymentRoute
  execution_date: string
  overridden: boolean
  reasons: Reason[]
}

interface PayTableProps {
  rows: PayRow[]
  readOnly: boolean
  canGenerate: boolean
  batchesHref: string
  /** `/{locale}/invoices`, or null where invoices cannot be opened (demo). */
  invoiceBase: string | null
}

/** Totals per currency: EUR and CHF are never added together. */
function totals(rows: PayRow[], locale: string): string {
  const byCurrency = new Map<string, number>()
  for (const r of rows) byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.amount_cents)
  return [...byCurrency.entries()].map(([c, cents]) => formatCurrency(cents, c, locale)).join(' + ')
}

export function PayTable({ rows, readOnly, canGenerate, batchesHref, invoiceBase }: PayTableProps) {
  const t = useTranslations('payments')
  const locale = useLocale()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map((r) => r.invoice_id)))
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.invoice_id)), [rows, selected])
  const allSelected = chosen.length === rows.length && rows.length > 0

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const generate = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await createPaymentBatch({ invoice_ids: chosen.map((r) => r.invoice_id) })
      if (result.ok) {
        setMessage({ kind: 'ok', text: t('queue.generated') })
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: t(`errors.${result.error}`) })
      }
    })
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#2a2a2a] px-4 py-6 text-center text-sm text-[#8a8a8a]">{t('queue.emptyPay')}</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
      {/* Narrow screens: one card per payment, amount always in view. */}
      <ul className="divide-y divide-[#1e1e1e] lg:hidden">
        {rows.map((r) => {
          const href = invoiceBase ? `${invoiceBase}/${r.invoice_id}` : null
          return (
            <li key={r.invoice_id} className="flex gap-3 px-4 py-3">
              {!readOnly && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-violet-500"
                  checked={selected.has(r.invoice_id)}
                  onChange={() => toggle(r.invoice_id)}
                  aria-label={t('queue.select', { invoice: `${r.supplier} ${r.invoice_number ?? ''}`.trim() })}
                />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-[#ededed]">
                    {href ? <Link href={href} className="hover:text-white hover:underline">{r.supplier}</Link> : r.supplier}
                  </p>
                  <p className="shrink-0 font-mono text-sm font-medium tabular-nums text-[#ededed]">
                    {formatCurrency(r.amount_cents, r.currency, locale)}
                  </p>
                </div>
                <p className="text-xs text-[#888]">
                  {r.invoice_number ?? '—'} · <span className="font-mono">{maskIban(r.iban)}</span> · {t(`route.${r.route}`)}
                </p>
                <p className="text-xs text-[#888]">
                  {t('queue.execution')}: <span className="text-[#ccc]">{formatDate(r.execution_date, locale)}</span>
                </p>
                {r.overridden && (
                  <span className="inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300">
                    {t('queue.overridden')}
                  </span>
                )}
                {r.reasons.length > 0 && <ReasonList reasons={r.reasons} currency={r.currency} />}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Wide screens: the table. Focusable so it can be scrolled by keyboard if it ever overflows (WCAG 2.1.1). */}
      <div
        className="hidden overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:block"
        tabIndex={0}
        role="region"
        aria-label={t('outcome.pay')}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-left text-xs text-[#888]">
              {!readOnly && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-violet-500"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.invoice_id)))}
                    aria-label={t('queue.selectAll')}
                  />
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-medium">{t('queue.supplier')}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t('queue.account')}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t('queue.execution')}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t('queue.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e1e]">
            {rows.map((r) => {
              const href = invoiceBase ? `${invoiceBase}/${r.invoice_id}` : null
              return (
                <tr key={r.invoice_id} className="align-top">
                  {!readOnly && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-violet-500"
                        checked={selected.has(r.invoice_id)}
                        onChange={() => toggle(r.invoice_id)}
                        aria-label={t('queue.select', { invoice: `${r.supplier} ${r.invoice_number ?? ''}`.trim() })}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#ededed]">
                      {href ? <Link href={href} className="hover:text-white hover:underline">{r.supplier}</Link> : r.supplier}
                    </p>
                    <p className="mt-0.5 text-xs text-[#888]">
                      {r.invoice_number ?? '—'}
                      {r.due_date && ` · ${t('queue.due')} ${formatDate(r.due_date, locale)}`}
                    </p>
                    {r.overridden && (
                      <span className="mt-1.5 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300">
                        {t('queue.overridden')}
                      </span>
                    )}
                    {r.reasons.length > 0 && (
                      <div className="mt-2 max-w-sm">
                        <ReasonList reasons={r.reasons} currency={r.currency} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-[#ededed]">{maskIban(r.iban)}</p>
                    <p className="mt-0.5 text-xs text-[#888]">{t(`route.${r.route}`)}</p>
                  </td>
                  <td className="px-4 py-3 text-[#ccc]">{formatDate(r.execution_date, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-[#ededed]">
                    {formatCurrency(r.amount_cents, r.currency, locale)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2a2a] px-4 py-3">
          <p className="text-xs text-[#888]">
            {t('queue.selected', { count: chosen.length })}
            {chosen.length > 0 && <span className="ml-2 font-mono text-[#ededed]">{totals(chosen, locale)}</span>}
          </p>
          <Button onClick={generate} loading={pending} disabled={pending || chosen.length === 0 || !canGenerate}>
            {pending ? t('queue.generating') : t('queue.generate')}
          </Button>
        </div>
      )}

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={
            message.kind === 'ok'
              ? 'border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300'
              : 'border-t border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300'
          }
        >
          {message.text}{' '}
          {message.kind === 'ok' && (
            <Link href={batchesHref} className="underline hover:text-white">
              {t('tabs.batches')}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
