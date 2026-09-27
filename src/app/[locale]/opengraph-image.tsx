import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'

export const alt = 'Invoice Auto'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Social card, rendered per locale. Sharing the link on WhatsApp, LinkedIn or
 * Slack used to show nothing at all; this is the first thing a prospect sees.
 * Drawn with plain layout primitives — no external asset to 404 on.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0a',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#7c3aed',
              color: 'white',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            IA
          </div>
          <div style={{ color: '#ededed', fontSize: 32, fontWeight: 600 }}>Invoice Auto</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              color: '#ededed',
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 940,
            }}
          >
            {t('hero.headline')}
          </div>
          <div style={{ color: '#a3a3a3', fontSize: 30, lineHeight: 1.35, maxWidth: 900 }}>
            {t('seo.ogAlt')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 40, color: '#8a8a8a', fontSize: 24 }}>
          <div style={{ display: 'flex' }}>{t('seo.ogFooter')}</div>
          <div style={{ display: 'flex' }}>SEPA · QR · pain.001</div>
        </div>
      </div>
    ),
    size
  )
}
