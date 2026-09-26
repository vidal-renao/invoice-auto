import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// No path argument: next-intl v4 picks up ./src/i18n/request.ts by convention.
const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
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
