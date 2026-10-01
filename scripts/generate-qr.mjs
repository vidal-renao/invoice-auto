#!/usr/bin/env node
/**
 * Genera el código QR que lleva a la aplicación, para que nadie tenga que
 * teclear la URL: se imprime en una tarjeta, se pone en una factura o se
 * enseña desde el móvil.
 *
 * Se genera aquí y se versiona como SVG estático en lugar de calcularlo en
 * cada petición: el destino cambia una vez cada nunca, y así la página no
 * carga ninguna librería de QR.
 *
 *   npm run qr                      → usa la URL de producción
 *   SITE_URL=https://otro npm run qr
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = process.env.SITE_URL ?? 'https://invoice-auto-xi.vercel.app'
const SALIDA = join(RAIZ, 'public', 'qr')

/**
 * Corrección de errores alta: el QR sigue leyéndose impreso en pequeño, con
 * el papel doblado o con el logotipo encima.
 */
const COMUN = { errorCorrectionLevel: 'H', margin: 2 }

const VARIANTES = [
  {
    fichero: 'invoice-auto.svg',
    opciones: { ...COMUN, type: 'svg', width: 512, color: { dark: '#0a0a0a', light: '#ffffff' } },
  },
  {
    // Para fondos oscuros: el claro sobre el oscuro también se lee.
    fichero: 'invoice-auto-dark.svg',
    opciones: { ...COMUN, type: 'svg', width: 512, color: { dark: '#ededed', light: '#0a0a0a' } },
  },
]

await mkdir(SALIDA, { recursive: true })

for (const { fichero, opciones } of VARIANTES) {
  const svg = await QRCode.toString(DESTINO, opciones)
  await writeFile(join(SALIDA, fichero), svg, 'utf8')
  console.log(`${fichero} → ${DESTINO}`)
}

await QRCode.toFile(join(SALIDA, 'invoice-auto.png'), DESTINO, {
  ...COMUN,
  width: 1024,
  color: { dark: '#0a0a0a', light: '#ffffff' },
})
console.log(`invoice-auto.png → ${DESTINO}`)
