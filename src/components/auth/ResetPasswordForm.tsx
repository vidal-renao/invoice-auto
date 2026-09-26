'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function buildSchema(tv: (key: string) => string) {
  return z
    .object({
      password: z.string().min(8, tv('passwordMin')),
      confirmPassword: z.string().min(8, tv('passwordMin')),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: 'passwordMismatch',
    })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

type State = 'checking' | 'ready' | 'success' | 'invalid'

export function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword')
  const tv = useTranslations('auth.validation')
  const locale = useLocale()
  const router = useRouter()
  const [state, setState] = useState<State>('checking')
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(session ? 'ready' : 'invalid')
    })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(buildSchema(tv)) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.password })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('weak') || msg.includes('short')) {
        setServerError(t('errors.weakPassword'))
      } else {
        setServerError(t('errors.generic'))
      }
      return
    }

    setState('success')
    setTimeout(() => router.push(`/${locale}/login`), 3000)
  }

  if (state === 'checking') {
    return (
      <p className="text-center text-sm text-[#888]">Loading…</p>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-2xl">
            ⚠️
          </div>
        </div>
        <p className="mb-2 text-sm text-[#888]">{t('invalidLink')}</p>
        <Link
          href={`/${locale}/forgot-password`}
          className="text-sm text-violet-400 underline underline-offset-2 transition-colors hover:text-violet-300"
        >
          {t('requestNew')}
        </Link>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-2xl">
            ✅
          </div>
        </div>
        <h2 className="mb-2 text-base font-semibold text-[#ededed]">{t('successTitle')}</h2>
        <p className="text-sm text-[#888]">{t('successDesc')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label={t('password')}
        type="password"
        autoComplete="new-password"
        hint={t('passwordHint')}
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label={t('confirmPassword')}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message === 'passwordMismatch'
          ? t('errors.passwordMismatch')
          : errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {serverError && (
        <p role="alert" className="text-sm text-red-400">
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? t('loading') : t('submit')}
      </Button>
    </form>
  )
}
