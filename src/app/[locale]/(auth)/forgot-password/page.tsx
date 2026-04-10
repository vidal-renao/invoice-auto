import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword')
  return { title: t('title') }
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword')

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[#ededed]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[#888]">{t('subtitle')}</p>
      </div>
      <ForgotPasswordForm />
    </>
  )
}
