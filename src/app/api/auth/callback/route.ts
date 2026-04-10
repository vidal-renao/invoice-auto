import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/callback
 *
 * Exchanges a PKCE authorization code for a session (Supabase SSR flow).
 * Used as the redirectTo target for:
 *   - Password reset emails  → ?next=/[locale]/reset-password
 *   - Email confirmation      → ?next=/[locale]/dashboard
 *
 * After exchanging the code, redirects the user to the `next` param.
 * On failure, redirects to login with an error query param.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/en/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Invalid or missing code — send to login with error hint
  return NextResponse.redirect(`${origin}/en/login?error=link_expired`)
}
