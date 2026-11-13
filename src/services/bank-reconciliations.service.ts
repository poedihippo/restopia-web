import api from '@/hooks/useApi'
import type { ApiResponse, ListParams } from '@/types/api'

export type BankReconciliationStatus = 'draft' | 'completed'
export type MatchGroupId = number | string

export interface BankStatementLine {
  id: number
  line_no: number
  date: string
  description: string
  reference?: string | null
  amount_in: number | string
  amount_out: number | string
  balance: number | string | null
  match_group_id: MatchGroupId | null
}

export interface BankLedgerLine {
  journal_detail_id: number
  journal_id: number
  journal_number: string
  date: string
  description?: string | null
  line_description?: string | null
  reference_type: string | null
  reference_id: number | null
  debit: number | string
  credit: number | string
  branch_id?: number | null
  match_group_id: MatchGroupId | null
}

export interface BankReconciliationSummary {
  statement_opening_balance: number | string
  statement_closing_balance: number | string
  statement_total_in: number | string
  statement_total_out: number | string
  statement_movement_ok: boolean
  unmatched_statement_lines: number
  deposits_in_transit: number | string
  outstanding_payments: number | string
  adjusted_bank_balance: number | string
  ledger_balance: number | string
  difference: number | string
  can_complete: boolean
}

export interface BankReconciliation {
  id: number
  company_id: number
  bank_account_id: number
  period_id: number
  statement_start_date: string
  statement_end_date: string
  statement_opening_balance: number | string
  statement_closing_balance: number | string
  status: BankReconciliationStatus
  completed_at?: string | null
  completed_by?: { id: number; name: string } | null
  bank_account?: {
    id: number
    bank_name: string
    account_number: string
    account_name: string
    chart_of_account_id: number
  } | null
  period?: { id: number; name: string; start_date: string; end_date: string; is_closed: boolean } | null
  created_at?: string
  created_by?: { id: number; name: string } | null
  statement_lines?: BankStatementLine[]
  summary?: BankReconciliationSummary
}

export interface BankReconciliationRequest {
  bank_account_id: number
  period_id: number
  statement_opening_balance: number
  statement_closing_balance: number
}

export interface StatementLineInput {
  date: string
  description: string
  reference?: string
  amount_in: number
  amount_out: number
  balance?: number | null
}

export type LedgerLineStatus = 'unmatched' | 'matched' | 'all'

const base = '/bank-reconciliations'

export const bankReconciliationsService = {
  list: (params?: ListParams) => api.get<ApiResponse<any>>(base, { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<BankReconciliation>>(`${base}/${id}`, { params }),

  create: (data: BankReconciliationRequest) =>
    api.post<ApiResponse<{ id: number }>>(base, data),

  delete: (id: number) => api.delete<ApiResponse<unknown>>(`${base}/${id}`),

  /** Replaces every UNMATCHED statement line (matched ones stay). Draft only. */
  replaceStatementLines: (id: number, lines: StatementLineInput[]) =>
    api.put<ApiResponse<unknown>>(`${base}/${id}/statement-lines`, { lines }),

  ledgerLines: (id: number, status: LedgerLineStatus = 'all') =>
    api.get<ApiResponse<BankLedgerLine[]>>(`${base}/${id}/ledger-lines`, { params: { status } }),

  autoMatch: (id: number) => api.post<ApiResponse<{ matched: number }>>(`${base}/${id}/auto-match`),

  /** Σ(amount_in − amount_out) of the statement lines must equal Σ(debit − credit) of the ledger lines. */
  match: (id: number, data: { statement_line_ids: number[]; journal_detail_ids: number[] }) =>
    api.post<ApiResponse<{ match_group_id: MatchGroupId }>>(`${base}/${id}/matches`, data),

  unmatch: (id: number, matchGroupId: MatchGroupId) =>
    api.delete<ApiResponse<unknown>>(`${base}/${id}/matches/${matchGroupId}`),

  /** Books a bank-only line (fee, interest) as a Cash Transaction and matches it. */
  bookLine: (id: number, lineId: number, data: { chart_of_account_id: number; description?: string }) =>
    api.post<ApiResponse<{ match_group_id: MatchGroupId; cash_transaction_id: number }>>(
      `${base}/${id}/statement-lines/${lineId}/book`,
      data,
    ),

  complete: (id: number) => api.post<ApiResponse<unknown>>(`${base}/${id}/complete`),

  reopen: (id: number) => api.post<ApiResponse<unknown>>(`${base}/${id}/reopen`),

  exportExcel: (id: number) => api.get<Blob>(`${base}/${id}/exports`, { responseType: 'blob' }),
}
