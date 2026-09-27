import createMiddleware from 'next-intl/middleware'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join('|')})(/|$)`)

/**
 * Spanish is the default locale, which also made it the landing place for every
 * visitor whose language we do not speak: a French-speaking Swiss browser asked
 * for fr-CH and got Spanish. English is the better fallback for an unknown
 * language; es, de and en visitors are unaffected and keep their own language.
 */
function fallsBackToEnglish(request: NextRequest): boolean {
  if (LOCALE_PREFIX.test(request.nextUrl.pathname)) return false
  if (request.cookies.has('NEXT_LOCALE')) return false

  const accepted = request.headers.get('accept-language')
  if (!accepted) return false

  const languages = accepted
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase().split('-')[0])
    .filter(Boolean)

  return languages.length > 0 && !languages.some((lang) => (routing.locales as readonly string[]).includes(lang!))
}

// Cambiamos el nombre a 'middleware' para que el build de Vercel no falle
export async function middleware(request: NextRequest) {
  const response = fallsBackToEnglish(request)
    ? NextResponse.redirect(
        new URL(
          `/en${request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname}${request.nextUrl.search}`,
          request.url
        )
      )
    : intlMiddleware(request)

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
