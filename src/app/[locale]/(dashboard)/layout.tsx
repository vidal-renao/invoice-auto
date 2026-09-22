import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'

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

  return (
    <>
      {/* Skip-to-content — keyboard / screen-reader shortcut (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-violet-700 focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none"
      >
        Skip to content
      </a>

      <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] md:flex-row">
        {/* Top bar + drawer below md; sidebar on md+ */}
        <MobileNav locale={locale} />

        <div className="hidden md:flex md:shrink-0">
          <Sidebar locale={locale} />
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
