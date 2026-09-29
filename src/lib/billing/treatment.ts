import { COUNTRY_TAX_CONFIG } from '@/lib/tax/config'

/**
 * Qué impuestos lleva una factura emitida, y por qué.
 *
 * Esto es lo que el autónomo no debería tener que decidir. Escribe cliente,
 * concepto e importe; el tratamiento fiscal sale de dónde está el cliente, si
 * es empresa o particular, y de qué vende quien factura. Cada decisión viene
 * con su motivo y con la mención legal que la factura está obligada a llevar:
 * un cálculo fiscal que no se puede explicar no sirve ante una inspección.
 */

export type ClientKind = 'business' | 'individual'

export interface Issuer {
  /** ISO 3166-1 alfa-2 del emisor. */
  country: string
  /** NIF / UID del emisor. */
  taxId: string | null
  /** Actividad profesional española sujeta a retención de IRPF. */
  professionalActivity?: boolean
  /** Primeros tres años de actividad: la retención reducida del 7 %. */
  reducedRetention?: boolean
}

export interface Client {
  country: string
  taxId: string | null
  kind: ClientKind
  /** NIF-IVA validado en VIES. Sin esto no hay inversión del sujeto pasivo. */
  vatValidated?: boolean
  /** El cliente está en recargo de equivalencia (minorista español). */
  equivalenceSurcharge?: boolean
}

export type TaxCase =
  | 'domestic'
  | 'eu_reverse_charge'
  | 'eu_consumer'
  | 'export'
  | 'domestic_exempt'

export interface TaxTreatment {
  case: TaxCase
  /** Tipo de IVA/MWST como fracción: 0.21 = 21 %. */
  vatRate: number
  /** Retención de IRPF como fracción; 0 cuando no aplica. */
  retentionRate: number
  /** Recargo de equivalencia como fracción; 0 cuando no aplica. */
  equivalenceRate: number
  /** Claves de las menciones legales obligatorias en la factura. */
  legalMentions: string[]
  /** Claves de la explicación que se muestra al usuario. */
  reasons: string[]
}

/** Recargo de equivalencia español, emparejado con cada tipo de IVA. */
const EQUIVALENCE_BY_VAT: Record<string, number> = {
  '0.21': 0.052,
  '0.1': 0.014,
  '0.04': 0.005,
}

const RETENTION_STANDARD = 0.15
const RETENTION_REDUCED = 0.07

function isEu(country: string): boolean {
  return COUNTRY_TAX_CONFIG[country]?.euMember === true
}

function standardRate(country: string): number {
  return COUNTRY_TAX_CONFIG[country]?.standardRate ?? 0
}

/**
 * Decide el tratamiento fiscal de una factura.
 *
 * `vatRateOverride` permite un tipo reducido cuando el producto lo tiene (libros,
 * alimentación…), pero solo se respeta si es un tipo legal del país que factura:
 * inventarse un 12 % en España es exactamente el error que esto debe impedir.
 */
export function decideTaxTreatment(
  issuer: Issuer,
  client: Client,
  vatRateOverride?: number
): TaxTreatment {
  const mentions: string[] = []
  const reasons: string[] = []

  const sameCountry = issuer.country === client.country
  const bothEu = isEu(issuer.country) && isEu(client.country)

  // ── Caso 1: intracomunitario B2B → inversión del sujeto pasivo ────────────
  if (!sameCountry && bothEu && client.kind === 'business') {
    if (client.vatValidated) {
      return {
        case: 'eu_reverse_charge',
        vatRate: 0,
        retentionRate: 0,
        equivalenceRate: 0,
        legalMentions: ['reverseCharge'],
        reasons: ['clientInOtherEuCountry', 'vatNumberValidated', 'noVatCharged'],
      }
    }
    // Sin VIES válido no hay inversión: se factura con IVA del emisor. Es el
    // error caro típico — emitir sin IVA contra un NIF-IVA que no existe deja
    // la deuda tributaria en el emisor.
    reasons.push('vatNumberNotValidated', 'chargingDomesticVat')
  }

  // ── Caso 2: fuera de la UE → exportación exenta ───────────────────────────
  if (!sameCountry && !isEu(client.country) && isEu(issuer.country)) {
    return {
      case: 'export',
      vatRate: 0,
      retentionRate: 0,
      equivalenceRate: 0,
      legalMentions: ['exportExempt'],
      reasons: ['clientOutsideEu', 'noVatCharged'],
    }
  }

  // Emisor fuera de la UE (Suiza) facturando al extranjero: sin MWST suiza.
  if (!sameCountry && !isEu(issuer.country)) {
    return {
      case: 'export',
      vatRate: 0,
      retentionRate: 0,
      equivalenceRate: 0,
      legalMentions: ['exportExempt'],
      reasons: ['serviceAbroad', 'noVatCharged'],
    }
  }

  // ── Caso 3: nacional (o intracomunitario B2C, que lleva IVA del emisor) ───
  const legal = COUNTRY_TAX_CONFIG[issuer.country]?.vatRates ?? []
  const rate =
    vatRateOverride != null && legal.includes(vatRateOverride)
      ? vatRateOverride
      : standardRate(issuer.country)

  if (vatRateOverride != null && !legal.includes(vatRateOverride)) {
    reasons.push('overrideNotLegalRate')
  }

  const caso: TaxCase =
    !sameCountry && bothEu && client.kind === 'individual' ? 'eu_consumer' : 'domestic'
  if (caso === 'eu_consumer') reasons.push('euConsumerPaysIssuerVat')

  // Retención de IRPF: solo emisor profesional español facturando a empresa
  // o profesional también español. Es el campo que más se equivoca a mano.
  let retentionRate = 0
  if (
    issuer.country === 'ES' &&
    client.country === 'ES' &&
    issuer.professionalActivity &&
    client.kind === 'business'
  ) {
    retentionRate = issuer.reducedRetention ? RETENTION_REDUCED : RETENTION_STANDARD
    mentions.push('irpfWithholding')
    reasons.push(issuer.reducedRetention ? 'retentionReducedNewActivity' : 'retentionProfessional')
  }

  // Recargo de equivalencia: minorista español, solo en ventas nacionales.
  let equivalenceRate = 0
  if (issuer.country === 'ES' && client.country === 'ES' && client.equivalenceSurcharge) {
    equivalenceRate = EQUIVALENCE_BY_VAT[String(rate)] ?? 0
    if (equivalenceRate > 0) reasons.push('equivalenceSurcharge')
  }

  return {
    case: caso,
    vatRate: rate,
    retentionRate,
    equivalenceRate,
    legalMentions: mentions,
    reasons: [...reasons, 'domesticVatApplied'],
  }
}
