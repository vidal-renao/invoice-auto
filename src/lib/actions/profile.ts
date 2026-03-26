'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

// ── Validation schema ─────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  full_name: z.string().min(1).max(100),
  company_name: z.string().max(200).nullable(),
  tax_id: z.string().max(50).nullable(),
  country: z.enum(['ES', 'CH', 'DE']),
  locale: z.enum(['es', 'de', 'en']),
})

// ── Action state type ─────────────────────────────────────────────────────────

export type ProfileActionState = {
  success: boolean
  error?: string
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Update the current user's profile.
 * Designed for use with React's useActionState — receives prev state + FormData.
 */
export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'auth' }

  const parsed = ProfileSchema.safeParse({
    full_name: formData.get('full_name') as string,
    company_name: (formData.get('company_name') as string) || null,
    tax_id: (formData.get('tax_id') as string) || null,
    country: formData.get('country'),
    locale: formData.get('locale'),
  })

  if (!parsed.success) {
    console.error('[updateProfile] Validation failed:', parsed.error.flatten())
    return { success: false, error: 'validation' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('[updateProfile] DB update failed:', error.message)
    return { success: false, error: 'db' }
  }

  // Revalidate all cached pages so the updated name/locale propagates
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Fetch the current user's profile row.
 * Returns null if not authenticated or profile not found.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[getProfile] DB fetch failed:', error.message)
    return null
  }

  return data
}
