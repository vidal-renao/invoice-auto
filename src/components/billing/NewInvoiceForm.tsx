'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { issueInvoice, previewInvoice, type Customer, type IssuePreview } from '@/lib/actions/billing'

interface Props {
  customers: Customer[]
  defaultSeries: string
}

interface LineDraft {
  description: string
  /** Lo que se teclea, tal cual: "12,5" o "12.5". */
  quantity: string
  unitPrice: string
}

const LINEA_VACIA: LineDraft = { description: '', quantity: '1', unitPrice: '' }

/** "1.234,56" o "1234.56" → céntimos enteros. null si no es un número. */
function aCentimos(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  if (!limpio || !/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  return Math.round(parseFloat(limpio) * 100)
}

/** "12,5" → 12500 milésimas. */
function aMilesimas(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!limpio || !/^\d+(\.\d{1,3})?$/.test(limpio)) return null
  const valor = Math.round(parseFloat(limpio) * 1000)
  return valor > 0 ? valor : null
}

/**
 * Crear una factura con lo mínimo: cliente, concepto e importe.
 *
 * Todo lo demás —tipo de IVA, inversión del sujeto pasivo, retención de IRPF,
 * recargo de equivalencia, vencimiento— lo decide el motor fiscal según dónde
 * esté el cliente y qué sea, y aparece aquí con su motivo antes de emitir. El
 * usuario no elige impuestos: los ve explicados.
 */
export function NewInvoiceForm({ customers, defaultSeries }: Props) {
  const t = useTranslations('billing')
  const locale = useLocale()
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [series, setSeries] = useState(defaultSeries)
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<LineDraft[]>([{ ...LINEA_VACIA }])
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<IssuePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Solo las líneas que ya son números válidos entran en el cálculo. */
  const lineasValidas = useMemo(
    () =>
      lines
        .map((l) => {
          const quantityMilli = aMilesimas(l.quantity)
          const unitPriceCents = aCentimos(l.unitPrice)
          if (!l.description.trim() || quantityMilli == null || unitPriceCents == null) return null
          return { description: l.description.trim(), quantityMilli, unitPriceCents }
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [lines]
  )

  // El cálculo lo hace el servidor con el mismo código que usará al emitir:
  // una previsualización que calculase por su cuenta podría mentir.
  //
  // El resumen solo se muestra cuando hay algo que calcular, así que el estado
  // se limpia dentro del propio efecto asíncrono y no en su cuerpo: llamar a
  // setState de forma síncrona aquí encadena renders.
  useEffect(() => {
    let vigente = true
    if (!customerId || lineasValidas.length === 0) {
      const vacio = setTimeout(() => {
        if (vigente) setPreview(null)
      }, 0)
      return () => {
        vigente = false
        clearTimeout(vacio)
      }
    }
    const id = setTimeout(() => {
      previewInvoice({ customerId, lines: lineasValidas })
        .then((p) => {
          if (vigente) setPreview(p)
        })
        .catch(() => {
          if (vigente) setPreview(null)
        })
    }, 250)
    return () => {
      vigente = false
      clearTimeout(id)
    }
  }, [customerId, lineasValidas])

  const cliente = customers.find((c) => c.id === customerId)
  const moneda = preview?.currency ?? 'EUR'

  function emitir() {
    setError(null)
    startTransition(async () => {
      const resultado = await issueInvoice({
        customerId,
        series,
        issueDate,
        lines: lineasValidas,
        notes: notes.trim() || null,
      })
      if (resultado.ok && resultado.id) {
        router.push(`/${locale}/billing/${resultado.id}`)
      } else {
        setError(t(`errors.${resultado.error ?? 'db'}`))
      }
    })
  }

  const campoClase =
    'h-10 rounded-md border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none'

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      {/* ── Lo que se escribe ─────────────────────────────── */}
      <div className="space-y-4 lg:col-span-3">
        <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
          <div>
            <label htmlFor="customer" className="mb-1.5 block text-sm font-medium text-ink">
              {t('customer')}
            </label>
            <select
              id="customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={`w-full ${campoClase}`}
            >
              {customers.length === 0 && <option value="">{t('noCustomers')}</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.country}
                  {c.tax_id ? ` · ${c.tax_id}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t('lines')}</p>
            {lines.map((linea, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  value={linea.description}
                  onChange={(e) =>
                    setLines((ls) => ls.map((l, j) => (i === j ? { ...l, description: e.target.value } : l)))
                  }
                  placeholder={t('descriptionPlaceholder')}
                  aria-label={t('description')}
                  className={`col-span-12 sm:col-span-6 ${campoClase}`}
                />
                <input
                  value={linea.quantity}
                  onChange={(e) =>
                    setLines((ls) => ls.map((l, j) => (i === j ? { ...l, quantity: e.target.value } : l)))
                  }
                  inputMode="decimal"
                  placeholder={t('quantity')}
                  aria-label={t('quantity')}
                  className={`col-span-4 sm:col-span-2 ${campoClase}`}
                />
                <input
                  value={linea.unitPrice}
                  onChange={(e) =>
                    setLines((ls) => ls.map((l, j) => (i === j ? { ...l, unitPrice: e.target.value } : l)))
                  }
                  inputMode="decimal"
                  placeholder={t('unitPrice')}
                  aria-label={t('unitPrice')}
                  className={`col-span-6 sm:col-span-3 ${campoClase}`}
                />
                <button
                  type="button"
                  onClick={() => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, j) => j !== i)))}
                  disabled={lines.length === 1}
                  aria-label={t('removeLine')}
                  className="col-span-2 flex h-10 items-center justify-center rounded-md border border-line text-muted transition-colors hover:text-ink disabled:opacity-40 sm:col-span-1"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, { ...LINEA_VACIA }])}
              className="text-xs text-accent-text underline underline-offset-2"
            >
              + {t('addLine')}
            </button>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted">{t('moreOptions')}</summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={t('series')}
                value={series}
                onChange={(e) => setSeries(e.target.value.toUpperCase())}
              />
              <Input
                label={t('issueDate')}
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input label={t('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </details>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-danger-text"
          >
            {error}
          </p>
        )}
      </div>

      {/* ── Lo que decide el sistema ──────────────────────── */}
      <div className="lg:col-span-2">
        <div className="sticky top-4 space-y-3 rounded-xl border border-line bg-surface p-5">
          <p className="text-xs font-medium text-muted">{t('summary')}</p>

          {!preview ? (
            <p className="py-6 text-sm text-faint">{t('fillToSee')}</p>
          ) : (
            <>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t('net')}</dt>
                  <dd className="font-medium text-ink">
                    {formatCurrency(preview.totals.netCents, moneda, locale)}
                  </dd>
                </div>
                {preview.totals.vatCents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      {t('vat', { rate: (preview.treatment.vatRate * 100).toFixed(1).replace('.0', '') })}
                    </dt>
                    <dd className="font-medium text-ink">
                      {formatCurrency(preview.totals.vatCents, moneda, locale)}
                    </dd>
                  </div>
                )}
                {preview.totals.equivalenceCents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">{t('equivalence')}</dt>
                    <dd className="font-medium text-ink">
                      {formatCurrency(preview.totals.equivalenceCents, moneda, locale)}
                    </dd>
                  </div>
                )}
                {preview.totals.retentionCents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      {t('retention', { rate: (preview.treatment.retentionRate * 100).toFixed(0) })}
                    </dt>
                    <dd className="font-medium text-warning-text">
                      −{formatCurrency(preview.totals.retentionCents, moneda, locale)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2 text-base">
                  <dt className="font-semibold text-ink">{t('total')}</dt>
                  <dd className="font-semibold text-ink">
                    {formatCurrency(preview.totals.totalCents, moneda, locale)}
                  </dd>
                </div>
              </dl>

              {/* El porqué de cada decisión fiscal, no solo el número. */}
              <ul className="space-y-1 border-t border-line pt-3">
                {preview.treatment.reasons.map((r) => (
                  <li key={r} className="flex gap-1.5 text-xs leading-relaxed text-muted">
                    <span aria-hidden="true" className="text-faint">
                      ·
                    </span>
                    {t(`reasons.${r}`)}
                  </li>
                ))}
              </ul>

              {preview.treatment.legalMentions.length > 0 && (
                <div className="rounded-md border border-line bg-surface-2 p-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                    {t('legalMentions')}
                  </p>
                  {preview.treatment.legalMentions.map((m) => (
                    <p key={m} className="text-xs leading-relaxed text-muted">
                      {t(`mentions.${m}`)}
                    </p>
                  ))}
                </div>
              )}

              {cliente && (
                <p className="text-xs text-faint">{t('dueIn', { days: cliente.payment_terms_days })}</p>
              )}
            </>
          )}

          <Button
            onClick={emitir}
            loading={pendiente}
            disabled={!preview || pendiente || !customerId}
            className="w-full"
          >
            {pendiente ? t('issuing') : t('issue')}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-faint">{t('issueWarning')}</p>
        </div>
      </div>
    </div>
  )
}
