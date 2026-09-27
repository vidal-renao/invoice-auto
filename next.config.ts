import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// No path argument: next-intl v4 picks up ./src/i18n/request.ts by convention.
const withNextIntl = createNextIntlPlugin()

/**
 * Security headers. The site was sending only HSTS, which is the first thing a
 * corporate buyer's questionnaire asks about for a product that handles payment
 * files. The CSP ships in report-only first: Next.js inlines scripts and styles,
 * so enforcing a policy blind would break the page instead of protecting it.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://upuhppsbolpdpaighzfq.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://upuhppsbolpdpaighzfq.supabase.co https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // The app needs the camera to scan receipts; everything else is denied.
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upuhppsbolpdpaighzfq.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
