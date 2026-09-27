import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type { Queue } from '@/lib/payments/queue'

import { OutcomeBadge, ReasonList } from './ReasonList'

/** "Can this invoice be paid?" — the queue's answer for one invoice. */
export function InvoicePaymentPanel({ invoiceId, queue, paymentsHref }: { invoiceId: string; queue: Queue; paymentsHref: string }) {
  const t = useTranslations('payments')

  const settled = queue.settled.find((s) => s.invoice.id === invoiceId)
  const item = [...queue.pay, ...queue.review, ...queue.stop].find((q) => q.invoice.id === invoiceId)

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-xs font-medium text-muted">{t('invoicePanel.title')}</p>
        {item && <OutcomeBadge outcome={item.decision.outcome} label={t(`outcome.${item.decision.outcome}`)} />}
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        {settled && <p className="text-ink-soft">{t('invoicePanel.settled', { state: t(`paymentState.${settled.state}`) })}</p>}
        {!settled && !item && <p className="text-muted">{t('invoicePanel.notApproved')}</p>}
        {item && item.decision.reasons.length > 0 && (
          <ReasonList reasons={item.decision.reasons} currency={item.invoice.currency ?? 'EUR'} />
        )}
        {item?.decision.overridden && <p className="text-xs text-accent-text">{t('queue.overridden')}</p>}
        {(item || settled) && (
          <Link href={paymentsHref} className="inline-flex min-h-11 items-center text-xs text-accent-text underline underline-offset-2 hover:text-accent-text">
            {t('invoicePanel.openQueue')}
          </Link>
        )}
      </div>
    </div>
  )
}
