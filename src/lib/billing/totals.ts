import type { TaxTreatment } from './treatment'

/**
 * Los importes de una factura, en céntimos enteros de principio a fin.
 *
 * Nunca en coma flotante: 0.1 + 0.2 no es 0.3, y en una factura esa diferencia
 * es una discrepancia con Hacienda. El redondeo se hace una sola vez por
 * concepto, al medio hacia arriba, que es como redondean las administraciones.
 */

export interface InvoiceLine {
  description: string
  /** Cantidad en milésimas: 1.5 unidades = 1500. Permite horas y fracciones. */
  quantityMilli: number
  /** Precio unitario en céntimos. */
  unitPriceCents: number
  /** Descuento sobre la línea, fracción: 0.1 = 10 %. */
  discountRate?: number
}

export interface InvoiceTotals {
  lines: Array<{ netCents: number }>
  /** Base imponible. */
  netCents: number
  vatCents: number
  equivalenceCents: number
  /** Retención de IRPF: se resta del total. */
  retentionCents: number
  /** Lo que el cliente paga. */
  totalCents: number
}

/** Redondeo al céntimo, media hacia arriba, igual que la práctica administrativa. */
function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

export function computeLineNet(line: InvoiceLine): number {
  const bruto = (line.quantityMilli * line.unitPriceCents) / 1000
  const descuento = line.discountRate ? bruto * line.discountRate : 0
  return roundCents(bruto - descuento)
}

export function computeTotals(lines: InvoiceLine[], treatment: TaxTreatment): InvoiceTotals {
  const netos = lines.map((l) => ({ netCents: computeLineNet(l) }))
  const netCents = netos.reduce((sum, l) => sum + l.netCents, 0)

  // Un solo redondeo sobre la base total: redondear línea a línea y sumar
  // produce desviaciones de céntimos que no cuadran con el documento.
  const vatCents = roundCents(netCents * treatment.vatRate)
  const equivalenceCents = roundCents(netCents * treatment.equivalenceRate)
  const retentionCents = roundCents(netCents * treatment.retentionRate)

  return {
    lines: netos,
    netCents,
    vatCents,
    equivalenceCents,
    retentionCents,
    totalCents: netCents + vatCents + equivalenceCents - retentionCents,
  }
}
