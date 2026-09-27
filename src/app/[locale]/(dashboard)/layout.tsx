import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/profile'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'

/**
 * Reading an invoice with Claude Vision takes tens of seconds. Without this the
 * serverless function is killed at the platform default and the extraction is
 * aborted halfway, which is what produced "Tiempo de espera agotado (8 s)".
 */
export const maxDuration = 60

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  // Who is signed in was nowhere on screen. On a product that holds several
  // people's invoices, "which account am I in?" is not a cosmetic question.
  const profile = await getProfile()
  const account = {
    name: profile?.full_name ?? null,
    email: user.email ?? '',
  }

  return (
    <>
      {/* Skip-to-content — keyboard / screen-reader shortcut (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-violet-700 focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none"
      >
        Skip to content
      </a>

      <div className="flex h-dvh flex-col overflow-hidden bg-canvas md:flex-row">
        {/* Top bar + drawer below md; sidebar on md+ */}
        <MobileNav locale={locale} account={account} />

        <div className="hidden md:flex md:shrink-0">
          <Sidebar locale={locale} account={account} />
        </div>

        <main
          id="main-content"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
