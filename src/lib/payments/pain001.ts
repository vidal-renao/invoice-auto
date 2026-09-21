import type { PaymentPlan, PaymentRoute } from './types'

/**
 * ISO 20022 customer credit transfer initiation, pain.001.001.09.
 *
 * One version serves both markets: the EPC SEPA Credit Transfer rulebook
 * (2023+) and the Swiss Payment Standards (SPS 2022+) are both built on
 * pain.001.001.09. The file is what a business uploads to its e-banking;
 * this code never talks to a bank and never moves money.
 *
 * Grouping: one payment information block (PmtInf) per route + currency +
 * execution date, because each of those is a header-level field.
 */

export const PAIN001_NAMESPACE = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09'

export interface Debtor {
  name: string
  iban: string
  bic: string | null
}

export interface BatchTransaction {
  /** Unique per transaction inside the file; reaches the creditor's statement. */
  end_to_end_id: string
  plan: PaymentPlan
  /** Free-text remittance used when there is no structured reference. */
  remittance_text: string
}

export interface Pain001Input {
  message_id: string
  created_at: Date
  debtor: Debtor
  transactions: readonly BatchTransaction[]
}

/** Names: ISO allows 140, but the EPC rulebook and SPS cap party names at 70. */
const NAME_MAX = 70

/** Characters the EPC guarantees every SEPA bank accepts. */
const SEPA_ALLOWED = /[^A-Za-z0-9/\-?:().,'+ ]/g

/**
 * SEPA text: accents transliterated ("Müller" → "Muller"), anything outside
 * the EPC basic Latin set replaced by a space. Swiss routes keep the text,
 * only escaped: SPS accepts the extended Latin set.
 */
export function sepaText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .replace(SEPA_ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function text(value: string, route: PaymentRoute, max: number): string {
  const clean = route === 'sepa' ? sepaText(value) : value.replace(/\s+/g, ' ').trim()
  return escapeXml(clean.slice(0, max))
}

/** 12345 → "123.45". Integer cents in, exact decimal out: no floats involved. */
export function formatAmount(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error(`Amount must be a positive integer number of cents, got ${cents}`)
  }
  const whole = Math.floor(cents / 100)
  const fraction = String(cents % 100).padStart(2, '0')
  return `${whole}.${fraction}`
}

function sumCents(transactions: readonly BatchTransaction[]): number {
  return transactions.reduce((total, t) => total + t.plan.amount_cents, 0)
}

/** ISO date-time without milliseconds, as banks commonly expect. */
function isoDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

const ID_PATTERN = /^[A-Za-z0-9/\-?:().,'+ ]{1,35}$/

function assertId(label: string, value: string) {
  if (!ID_PATTERN.test(value)) throw new Error(`${label} must be 1–35 SEPA characters, got "${value}"`)
}

interface Group {
  key: string
  route: PaymentRoute
  currency: string
  date: string
  transactions: BatchTransaction[]
}

function groupTransactions(transactions: readonly BatchTransaction[]): Group[] {
  const groups = new Map<string, Group>()
  for (const t of transactions) {
    const key = `${t.plan.route}|${t.plan.currency}|${t.plan.requested_execution_date}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        route: t.plan.route,
        currency: t.plan.currency,
        date: t.plan.requested_execution_date,
        transactions: [],
      }
      groups.set(key, group)
    }
    group.transactions.push(t)
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function remittance(t: BatchTransaction): string {
  const ref = t.plan.reference
  if (ref?.kind === 'QRR') {
    return `<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp><Ref>${ref.value}</Ref></CdtrRefInf></Strd></RmtInf>`
  }
  if (ref?.kind === 'SCOR') {
    return `<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry></Tp><Ref>${ref.value}</Ref></CdtrRefInf></Strd></RmtInf>`
  }
  const free = ref?.kind === 'text' ? ref.value : t.remittance_text
  return `<RmtInf><Ustrd>${text(free, t.plan.route, 140)}</Ustrd></RmtInf>`
}

function transactionXml(t: BatchTransaction): string {
  const p = t.plan
  return [
    '<CdtTrfTxInf>',
    `<PmtId><InstrId>${t.end_to_end_id}</InstrId><EndToEndId>${t.end_to_end_id}</EndToEndId></PmtId>`,
    `<Amt><InstdAmt Ccy="${p.currency}">${formatAmount(p.amount_cents)}</InstdAmt></Amt>`,
    `<Cdtr><Nm>${text(p.creditor_name, p.route, NAME_MAX)}</Nm></Cdtr>`,
    `<CdtrAcct><Id><IBAN>${p.creditor_iban}</IBAN></Id></CdtrAcct>`,
    remittance(t),
    '</CdtTrfTxInf>',
  ].join('')
}

export function buildPain001(input: Pain001Input): string {
  const { message_id, debtor, transactions } = input
  if (transactions.length === 0) throw new Error('A payment file needs at least one transaction')
  assertId('MsgId', message_id)

  const endToEndIds = new Set<string>()
  for (const t of transactions) {
    assertId('EndToEndId', t.end_to_end_id)
    if (endToEndIds.has(t.end_to_end_id)) throw new Error(`Duplicate EndToEndId ${t.end_to_end_id}`)
    endToEndIds.add(t.end_to_end_id)
  }

  const groups = groupTransactions(transactions)
  const debtorAgent = debtor.bic
    ? `<DbtrAgt><FinInstnId><BICFI>${escapeXml(debtor.bic)}</BICFI></FinInstnId></DbtrAgt>`
    : '<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>'

  const paymentInfos = groups.map((g, index) => {
    const pmtInfId = `${message_id.slice(0, 31)}-${String(index + 1).padStart(3, '0')}`
    return [
      '<PmtInf>',
      `<PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>`,
      '<PmtMtd>TRF</PmtMtd>',
      '<BtchBookg>true</BtchBookg>',
      `<NbOfTxs>${g.transactions.length}</NbOfTxs>`,
      `<CtrlSum>${formatAmount(sumCents(g.transactions))}</CtrlSum>`,
      g.route === 'sepa' ? '<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>' : '',
      `<ReqdExctnDt><Dt>${g.date}</Dt></ReqdExctnDt>`,
      `<Dbtr><Nm>${text(debtor.name, g.route, NAME_MAX)}</Nm></Dbtr>`,
      `<DbtrAcct><Id><IBAN>${escapeXml(debtor.iban)}</IBAN></Id></DbtrAcct>`,
      debtorAgent,
      // SEPA: charges shared at service level, as the scheme requires.
      g.route === 'sepa' ? '<ChrgBr>SLEV</ChrgBr>' : '',
      ...g.transactions.map(transactionXml),
      '</PmtInf>',
    ].join('')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Document xmlns="${PAIN001_NAMESPACE}">`,
    '<CstmrCdtTrfInitn>',
    '<GrpHdr>',
    `<MsgId>${escapeXml(message_id)}</MsgId>`,
    `<CreDtTm>${isoDateTime(input.created_at)}</CreDtTm>`,
    `<NbOfTxs>${transactions.length}</NbOfTxs>`,
    `<CtrlSum>${formatAmount(sumCents(transactions))}</CtrlSum>`,
    `<InitgPty><Nm>${escapeXml(sepaText(debtor.name).slice(0, NAME_MAX))}</Nm></InitgPty>`,
    '</GrpHdr>',
    ...paymentInfos,
    '</CstmrCdtTrfInitn>',
    '</Document>',
    '',
  ].join('\n')
}
