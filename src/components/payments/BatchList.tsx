'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { cancelBatch, markBatchExecuted } from '@/lib/actions/payments'
import { BUSINESS_TIME_ZONE } from '@/lib/payments/dates'
import { cn, formatCurrency } from '@/lib/utils'

export interface BatchView {
  id: string
  message_id: string
  status: 'generated' | 'executed' | 'cancelled'
  tx_count: number
  created_at: string
  executed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  /** Totals per currency; EUR and CHF are never summed together. */
  totals: { currency: string; cents: number }[]
}

const STATUS_STYLE: Record<BatchView['status'], string> = {
  generated: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  executed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  cancelled: 'border-[#333] bg-[#161616] text-[#888]',
}

function BatchActions({ batch }: { batch: BatchView }) {
  const t = useTranslations('payments')
  const router = useRouter()
  const reasonId = useId()
  const [pending, startTransition] = useTransition()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (command: () => ReturnType<typeof markBatchExecuted>) => {
    setError(null)
    startTransition(async () => {
      const result = await command()
      if (!result.ok) {
        setError(t(`errors.${result.error}`))
        return
      }
      setCancelling(false)
      router.refresh()
    })
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[#1e1e1e] pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={pending && !cancelling}
          disabled={pending}
          onClick={() => {
            if (window.confirm(t('batches.markExecutedConfirm'))) run(() => markBatchExecuted({ batch_id: batch.id }))
          }}
        >
          {t('batches.markExecuted')}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setCancelling((v) => !v)} aria-expanded={cancelling}>
          {t('batches.cancel')}
        </Button>
      </div>
      {cancelling && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => cancelBatch({ batch_id: batch.id, reason }))
          }}
        >
          <label htmlFor={reasonId} className="block text-xs text-[#aaa]">{t('batches.cancelReason')}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              maxLength={500}
              aria-describedby={`${reasonId}-hint`}
              className="w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ededed] focus:border-violet-500 focus:outline-none"
            />
            <Button type="submit" size="sm" variant="destructive" loading={pending} disabled={pending || reason.trim().length < 3} className="h-auto shrink-0 py-2">
              {t('batches.cancel')}
            </Button>
          </div>
          <p id={`${reasonId}-hint`} className="text-[11px] text-[#888]">{t('batches.cancelHint')}</p>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  )
}

export function BatchList({ batches, readOnly, downloadBase }: { batches: BatchView[]; readOnly: boolean; downloadBase: string | null }) {
  const t = useTranslations('payments')
  const locale = useLocale()
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: BUSINESS_TIME_ZONE }).format(new Date(iso))

  if (batches.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-sm text-[#8a8a8a]">{t('batches.empty')}</p>
  }

  return (
    <ul className="space-y-3">
      {batches.map((b) => (
        <li key={b.id} className="rounded-xl border border-[#2a2a2a] bg-[#111] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-[#ededed]">{b.message_id}</p>
              <p className="mt-1 text-sm text-[#ccc]">
                {t('batches.summary', {
                  count: b.tx_count,
                  total: b.totals.map((x) => formatCurrency(x.cents, x.currency, locale)).join(' + '),
                })}
              </p>
              <p className="mt-1 text-xs text-[#888]">
                {t('batches.created', { date: dateTime(b.created_at) })}
                {b.executed_at && ` · ${t('batches.executedAt', { date: dateTime(b.executed_at) })}`}
                {b.cancelled_at && ` · ${t('batches.cancelledAt', { date: dateTime(b.cancelled_at), reason: b.cancel_reason ?? '' })}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[b.status])}>
                {t(`batches.status.${b.status}`)}
              </span>
              {downloadBase && b.status !== 'cancelled' && (
                <a
                  href={`${downloadBase}/${b.id}`}
                  className="rounded-md border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#ccc] transition-colors hover:bg-[#1a1a1a] hover:text-[#ededed]"
                >
                  {t('batches.download')}
                </a>
              )}
            </div>
          </div>
          {!readOnly && b.status === 'generated' && <BatchActions batch={b} />}
        </li>
      ))}
    </ul>
  )
}
