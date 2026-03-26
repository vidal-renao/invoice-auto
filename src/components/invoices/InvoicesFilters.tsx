'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'

const STATUSES = ['pending', 'processing', 'review_needed', 'approved', 'rejected'] as const
const CURRENCIES = ['EUR', 'CHF'] as const

export function InvoicesFilters() {
  const t = useTranslations('invoices.filters')
  const tInvoice = useTranslations('invoice')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const vendor = searchParams.get('vendor') ?? ''
  const status = searchParams.get('status') ?? ''
  const currency = searchParams.get('currency') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''
  const hasFilters = vendor || status || currency || dateFrom || dateTo

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const inputClass = cn(
    'h-8 rounded-md border border-[#2a2a2a] bg-[#161616] px-3 text-sm text-[#ededed]',
    'placeholder:text-[#555] focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30',
    'transition-colors'
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Vendor search */}
      <input
        type="text"
        placeholder={t('vendorPlaceholder')}
        value={vendor}
        onChange={(e) => updateFilter('vendor', e.target.value)}
        className={cn(inputClass, 'w-44')}
        aria-label={t('vendorPlaceholder')}
      />

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => updateFilter('status', e.target.value)}
        className={cn(inputClass, 'w-36 pr-7')}
        aria-label={t('allStatuses')}
      >
        <option value="">{t('allStatuses')}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {tInvoice(`status.${s}`)}
          </option>
        ))}
      </select>

      {/* Currency filter */}
      <select
        value={currency}
        onChange={(e) => updateFilter('currency', e.target.value)}
        className={cn(inputClass, 'w-28 pr-7')}
        aria-label={t('allCurrencies')}
      >
        <option value="">{t('allCurrencies')}</option>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => updateFilter('dateFrom', e.target.value)}
        className={cn(inputClass, 'w-36')}
        aria-label={t('dateFrom')}
        title={t('dateFrom')}
      />
      <span className="text-xs text-[#555]">–</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => updateFilter('dateTo', e.target.value)}
        className={cn(inputClass, 'w-36')}
        aria-label={t('dateTo')}
        title={t('dateTo')}
      />

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2a2a2a] px-3 text-xs text-[#888] transition-colors hover:border-[#444] hover:text-[#ededed]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          {t('clear')}
        </button>
      )}
    </div>
  )
}
