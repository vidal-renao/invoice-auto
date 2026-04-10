'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type LoginValues = z.infer<typeof loginSchema>

function classifyError(error: AuthError): 'invalidCredentials' | 'emailNotConfirmed' | 'tooManyRequests' | 'generic' {
  const msg = error.message.toLowerCase()
  if (error.status === 429 || msg.includes('too many') || msg.includes('rate limit')) {
    return 'tooManyRequests'
  }
  if (msg.includes('not confirmed') || msg.includes('email not confirmed') || msg.includes('not verified')) {
    return 'emailNotConfirmed'
  }
  if (error.status === 400 || msg.includes('invalid') || msg.includes('credentials') || msg.includes('incorrect')) {
    return 'invalidCredentials'
  }
  return 'generic'
}

export function LoginForm() {
  const t = useTranslations('auth.login')
  const locale = useLocale()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      const key = classifyError(error)
      setServerError(t(`errors.${key}`))
      return
    }

    router.push(`/${locale}/dashboard`)
    router.refresh()
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

      <div className="space-y-1">
        <Input
          label={t('password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link
            href={`/${locale}/forgot-password`}
            className="text-xs text-[#666] transition-colors hover:text-violet-400"
          >
            {t('forgotPassword')}
          </Link>
        </div>
      </div>

      {serverError && (
        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{serverError}</p>
          <p className="mt-1 text-xs text-red-400/70">
            <Link
              href={`/${locale}/forgot-password`}
              className="underline underline-offset-2 hover:text-red-300"
            >
              {t('forgotPassword')}
            </Link>
          </p>
        </div>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? t('loading') : t('submit')}
      </Button>

      <p className="text-center text-sm text-[#888]">
        {t('noAccount')}{' '}
        <Link
          href={`/${locale}/register`}
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          {t('register')}
        </Link>
      </p>
    </form>
  )
}
