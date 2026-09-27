import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.resetPassword')
  return { title: t('title') }
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth.resetPassword')

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>
      <ResetPasswordForm />
    </>
  )
}
