import createMiddleware from 'next-intl/middleware'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Next.js 16 uses "proxy" convention instead of "middleware"
export async function proxy(request: NextRequest) {
  // Run next-intl locale routing first — it returns a NextResponse with
  // redirect/rewrite or a plain "continue" response.
  const response = intlMiddleware(request)

  // Refresh the Supabase session on every request so Server Components always
  // receive an up-to-date session via cookies.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|js|css|woff2?|ttf|otf)$).*)',
  ],
}
