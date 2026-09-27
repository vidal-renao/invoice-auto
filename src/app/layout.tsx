import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { getLocale } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/next'
import { SwRegister } from '@/components/SwRegister'
import { SITE_URL } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  // Without it, Open Graph images resolve against the current host — a preview
  // deployment would advertise preview URLs to whoever the link is shared with.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Invoice Auto',
    template: '%s · Invoice Auto',
  },
  description: 'Gestión automatizada de facturas con inteligencia artificial.',
  manifest: '/manifest.json',
  icons: {
    icon: '/invoice.png',
    apple: '/invoice.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Invoice Auto',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getLocale() reads the locale resolved by src/proxy.ts — works in any Server Component.
  // Falls back gracefully if called outside a request context (e.g. build-time).
  const locale = await getLocale().catch(() => 'es')

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <SwRegister />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
