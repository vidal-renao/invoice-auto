'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { savePaymentSettings } from '@/lib/actions/payments'

export interface SettingsValues {
  debtor_name: string
  debtor_iban: string
  debtor_bic: string
  review_threshold: string
  cooling_off_hours: string
}

const inputClass =
  'w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ededed] placeholder:text-[#808080] focus:border-violet-500 focus:outline-none aria-[invalid=true]:border-red-500/60'

/** Controlled inputs: a validation error must not wipe what was typed. */
export function PaymentSettingsForm({ initial }: { initial: SettingsValues }) {
  const t = useTranslations('payments')
  const router = useRouter()
  const base = useId()
  const [values, setValues] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string; field?: string } | null>(null)

  const set = (key: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  const field = (key: keyof SettingsValues, label: string, opts: { hint?: string; mono?: boolean; type?: string; min?: number; max?: number } = {}) => {
    const id = `${base}-${key}`
    const invalid = status?.kind === 'error' && status.field === key
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-[#ededed]">{label}</label>
        <input
          id={id}
          name={key}
          type={opts.type ?? 'text'}
          min={opts.min}
          max={opts.max}
          value={values[key]}
          onChange={set(key)}
          aria-invalid={invalid}
          aria-describedby={opts.hint ? `${id}-hint` : undefined}
          className={`${inputClass} ${opts.mono ? 'font-mono' : ''}`}
        />
        {opts.hint && <p id={`${id}-hint`} className="text-xs text-[#888]">{opts.hint}</p>}
        {invalid && <p role="alert" className="text-xs text-red-300">{status.text}</p>}
      </div>
    )
  }

  return (
    <form
      className="max-w-xl space-y-5 rounded-xl border border-[#2a2a2a] bg-[#111] p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setStatus(null)
        startTransition(async () => {
          const result = await savePaymentSettings(values)
          if (result.ok) {
            setStatus({ kind: 'ok', text: t('settings.saved') })
            router.refresh()
          } else {
            const text = t(`errors.${result.error === 'invalid' && result.detail ? result.detail : result.error}`)
            setStatus({ kind: 'error', text, field: result.field })
          }
        })
      }}
    >
      {field('debtor_name', t('settings.debtorName'))}
      {field('debtor_iban', t('settings.debtorIban'), { mono: true })}
      {field('debtor_bic', t('settings.debtorBic'), { mono: true })}
      {field('review_threshold', t('settings.threshold'), { hint: t('settings.thresholdHint'), type: 'number', min: 1 })}
      {field('cooling_off_hours', t('settings.coolingOff'), { hint: t('settings.coolingOffHint'), type: 'number', min: 0, max: 720 })}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={pending}>{t('settings.save')}</Button>
        {status && (status.kind === 'ok' || !status.field) && (
          <p role={status.kind === 'ok' ? 'status' : 'alert'} className={status.kind === 'ok' ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>
            {status.text}
          </p>
        )}
      </div>
    </form>
  )
}
