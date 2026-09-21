import { useLocale, useTranslations } from 'next-intl'

import { BUSINESS_TIME_ZONE } from '@/lib/payments/dates'
import type { AuditRow } from '@/lib/payments/repository'

/** Keys shown in the detail column; the full JSON stays in the database. */
const DETAIL_KEYS = ['supplier_key', 'iban', 'previous_iban', 'channel', 'cooling_off_until', 'reason', 'note', 'message_id', 'tx_count']

function summarise(details: Record<string, unknown>): string {
  const parts: string[] = []
  for (const key of DETAIL_KEYS) {
    const value = details[key]
    if (value === null || value === undefined || value === '') continue
    parts.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
  }
  if (Array.isArray(details.decisions)) parts.push(`decisions: ${details.decisions.length}`)
  return parts.join(' · ')
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations('payments.audit')
  const locale = useLocale()
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium', timeZone: BUSINESS_TIME_ZONE }).format(new Date(iso))

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-sm text-[#8a8a8a]">{t('empty')}</p>
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      tabIndex={0}
      role="region"
      aria-label={t('title')}
    >
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a] text-left text-xs text-[#888]">
            <th scope="col" className="px-4 py-3 font-medium">{t('when')}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t('what')}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t('details')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e1e]">
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-[#aaa]">{when(r.occurred_at)}</td>
              <td className="px-4 py-2.5 text-[#ededed]">{t.has(`action.${r.action}`) ? t(`action.${r.action}`) : r.action}</td>
              <td className="break-all px-4 py-2.5 font-mono text-[11px] leading-relaxed text-[#888]">{summarise(r.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
