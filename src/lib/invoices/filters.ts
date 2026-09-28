// Filtros de la lista de facturas.
//
// Viven fuera de actions/invoices.ts porque ese fichero es 'use server' y ahí
// solo pueden exportarse funciones asíncronas: una función pura de consulta no
// cabe. Separarlo además permite probarla sin tocar la base de datos.

export interface InvoiceFilters {
  vendor?: string
  status?: string
  currency?: string
  dateFrom?: string
  dateTo?: string
}

/**
 * Apply the list filters to a PostgREST query.
 *
 * Extracted and exported so the rules can be unit-tested: the date filter in
 * particular was wrong in a way no type could catch. It compared `invoice_date`
 * only, and that column is null on every invoice whose extraction failed — so
 * filtering by date silently hid exactly the invoices the user was looking for.
 * A date now matches the invoice date when it is known, and the upload date
 * when it is not.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyInvoiceFilters(q: any, filters?: InvoiceFilters): any {
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.currency) q = q.eq('currency', filters.currency)
  if (filters?.vendor) {
    // Searching the vendor used to drop every invoice whose extraction failed:
    // their vendor_name is null, so ilike never matched. The file name is the
    // only thing the user can recognise those by, so it is searched too.
    const patron = `%${filters.vendor}%`
    q = q.or(`vendor_name.ilike.${patron},original_filename.ilike.${patron}`)
  }

  if (filters?.dateFrom) {
    q = q.or(
      `invoice_date.gte.${filters.dateFrom},and(invoice_date.is.null,created_at.gte.${filters.dateFrom})`
    )
  }
  if (filters?.dateTo) {
    // The upload timestamp carries a time, so an inclusive "to" needs the end
    // of that day: created_at <= "2026-09-27" would drop everything uploaded
    // after midnight.
    const endOfDay = `${filters.dateTo}T23:59:59.999Z`
    q = q.or(
      `invoice_date.lte.${filters.dateTo},and(invoice_date.is.null,created_at.lte.${endOfDay})`
    )
  }

  return q
}
