import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

interface HomeProps {
  params: Promise<{ locale: string }>
}

/**
 * Root page — shows landing for unauthenticated users,
 * redirects to dashboard if already signed in.
 */
export default async function HomePage({ params }: HomeProps) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(`/${locale}/dashboard`)
  }

  return <LandingPage />
}
