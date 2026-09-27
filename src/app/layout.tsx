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
  // The browser UI colour follows the active theme instead of forcing dark.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
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
      <head>
        {/* Applies the stored theme before the first paint. Without this the
            page flashes dark for a visitor who chose light, and vice versa. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('invoice-auto-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}})()`,
          }}
        />
      </head>
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
