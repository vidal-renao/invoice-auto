import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from '@/components/auth/LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login')
  return { title: t('title') }
}

export default async function LoginPage() {
  const t = await getTranslations('auth.login')

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[#ededed]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[#888]">{t('subtitle')}</p>
      </div>
      <LoginForm />
    </>
  )
}
