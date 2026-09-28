import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A "the whole row is clickable" link is built with `after:absolute
 * after:inset-0`: the pseudo-element stretches over the nearest *positioned*
 * ancestor. If no ancestor is positioned it stretches over the page instead,
 * and that invisible layer swallows every click above it.
 *
 * That is not theoretical. On the invoice list the row was
 * `<tr className="group transition-colors …">` with no `relative`, so the last
 * row's overlay covered the entire page: clicking the status filter, the search
 * box or the submit button opened that invoice instead of filtering. It looked
 * exactly like "the filters do not work", and left no trace on the server,
 * because no filtered request was ever made.
 *
 * This keeps the pairing: wherever the overlay trick is used, the element meant
 * to contain it must be positioned.
 */

const RAIZ = join(__dirname, '..', '..')

function ficheros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) return ficheros(ruta)
    return e.isFile() && e.name.endsWith('.tsx') ? [ruta] : []
  })
}

describe('full-surface row links', () => {
  const todos = ficheros(RAIZ)

  it('scans the source tree', () => {
    // Sin esto, un glob que no encuentra nada deja la prueba en verde
    // pretendiendo que no hay fallos. Ya pasó.
    expect(todos.length).toBeGreaterThan(20)
  })

  it('always sit inside a positioned ancestor', () => {
    const sinAncla: string[] = []
    let encontrados = 0

    for (const fichero of todos) {
      const lineas = readFileSync(fichero, 'utf8').replace(/\r\n/g, '\n').split('\n')

      lineas.forEach((linea, i) => {
        if (!linea.includes('after:absolute') || !linea.includes('after:inset-0')) return
        encontrados += 1

        // El ancestro posicionado está en el JSX inmediatamente anterior.
        const contexto = lineas.slice(Math.max(0, i - 10), i).join('\n')
        if (!/className="[^"]*\b(relative|absolute|fixed|sticky)\b/.test(contexto)) {
          sinAncla.push(`${fichero.replace(RAIZ, 'src')}:${i + 1}`)
        }
      })
    }

    // La regla se comprueba sobre un uso real; si desaparece, esta prueba
    // dejaría de proteger nada en silencio.
    expect(encontrados).toBeGreaterThan(0)
    expect(sinAncla).toEqual([])
  })
})
