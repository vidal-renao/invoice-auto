import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import { ProfileForm } from '@/components/settings/ProfileForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('settings') }
}

interface SettingsPageProps {
  params: Promise<{ locale: string }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params
  const t = await getTranslations('settings')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as unknown as { data: Profile | null; error: unknown }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[#ededed]">{t('title')}</h1>

      <div className="max-w-2xl">
        <ProfileForm profile={profile} />
      </div>
    </div>
  )
}
