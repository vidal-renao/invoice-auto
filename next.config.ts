import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

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
  // Next.js 16: Turbopack config lives at top-level `turbopack`, not `experimental.turbo`.
  // We wire the next-intl alias here because the plugin still targets the old key.
  turbopack: {
    resolveAlias: {
      'next-intl/config': './src/i18n.ts',
    },
  },
}

// next-intl plugin (v3.x) injects `experimental.turbo` for webpack compat,
// which Next.js 16 rejects as an unrecognised key. Strip it post-wrap.
const wrappedConfig = withNextIntl(nextConfig)
if (wrappedConfig.experimental && 'turbo' in wrappedConfig.experimental) {
  const rest = { ...(wrappedConfig.experimental as Record<string, unknown>) }
  delete rest.turbo
  wrappedConfig.experimental = rest as NextConfig['experimental']
}

export default wrappedConfig
