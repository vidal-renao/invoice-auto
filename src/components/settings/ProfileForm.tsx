'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card'
import { updateProfile, type ProfileActionState } from '@/lib/actions/profile'
import type { Profile } from '@/types/database'

interface ProfileFormProps {
  profile: Profile | null
}

const INITIAL_STATE: ProfileActionState = { success: false }

// Shared select class — mirrors Input's visual style
const selectClass = cn(
  'w-full rounded-md border border-[#2a2a2a] bg-[#111]',
  'px-3 py-2 text-sm text-[#ededed]',
  'transition-colors duration-150',
  'focus:outline-none focus:ring-1 focus:ring-violet-700 focus:border-violet-700',
  '[&>option]:bg-[#1a1a1a]'
)

export function ProfileForm({ profile }: ProfileFormProps) {
  const t = useTranslations('settings')
  const [state, formAction, isPending] = useActionState(updateProfile, INITIAL_STATE)

  return (
    <form action={formAction} className="space-y-6">
      {/* ── Section 1: Company Profile ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[#ededed]">{t('profile.sectionTitle')}</h2>
          <p className="mt-0.5 text-xs text-[#888]">{t('profile.sectionDesc')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            name="full_name"
            label={t('profile.fullName')}
            placeholder={t('profile.fullNamePlaceholder')}
            defaultValue={profile?.full_name ?? ''}
            required
            autoComplete="name"
          />
          <Input
            name="company_name"
            label={t('profile.companyName')}
            hint={t('profile.companyNameHint')}
            placeholder={t('profile.companyNamePlaceholder')}
            defaultValue={profile?.company_name ?? ''}
            autoComplete="organization"
          />
          <Input
            name="tax_id"
            label={t('profile.taxId')}
            hint={t('profile.taxIdHint')}
            placeholder={t('profile.taxIdPlaceholder')}
            defaultValue={profile?.tax_id ?? ''}
            autoComplete="off"
          />
        </CardContent>
      </Card>

      {/* ── Section 2: Fiscal Settings ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[#ededed]">{t('fiscal.sectionTitle')}</h2>
          <p className="mt-0.5 text-xs text-[#888]">{t('fiscal.sectionDesc')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Country */}
          <div className="space-y-1.5">
            <label htmlFor="country" className="block text-sm font-medium text-[#ededed]">
              {t('fiscal.country')}
            </label>
            <select
              id="country"
              name="country"
              defaultValue={profile?.country ?? 'ES'}
              className={selectClass}
            >
              <option value="ES">{t('countries.ES')}</option>
              <option value="CH">{t('countries.CH')}</option>
              <option value="DE">{t('countries.DE')}</option>
            </select>
            <p className="text-xs text-[#888]">{t('fiscal.currencyNote')}</p>
          </div>

          {/* Locale */}
          <div className="space-y-1.5">
            <label htmlFor="locale" className="block text-sm font-medium text-[#ededed]">
              {t('fiscal.locale')}
            </label>
            <select
              id="locale"
              name="locale"
              defaultValue={profile?.locale ?? 'es'}
              className={selectClass}
            >
              <option value="es">{t('locales.es')}</option>
              <option value="en">{t('locales.en')}</option>
              <option value="de">{t('locales.de')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ── Save row ────────────────────────────────────────────────────────── */}
      <CardFooter className="flex items-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#111] px-6 py-4">
        <div className="flex-1">
          {state.success && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M5.5 8l2 2 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t('saved')}
            </span>
          )}
          {!state.success && state.error && (
            <span className="text-sm text-red-400">{t('saveError')}</span>
          )}
        </div>
        <Button type="submit" loading={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
      </CardFooter>
    </form>
  )
}
