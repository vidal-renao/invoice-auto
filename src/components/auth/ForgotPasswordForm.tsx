'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function buildSchema(tv: (key: string) => string) {
  return z.object({
    email: z.string().email(tv('email')),
  })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword')
  const tv = useTranslations('auth.validation')
  const locale = useLocale()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(buildSchema(tv)) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/api/auth/callback?next=/${locale}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo,
    })

    if (error) {
      console.error('[ForgotPassword] Supabase error:', error.status, error.message)
      setServerError(t('errors.generic'))
      return
    }

    setSentTo(values.email)
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-2xl">
            ✉️
          </div>
        </div>
        <h2 className="mb-2 text-base font-semibold text-[#ededed]">{t('successTitle')}</h2>
        <p className="mb-6 text-sm text-[#888]">
          {t('successDesc', { email: sentTo })}
        </p>
        <Link
          href={`/${locale}/login`}
          className="text-sm text-violet-400 underline underline-offset-2 transition-colors hover:text-violet-300"
        >
          ← {t('backToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label={t('email')}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

      {serverError && (
        <p role="alert" className="text-sm text-red-400">
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? t('loading') : t('submit')}
      </Button>

      <p className="text-center text-sm text-[#888]">
        <Link
          href={`/${locale}/login`}
          className="text-violet-400 underline underline-offset-2 transition-colors hover:text-violet-300"
        >
          ← {t('backToLogin')}
        </Link>
      </p>
    </form>
  )
}
