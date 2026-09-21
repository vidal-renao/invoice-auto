import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/** The dashboard layout already redirects anonymous users; this narrows the type. */
export async function requireSession(locale: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  return { supabase, user }
}
