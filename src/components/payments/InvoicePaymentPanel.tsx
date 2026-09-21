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
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111]">
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
        <p className="text-xs font-medium text-[#888]">{t('invoicePanel.title')}</p>
        {item && <OutcomeBadge outcome={item.decision.outcome} label={t(`outcome.${item.decision.outcome}`)} />}
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        {settled && <p className="text-[#ccc]">{t('invoicePanel.settled', { state: t(`paymentState.${settled.state}`) })}</p>}
        {!settled && !item && <p className="text-[#888]">{t('invoicePanel.notApproved')}</p>}
        {item && item.decision.reasons.length > 0 && (
          <ReasonList reasons={item.decision.reasons} currency={item.invoice.currency ?? 'EUR'} />
        )}
        {item?.decision.overridden && <p className="text-xs text-violet-300">{t('queue.overridden')}</p>}
        {(item || settled) && (
          <Link href={paymentsHref} className="inline-block text-xs text-violet-300 underline hover:text-violet-200">
            {t('invoicePanel.openQueue')}
          </Link>
        )}
      </div>
    </div>
  )
}
