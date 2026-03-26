'use client'

/**
 * FiscalValidationButton
 *
 * Interactive modal that lets a CFO or accountant verify the format of any
 * Tax ID (NIF/CIF, UID, VAT, etc.) against country-specific official patterns.
 * Hits GET /api/tax/validate?taxId=… and shows result inline.
 */

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'

interface ValidationResult {
  taxId: string
  countryCode: string | null
  countryName: string | null
  flag: string | null
  taxIdLabel: string | null
  formatValid: boolean | null
  vatRates: number[] | null
  euMember: boolean | null
}

export function FiscalValidationButton() {
  const t = useTranslations('dashboard')

  const [open, setOpen] = useState(false)
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleOpen() {
    setOpen(true)
    setResult(null)
    setError(null)
    setTaxId('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleClose() {
    setOpen(false)
  }

  async function handleValidate() {
    const cleaned = taxId.trim()
    if (!cleaned) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch(
        `/api/tax/validate?taxId=${encodeURIComponent(cleaned)}`
      )
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = (await res.json()) as ValidationResult
      setResult(data)
    } catch {
      setError(t('fiscalValidation.error'))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void handleValidate()
    if (e.key === 'Escape') handleClose()
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#888] transition-colors hover:border-violet-500/50 hover:text-[#ededed]"
        aria-label={t('fiscalValidation.title')}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        {t('fiscalValidation.trigger')}
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fiscal-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md rounded-xl border border-[#2a2a2a] bg-[#111] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h2
                  id="fiscal-modal-title"
                  className="text-sm font-semibold text-[#ededed]"
                >
                  {t('fiscalValidation.title')}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md p-1 text-[#555] transition-colors hover:text-[#888]"
                aria-label={t('fiscalValidation.close')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[#888]">
                {t('fiscalValidation.description')}
              </p>

              {/* Input + button */}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={taxId}
                  onChange={(e) => {
                    setTaxId(e.target.value)
                    setResult(null)
                    setError(null)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('fiscalValidation.placeholder')}
                  className="flex-1 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ededed] placeholder-[#444] outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  aria-label={t('fiscalValidation.inputLabel')}
                />
                <button
                  type="button"
                  onClick={() => void handleValidate()}
                  disabled={loading || !taxId.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? t('fiscalValidation.checking') : t('fiscalValidation.check')}
                </button>
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              {/* Result */}
              {result && (
                <div className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4 space-y-3">
                  {/* Country + format validity */}
                  <div className="flex items-center justify-between">
                    {result.countryCode ? (
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none" role="img" aria-label={result.countryName ?? ''}>
                          {result.flag}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[#ededed]">
                            {result.countryName}
                          </p>
                          <p className="text-xs text-[#555]">
                            {result.taxIdLabel}
                            {result.euMember && (
                              <span className="ml-2 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/25">
                                UE
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#555]">
                        {t('fiscalValidation.unknownCountry')}
                      </p>
                    )}

                    {/* Format badge */}
                    {result.formatValid !== null && (
                      <span
                        className={
                          result.formatValid
                            ? 'flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400'
                            : 'flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400'
                        }
                      >
                        {result.formatValid ? '✓' : '✗'}{' '}
                        {result.formatValid
                          ? t('fiscalValidation.formatValid')
                          : t('fiscalValidation.formatInvalid')}
                      </span>
                    )}
                  </div>

                  {/* VAT rates */}
                  {result.vatRates && result.vatRates.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs text-[#555]">
                        {t('fiscalValidation.legalRates')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.vatRates.map((rate) => (
                          <span
                            key={rate}
                            className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 font-mono text-xs text-violet-300"
                          >
                            {rate} %
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
