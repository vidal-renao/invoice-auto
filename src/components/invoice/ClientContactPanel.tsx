'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Currency } from '@/types/database'

interface ClientContactPanelProps {
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  clientTaxId: string | null
  invoiceNumber: string | null
  totalCents: number | null
  currency: Currency
  dueDate: string | null
  locale: string
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

export function ClientContactPanel({
  clientName,
  clientEmail,
  clientPhone,
  clientTaxId,
  invoiceNumber,
  totalCents,
  currency,
  dueDate,
  locale,
}: ClientContactPanelProps) {
  const t = useTranslations('invoice')

  const hasAnyContact = clientName || clientEmail || clientPhone || clientTaxId
  if (!hasAnyContact) return null

  const amountLabel = totalCents != null ? formatCurrency(totalCents, currency, locale) : ''
  const dueDateLabel = dueDate ? formatDate(dueDate, locale) : ''

  // Build WhatsApp/email message
  const message = t('client.paymentMessage', {
    name: clientName ?? '',
    number: invoiceNumber ?? '-',
    amount: amountLabel,
    date: dueDateLabel,
  })

  const whatsappNumber = clientPhone?.replace(/[^0-9+]/g, '')
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : null
  const emailUrl = clientEmail
    ? `mailto:${clientEmail}?subject=${encodeURIComponent(`Invoice ${invoiceNumber ?? ''}`)}&body=${encodeURIComponent(message)}`
    : null
  const phoneUrl = clientPhone ? `tel:${clientPhone}` : null

  return (
    <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
      <div className="border-b border-[#2a2a2a] px-4 py-3">
        <p className="text-xs font-medium text-[#888]">{t('client.title')}</p>
      </div>

      <div className="px-4 py-3 space-y-2">
        {clientName && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#888]">{t('client.name')}</span>
            <span className="font-medium text-[#ededed]">{clientName}</span>
          </div>
        )}
        {clientTaxId && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#888]">{t('client.taxId')}</span>
            <span className="font-mono text-xs text-[#aaa]">{clientTaxId}</span>
          </div>
        )}
        {clientEmail && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#888]">{t('client.email')}</span>
            <span className="text-[#aaa] text-xs">{clientEmail}</span>
          </div>
        )}
        {clientPhone && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#888]">{t('client.phone')}</span>
            <span className="text-[#aaa] text-xs">{clientPhone}</span>
          </div>
        )}
      </div>

      {/* Contact action buttons */}
      {(emailUrl || whatsappUrl || phoneUrl) && (
        <div className="border-t border-[#2a2a2a] px-4 py-3">
          <p className="mb-2.5 text-xs text-[#555]">
            {totalCents != null && (
              <span>
                {t('fiscal.total')}: <span className="font-semibold text-violet-300">{amountLabel}</span>
                {dueDate && <> · {t('details.dueDate')}: <span className="text-[#888]">{dueDateLabel}</span></>}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {emailUrl && (
              <a
                href={emailUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#888] transition-colors hover:border-violet-500/40 hover:text-violet-300"
              >
                <MailIcon className="h-3.5 w-3.5" />
                {t('client.sendEmail')}
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                {t('client.sendWhatsApp')}
              </a>
            )}
            {phoneUrl && (
              <a
                href={phoneUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#888] transition-colors hover:border-blue-500/40 hover:text-blue-300"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                {t('client.callPhone')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
