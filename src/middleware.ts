import createMiddleware from 'next-intl/middleware'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Cambiamos el nombre a 'middleware' para que el build de Vercel no falle
export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request)

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
  // `api` is excluded: locale routing would redirect /api/* to /es/api/* (a
  // 404), which broke every route handler — the Excel export, the auth
  // callback and the payment file download. Route handlers read and refresh
  // the Supabase session themselves.
  matcher: [
    '/((?!api/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|js|css|woff2?|ttf|otf)$).*)',
  ],
}
