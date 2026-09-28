'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

const STATUSES = ['pending', 'processing', 'review_needed', 'approved', 'rejected'] as const
const CURRENCIES = ['EUR', 'CHF'] as const

/**
 * Filters as a plain GET form.
 *
 * This used to push the new query string with the client router. Every layer of
 * that was verified to work in isolation — the select wrote the parameter, the
 * server received it, the query was valid — and yet filtering did not work for
 * the user, which means the failure lived somewhere between the client cache
 * and the render that no log could see.
 *
 * A form removes the question instead of answering it: changing a filter is a
 * real navigation, the server always re-renders, and the whole thing still
 * works with JavaScript disabled or still loading. The script below only makes
 * it feel instant; it is not what makes it work.
 */
export function InvoicesFilters() {
  const t = useTranslations('invoices.filters')
  const tInvoice = useTranslations('invoice')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)

  const vendor = searchParams.get('vendor') ?? ''
  const status = searchParams.get('status') ?? ''
  const currency = searchParams.get('currency') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''
  const hasFilters = vendor || status || currency || dateFrom || dateTo

  /** Selects and dates apply immediately; the text box waits for Enter or blur. */
  const enviar = () => formRef.current?.requestSubmit()

  const inputClass = cn(
    'h-9 rounded-md border border-line bg-surface-2 px-3 text-sm text-ink',
    'placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30',
    'transition-colors'
  )

  return (
    <form
      ref={formRef}
      method="get"
      action={pathname}
      className="flex flex-wrap items-center gap-2"
      // An empty field would otherwise travel as `?status=` and look like a
      // filter that is set to nothing.
      onSubmit={(e) => {
        const form = e.currentTarget
        for (const campo of Array.from(form.elements)) {
          const el = campo as HTMLInputElement | HTMLSelectElement
          if (el.name && !el.value) el.disabled = true
        }
      }}
    >
      {/* Vendor or file name */}
      <input
        type="text"
        name="vendor"
        defaultValue={vendor}
        placeholder={t('vendorPlaceholder')}
        onBlur={(e) => {
          if (e.currentTarget.value !== vendor) enviar()
        }}
        className={cn(inputClass, 'w-44')}
        aria-label={t('vendorPlaceholder')}
      />

      <select
        name="status"
        defaultValue={status}
        onChange={enviar}
        className={cn(inputClass, 'w-auto min-w-[10.5rem] pr-8')}
        aria-label={t('allStatuses')}
      >
        <option value="">{t('allStatuses')}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {tInvoice(`status.${s}`)}
          </option>
        ))}
      </select>

      <select
        name="currency"
        defaultValue={currency}
        onChange={enviar}
        className={cn(inputClass, 'w-auto min-w-[9.5rem] pr-8')}
        aria-label={t('allCurrencies')}
      >
        <option value="">{t('allCurrencies')}</option>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* The date matches the invoice date when known and the upload date when
          not, so an invoice whose extraction failed is still findable. */}
      <label className="flex items-center gap-1.5 text-xs text-muted">
        {t('dateFrom')}
        <input
          type="date"
          name="dateFrom"
          defaultValue={dateFrom}
          onChange={enviar}
          className={cn(inputClass, 'w-[9.5rem]')}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        {t('dateTo')}
        <input
          type="date"
          name="dateTo"
          defaultValue={dateTo}
          onChange={enviar}
          className={cn(inputClass, 'w-[9.5rem]')}
        />
      </label>

      {/* Without JavaScript this is how the form is submitted; with it, the
          fields submit themselves and this is just a second way. */}
      <button
        type="submit"
        className={cn(
          'flex h-9 items-center rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors',
          'hover:border-line-strong hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        )}
      >
        {t('apply')}
      </button>

      {hasFilters && (
        <a
          href={pathname}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-muted transition-colors',
            'hover:border-line-strong hover:text-ink',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          )}
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
        </a>
      )}
    </form>
  )
}
