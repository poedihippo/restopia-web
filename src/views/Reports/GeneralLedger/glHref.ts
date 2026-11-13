/**
 * Drill-down link into the General Ledger page. The GL view reads these query
 * params on load (see GeneralLedgerView):
 *   account_id  → single-account mode (preferred when the id is known)
 *   coa_code    → code-range mode with start = end = this code
 *   coa_name    → label for the pre-selected account (shown before the options load)
 *   start_date / end_date (YYYY-MM-DD), branch_id ('' | 'all' | '<id>')
 */
export const GENERAL_LEDGER_PATH = '/accounting/reports/general-ledger'

export function generalLedgerHref(opts: {
  accountId?: number | null
  code?: string | null
  name?: string | null
  startDate: string
  endDate: string
  branchId?: string | null
}): string {
  const q = new URLSearchParams()
  if (opts.accountId) q.set('account_id', String(opts.accountId))
  if (opts.code) q.set('coa_code', opts.code)
  if (opts.name) q.set('coa_name', opts.name)
  if (opts.startDate) q.set('start_date', opts.startDate)
  if (opts.endDate) q.set('end_date', opts.endDate)
  if (opts.branchId) q.set('branch_id', opts.branchId)
  return `${GENERAL_LEDGER_PATH}?${q.toString()}`
}

/** First day of the as-of date's calendar year — start of a balance-sheet drill-down. */
export function yearStartOf(date: string): string {
  const y = (date || '').slice(0, 4)
  return /^\d{4}$/.test(y) ? `${y}-01-01` : `${new Date().getFullYear()}-01-01`
}
