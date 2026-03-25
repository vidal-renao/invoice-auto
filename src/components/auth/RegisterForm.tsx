'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const t = useTranslations('auth.register')
  const locale = useLocale()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterValues) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
      },
    })

    if (error) {
      const msg =
        error.message.includes('already registered')
          ? t('errors.emailTaken')
          : t('errors.generic')
      setServerError(msg)
      return
    }

    // Redirect to dashboard — Supabase auto-confirms in dev without email verification
    router.push(`/${locale}/dashboard`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label={t('fullName')}
        type="text"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />

      <Input
        label={t('email')}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label={t('password')}
        type="password"
        autoComplete="new-password"
        hint={t('passwordHint')}
        error={errors.password?.message}
        {...register('password')}
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
        {t('hasAccount')}{' '}
        <Link
          href={`/${locale}/login`}
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          {t('login')}
        </Link>
      </p>
    </form>
  )
}
