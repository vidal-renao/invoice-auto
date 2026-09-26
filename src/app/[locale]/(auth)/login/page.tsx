import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from '@/components/auth/LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login')
  return { title: t('title') }
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations('auth.login')
  const { error } = await searchParams

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[#ededed]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[#888]">{t('subtitle')}</p>
      </div>

      {error === 'link_expired' && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3"
        >
          <p className="text-sm text-amber-300">{t('errors.linkExpired')}</p>
        </div>
      )}

      <LoginForm />
    </>
  )
}
