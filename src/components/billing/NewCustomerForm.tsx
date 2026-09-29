'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { createCustomer, type ActionState } from '@/lib/actions/billing'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'

const PAISES = Object.entries(COUNTRY_TAX_CONFIG).map(([code, cfg]) => ({ code, name: cfg.name }))

const INICIAL: ActionState = { ok: false }

/**
 * Alta de cliente. Los campos que cambian el resultado fiscal —país, empresa o
 * particular, NIF-IVA validado— están aquí y no escondidos, porque de ellos
 * depende si la factura lleva IVA, se invierte el sujeto pasivo o va exenta.
 */
export function NewCustomerForm() {
  const t = useTranslations('billing.customerForm')
  const [state, formAction, pending] = useActionState(createCustomer, INICIAL)

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="name" label={t('name')} required maxLength={140} />
        <Input name="tax_id" label={t('taxId')} placeholder={t('taxIdPlaceholder')} />

        <div>
          <label htmlFor="country" className="mb-1.5 block text-sm font-medium text-ink">
            {t('country')}
          </label>
          <select
            id="country"
            name="country"
            defaultValue="ES"
            className="h-10 w-full rounded-md border border-line bg-surface-2 px-3 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {PAISES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="kind" className="mb-1.5 block text-sm font-medium text-ink">
            {t('kind')}
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue="business"
            className="h-10 w-full rounded-md border border-line bg-surface-2 px-3 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="business">{t('business')}</option>
            <option value="individual">{t('individual')}</option>
          </select>
        </div>

        <Input name="email" type="email" label={t('email')} />
        <Input
          name="payment_terms_days"
          type="number"
          min={0}
          max={365}
          defaultValue={30}
          label={t('paymentTerms')}
          hint={t('paymentTermsHint')}
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="equivalence_surcharge"
          className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--c-accent)]"
        />
        <span>
          {t('equivalence')}
          <span className="block text-xs text-faint">{t('equivalenceHint')}</span>
        </span>
      </label>

      {!state.ok && state.error && (
        <p role="alert" className="text-sm text-danger-text">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-success-text">
          {t('saved')}
        </p>
      )}

      <Button type="submit" loading={pending}>
        {t('submit')}
      </Button>
    </form>
  )
}
