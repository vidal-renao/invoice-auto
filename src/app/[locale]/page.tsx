import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface HomeProps {
  params: Promise<{ locale: string }>
}

/**
 * Root page — redirects to dashboard if authenticated, login otherwise.
 * No UI rendered; this is a pure routing node.
 */
export default async function HomePage({ params }: HomeProps) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(`/${locale}/dashboard`)
  } else {
    redirect(`/${locale}/login`)
  }
}
