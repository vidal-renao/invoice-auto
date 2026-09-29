import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getIssuedInvoice } from '@/lib/actions/billing'
import { getProfile } from '@/lib/actions/profile'
import { MarkPaidButton } from '@/components/billing/MarkPaidButton'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const factura = await getIssuedInvoice(id)
  return { title: factura?.invoice.reference ?? 'Invoice' }
}

/**
 * La factura tal y como la recibe el cliente, y las acciones sobre ella.
 *
 * Imprimible con el propio navegador: `print:` esconde la navegación y las
 * acciones, de modo que "Imprimir → Guardar como PDF" produce el documento
 * sin depender de un generador de PDF en el servidor.
 */
export default async function IssuedInvoicePage({ params }: Props) {
  const { locale, id } = await params
  const t = await getTranslations('billing')
  const datos = await getIssuedInvoice(id)
  if (!datos) notFound()

  const { invoice, lines } = datos
  const cliente = invoice.bill_customers
  const emisor = await getProfile()
  const moneda = invoice.currency

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/${locale}/billing`}
          className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          {t('back')}
        </Link>
        <div className="flex items-center gap-2">
          {invoice.status === 'issued' && <MarkPaidButton id={invoice.id} />}
          <span className="text-xs text-faint">{t('printHint')}</span>
        </div>
      </div>

      {/* El documento */}
      <article className="rounded-xl border border-line bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="text-lg font-semibold text-ink">{emisor?.company_name ?? emisor?.full_name ?? '—'}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {emisor?.tax_id ?? ''}
              {emisor?.country ? ` · ${emisor.country}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-tight text-ink">{invoice.reference}</p>
            <p className="mt-1 text-xs text-muted">
              {t('issueDate')}: {formatDate(invoice.issue_date, locale)}
              <br />
              {t('dueDate')}: {formatDate(invoice.due_date, locale)}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">{t('billTo')}</p>
            <p className="text-sm font-medium text-ink">{cliente.name}</p>
            <p className="text-xs leading-relaxed text-muted">
              {cliente.tax_id ?? ''}
              {cliente.tax_id ? ' · ' : ''}
              {cliente.country}
              {cliente.email ? <><br />{cliente.email}</> : null}
            </p>
          </div>
          {invoice.notes && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">{t('notes')}</p>
              <p className="text-xs leading-relaxed text-muted">{invoice.notes}</p>
            </div>
          )}
        </section>

        <table className="w-full py-6 text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 text-left text-xs font-medium text-muted">{t('description')}</th>
              <th className="py-2 text-right text-xs font-medium text-muted">{t('quantity')}</th>
              <th className="py-2 text-right text-xs font-medium text-muted">{t('unitPrice')}</th>
              <th className="py-2 text-right text-xs font-medium text-muted">{t('amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-elevated-2">
            {lines.map((l) => {
              const linea = l as unknown as {
                id: string
                description: string
                quantity_milli: number
                unit_price_cents: number
                net_cents: number
              }
              return (
                <tr key={linea.id}>
                  <td className="py-2.5 text-ink">{linea.description}</td>
                  <td className="py-2.5 text-right text-muted">{linea.quantity_milli / 1000}</td>
                  <td className="py-2.5 text-right text-muted">
                    {formatCurrency(linea.unit_price_cents, moneda, locale)}
                  </td>
                  <td className="py-2.5 text-right font-medium text-ink">
                    {formatCurrency(linea.net_cents, moneda, locale)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{t('net')}</span>
            <span className="font-medium text-ink">{formatCurrency(invoice.net_cents, moneda, locale)}</span>
          </div>
          {invoice.vat_cents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">
                {t('vat', { rate: (invoice.vat_rate * 100).toFixed(1).replace('.0', '') })}
              </span>
              <span className="font-medium text-ink">{formatCurrency(invoice.vat_cents, moneda, locale)}</span>
            </div>
          )}
          {invoice.equivalence_cents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">{t('equivalence')}</span>
              <span className="font-medium text-ink">
                {formatCurrency(invoice.equivalence_cents, moneda, locale)}
              </span>
            </div>
          )}
          {invoice.retention_cents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">
                {t('retention', { rate: (invoice.retention_rate * 100).toFixed(0) })}
              </span>
              <span className="font-medium text-warning-text">
                −{formatCurrency(invoice.retention_cents, moneda, locale)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
            <span>{t('total')}</span>
            <span>{formatCurrency(invoice.total_cents, moneda, locale)}</span>
          </div>
        </div>

        {invoice.legal_mentions.length > 0 && (
          <footer className="mt-8 border-t border-line pt-4">
            {invoice.legal_mentions.map((m) => (
              <p key={m} className="text-xs leading-relaxed text-muted">
                {t(`mentions.${m}`)}
              </p>
            ))}
          </footer>
        )}
      </article>
    </div>
  )
}
