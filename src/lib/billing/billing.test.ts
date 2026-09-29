import { describe, expect, it } from 'vitest'
import { decideTaxTreatment, type Client, type Issuer } from './treatment'
import { computeLineNet, computeTotals, type InvoiceLine } from './totals'

const autonomoEs: Issuer = { country: 'ES', taxId: 'B87654321', professionalActivity: true }
const empresaEs: Issuer = { country: 'ES', taxId: 'B87654321' }
const suizo: Issuer = { country: 'CH', taxId: 'CHE-412.887.336' }

const clienteEmpresaEs: Client = { country: 'ES', taxId: 'B12345678', kind: 'business' }
const particularEs: Client = { country: 'ES', taxId: null, kind: 'individual' }

describe('tratamiento fiscal de una factura emitida', () => {
  it('nacional español: 21 % y nada más', () => {
    const t = decideTaxTreatment(empresaEs, clienteEmpresaEs)
    expect(t.case).toBe('domestic')
    expect(t.vatRate).toBe(0.21)
    expect(t.retentionRate).toBe(0)
  })

  it('profesional español a empresa española: retiene el 15 %', () => {
    const t = decideTaxTreatment(autonomoEs, clienteEmpresaEs)
    expect(t.retentionRate).toBe(0.15)
    expect(t.legalMentions).toContain('irpfWithholding')
  })

  it('profesional recién dado de alta: retención reducida del 7 %', () => {
    const t = decideTaxTreatment({ ...autonomoEs, reducedRetention: true }, clienteEmpresaEs)
    expect(t.retentionRate).toBe(0.07)
  })

  it('a un particular no se le retiene, aunque el emisor sea profesional', () => {
    // La retención la practica quien paga, y un particular no es retenedor.
    const t = decideTaxTreatment(autonomoEs, particularEs)
    expect(t.retentionRate).toBe(0)
  })

  it('empresa alemana con VIES válido: inversión del sujeto pasivo, IVA 0', () => {
    const t = decideTaxTreatment(empresaEs, {
      country: 'DE',
      taxId: 'DE123456789',
      kind: 'business',
      vatValidated: true,
    })
    expect(t.case).toBe('eu_reverse_charge')
    expect(t.vatRate).toBe(0)
    expect(t.legalMentions).toContain('reverseCharge')
  })

  it('empresa alemana SIN VIES válido: se cobra IVA español', () => {
    // Emitir sin IVA contra un NIF-IVA que no existe deja la deuda en el emisor.
    const t = decideTaxTreatment(empresaEs, { country: 'DE', taxId: 'DE1', kind: 'business' })
    expect(t.case).toBe('domestic')
    expect(t.vatRate).toBe(0.21)
    expect(t.reasons).toContain('vatNumberNotValidated')
  })

  it('particular francés: paga el IVA del emisor, no el suyo', () => {
    const t = decideTaxTreatment(empresaEs, { country: 'FR', taxId: null, kind: 'individual' })
    expect(t.case).toBe('eu_consumer')
    expect(t.vatRate).toBe(0.21)
  })

  it('cliente suizo desde España: exportación exenta', () => {
    const t = decideTaxTreatment(empresaEs, { country: 'CH', taxId: null, kind: 'business' })
    expect(t.case).toBe('export')
    expect(t.vatRate).toBe(0)
    expect(t.legalMentions).toContain('exportExempt')
  })

  it('emisor suizo a cliente suizo: MWST 8,1 %', () => {
    const t = decideTaxTreatment(suizo, { country: 'CH', taxId: null, kind: 'business' })
    expect(t.vatRate).toBeCloseTo(0.081, 5)
  })

  it('emisor suizo facturando fuera: sin MWST', () => {
    const t = decideTaxTreatment(suizo, { country: 'DE', taxId: null, kind: 'business' })
    expect(t.case).toBe('export')
    expect(t.vatRate).toBe(0)
  })

  it('acepta un tipo reducido legal y rechaza uno inventado', () => {
    expect(decideTaxTreatment(empresaEs, clienteEmpresaEs, 0.1).vatRate).toBe(0.1)

    const inventado = decideTaxTreatment(empresaEs, clienteEmpresaEs, 0.12)
    expect(inventado.vatRate).toBe(0.21)
    expect(inventado.reasons).toContain('overrideNotLegalRate')
  })

  it('recargo de equivalencia: 5,2 % junto al 21 %', () => {
    const t = decideTaxTreatment(empresaEs, { ...clienteEmpresaEs, equivalenceSurcharge: true })
    expect(t.equivalenceRate).toBeCloseTo(0.052, 5)
  })

  it('el recargo sigue al tipo reducido', () => {
    const t = decideTaxTreatment(empresaEs, { ...clienteEmpresaEs, equivalenceSurcharge: true }, 0.1)
    expect(t.equivalenceRate).toBeCloseTo(0.014, 5)
  })
})

describe('importes, siempre en céntimos enteros', () => {
  const linea = (o: Partial<InvoiceLine> = {}): InvoiceLine => ({
    description: 'Servicio',
    quantityMilli: 1000,
    unitPriceCents: 10000,
    ...o,
  })

  it('cantidades fraccionarias: 12,5 horas a 65,00 €', () => {
    expect(computeLineNet(linea({ quantityMilli: 12_500, unitPriceCents: 6500 }))).toBe(81_250)
  })

  it('aplica el descuento sobre la línea', () => {
    expect(computeLineNet(linea({ discountRate: 0.1 }))).toBe(9000)
  })

  it('reproduce la factura de prueba española al céntimo', () => {
    // 1.779,50 € de base, IVA 21 % = 373,695 -> 373,70. Total 2.153,20 €.
    const t = decideTaxTreatment(empresaEs, clienteEmpresaEs)
    const totales = computeTotals(
      [
        linea({ unitPriceCents: 84_000 }),
        linea({ quantityMilli: 12_000, unitPriceCents: 6500 }),
        linea({ unitPriceCents: 12_450 }),
        linea({ unitPriceCents: 3500 }),
      ],
      t
    )
    expect(totales.netCents).toBe(177_950)
    expect(totales.vatCents).toBe(37_370)
    expect(totales.totalCents).toBe(215_320)
  })

  it('la retención se resta del total', () => {
    const t = decideTaxTreatment(autonomoEs, clienteEmpresaEs)
    const totales = computeTotals([linea({ unitPriceCents: 100_000 })], t)
    expect(totales.netCents).toBe(100_000)
    expect(totales.vatCents).toBe(21_000)
    expect(totales.retentionCents).toBe(15_000)
    expect(totales.totalCents).toBe(106_000)
  })

  it('inversión del sujeto pasivo: base y total coinciden', () => {
    const t = decideTaxTreatment(empresaEs, {
      country: 'DE',
      taxId: 'DE1',
      kind: 'business',
      vatValidated: true,
    })
    const totales = computeTotals([linea({ unitPriceCents: 50_000 })], t)
    expect(totales.vatCents).toBe(0)
    expect(totales.totalCents).toBe(50_000)
  })

  it('redondea una sola vez sobre la base, no línea a línea', () => {
    // Tres líneas de 3,33 €: 9,99 de base. El 21 % son 2,0979 -> 2,10.
    // Redondeando cada línea antes de sumar saldría 2,07: tres céntimos de
    // diferencia que no cuadran con el documento impreso.
    const t = decideTaxTreatment(empresaEs, clienteEmpresaEs)
    const totales = computeTotals(
      [linea({ unitPriceCents: 333 }), linea({ unitPriceCents: 333 }), linea({ unitPriceCents: 333 })],
      t
    )
    expect(totales.netCents).toBe(999)
    expect(totales.vatCents).toBe(210)
    expect(totales.totalCents).toBe(1209)
  })

  it('MWST suiza al 8,1 % sobre 2.168,00 CHF', () => {
    const t = decideTaxTreatment(suizo, { country: 'CH', taxId: null, kind: 'business' })
    const totales = computeTotals([linea({ unitPriceCents: 216_800 })], t)
    expect(totales.vatCents).toBe(17_561)
    expect(totales.totalCents).toBe(234_361)
  })
})
