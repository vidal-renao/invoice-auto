import { describe, expect, it } from 'vitest'

import { checkIban, formatIban, isQrIban, maskIban, mod97, normalizeIban } from './iban'
import { isValidQrr, isValidScor, mod10Recursive, parseReference } from './reference'

// Published reference values: EPC/ECBS examples, SIX QR-bill examples, ISO 11649.
const ES = 'ES91 2100 0418 4502 0005 1332'
const DE = 'DE89 3704 0044 0532 0130 00'
const CH = 'CH93 0076 2011 6238 5295 7'
const CH_QR = 'CH44 3199 9123 0008 8901 2'
const QRR = '210000000003139471430009017'
const SCOR = 'RF18 5390 0754 7034'

describe('IBAN', () => {
  it('accepts published valid IBANs in print or electronic format', () => {
    for (const iban of [ES, DE, CH, CH_QR]) {
      expect(checkIban(iban)).toMatchObject({ valid: true, iban: normalizeIban(iban) })
    }
  })

  it('rejects one wrong digit (checksum)', () => {
    expect(checkIban('ES91 2100 0418 4502 0005 1333')).toEqual({ valid: false, problem: 'checksum' })
  })

  it('rejects two swapped digits, the usual typing error', () => {
    expect(checkIban('ES91 2100 0418 4502 0005 1323')).toEqual({ valid: false, problem: 'checksum' })
  })

  it('rejects a wrong length for the country before looking at the checksum', () => {
    expect(checkIban('ES91 2100 0418 4502 0005 133')).toEqual({ valid: false, problem: 'length' })
  })

  it('reports a country outside SEPA as out of scope, not as malformed', () => {
    expect(checkIban('US12 3456 7890 1234 5678')).toEqual({ valid: false, problem: 'country' })
  })

  it('rejects garbage', () => {
    expect(checkIban('not an iban')).toEqual({ valid: false, problem: 'format' })
    expect(checkIban('')).toEqual({ valid: false, problem: 'format' })
  })

  it('computes MOD 97-10 without overflowing on 30+ digit numbers', () => {
    // 3214282912345698765432161182 is the ISO 7064 worked example (remainder 1).
    expect(mod97('3214282912345698765432161182')).toBe(1)
  })

  it('recognises a QR-IBAN only in the reserved 30000–31999 institution range', () => {
    expect(isQrIban(CH_QR)).toBe(true)
    expect(isQrIban(CH)).toBe(false)
    expect(isQrIban(ES)).toBe(false)
    expect(isQrIban('CH44 3000 0000 0000 0000 0')).toBe(true)
    expect(isQrIban('CH44 3200 0000 0000 0000 0')).toBe(false)
  })

  it('formats and masks for display without leaking the full account', () => {
    expect(formatIban('ES9121000418450200051332')).toBe(ES)
    expect(maskIban(ES)).toBe('ES91 •••• 1332')
  })
})

describe('creditor references', () => {
  it('validates the SIX QR reference example', () => {
    expect(isValidQrr(QRR)).toBe(true)
    expect(isValidQrr('21 00000 00003 13947 14300 09017')).toBe(true)
  })

  it('rejects a QR reference with a wrong check digit or length', () => {
    expect(isValidQrr('210000000003139471430009018')).toBe(false)
    expect(isValidQrr('21000000000313947143000901')).toBe(false)
  })

  it('computes the recursive MOD 10 check digit', () => {
    expect(mod10Recursive('21000000000313947143000901')).toBe(7)
  })

  it('validates the ISO 11649 example and rejects a corrupted one', () => {
    expect(isValidScor(SCOR)).toBe(true)
    expect(isValidScor('RF19 5390 0754 7034')).toBe(false)
  })

  it('classifies what an invoice printed', () => {
    expect(parseReference(QRR)).toEqual({ kind: 'QRR', value: QRR })
    expect(parseReference(SCOR)).toEqual({ kind: 'SCOR', value: 'RF18539007547034' })
    expect(parseReference('Factura 2024-117')).toEqual({ kind: 'text', value: 'Factura 2024-117' })
    expect(parseReference('   ')).toBeNull()
    expect(parseReference(null)).toBeNull()
  })
})
