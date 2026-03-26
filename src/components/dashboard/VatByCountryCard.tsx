/**
 * VatByCountryCard — CFO Dashboard component
 *
 * Displays IVA Soportado (input VAT) broken down by country and quarter.
 * Designed for quarterly tax declarations. Server Component — receives data as props.
 */

import { getTranslations } from 'next-intl/server'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import type { VatBreakdownRow } from '@/lib/actions/invoices'

interface VatByCountryCardProps {
  rows: VatBreakdownRow[]
  locale: string
  currency: string
}

export async function VatByCountryCard({
  rows,
  locale,
  currency,
}: VatByCountryCardProps) {
  const t = await getTranslations('dashboard')

  // Group rows by quarter for the quarter-tab view
  const byQuarter = new Map<string, VatBreakdownRow[]>()
  for (const row of rows) {
    const existing = byQuarter.get(row.quarter) ?? []
    existing.push(row)
    byQuarter.set(row.quarter, existing)
  }

  // Take the two most recent quarters to display
  const quarters = Array.from(byQuarter.keys()).slice(0, 2)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-[#ededed]">
              {t('vatBreakdown.title')}
            </h2>
            <p className="mt-0.5 text-xs text-[#555]">
              {t('vatBreakdown.subtitle')}
            </p>
          </div>
          {/* Shield icon */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]"
            aria-hidden="true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 py-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[#555]">
            {t('vatBreakdown.empty')}
          </p>
        ) : (
          <div>
            {quarters.map((quarter, qIdx) => {
              const quarterRows = byQuarter.get(quarter) ?? []
              const quarterTotal = quarterRows.reduce(
                (s, r) => s + r.taxCents,
                0
              )

              return (
                <div
                  key={quarter}
                  className={
                    qIdx > 0
                      ? 'border-t border-[#1e1e1e]'
                      : undefined
                  }
                >
                  {/* Quarter header */}
                  <div className="flex items-center justify-between px-6 py-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#555]">
                      {quarter}
                    </span>
                    <span className="font-mono text-sm font-semibold text-violet-400">
                      {formatCurrency(quarterTotal, currency, locale)}
                    </span>
                  </div>

                  {/* Country rows */}
                  <table className="w-full">
                    <tbody className="divide-y divide-[#161616]">
                      {quarterRows.map((row) => (
                        <tr
                          key={`${row.countryCode}-${row.quarter}`}
                          className="group"
                        >
                          {/* Flag + country */}
                          <td className="px-6 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="text-lg leading-none"
                                role="img"
                                aria-label={row.countryName}
                              >
                                {row.flag}
                              </span>
                              <div>
                                <p className="text-sm text-[#ededed]">
                                  {row.countryName}
                                </p>
                                <p className="text-xs text-[#555]">
                                  {row.invoiceCount}{' '}
                                  {row.invoiceCount === 1
                                    ? t('vatBreakdown.invoice')
                                    : t('vatBreakdown.invoices')}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Base imponible */}
                          <td className="px-4 py-2.5 text-right">
                            <p className="text-xs text-[#555]">
                              {t('vatBreakdown.base')}
                            </p>
                            <p className="font-mono text-sm text-[#888]">
                              {formatCurrency(row.subtotalCents, currency, locale)}
                            </p>
                          </td>

                          {/* IVA */}
                          <td className="px-6 py-2.5 text-right">
                            <p className="text-xs text-[#555]">
                              {t('vatBreakdown.vat')}
                            </p>
                            <p className="font-mono text-sm font-semibold text-[#ededed]">
                              {formatCurrency(row.taxCents, currency, locale)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}

            {/* Footer: show all quarters link if more than 2 */}
            {byQuarter.size > 2 && (
              <div className="border-t border-[#1e1e1e] px-6 py-3">
                <p className="text-xs text-[#555]">
                  {t('vatBreakdown.moreQuarters', {
                    count: byQuarter.size - 2,
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
