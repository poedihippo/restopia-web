import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export type CashTransactionType = 'cash_in' | 'cash_out' | 'transfer'

export interface CashTransaction {
  id: number
  company_id?: number
  branch_id?: number
  transaction_number: string
  date?: string
  transaction_date?: string
  type: CashTransactionType
  bank_account_id?: number
  chart_of_account_id?: number | null
  transfer_to_bank_account_id?: number | null
  department_id?: number | null
  amount: number
  description?: string | null
  is_reversed?: boolean
  journal_id?: number | null
  reversing_id?: number | null
  is_reconciled?: boolean
  reconciled_at?: string | null
  created_at?: string
  updated_at?: string
  bankAccount?: {
    id: number
    bank_name: string
    account_number: string
    account_name: string
  }
  transferToBankAccount?: {
    id: number
    bank_name: string
    account_number: string
    account_name: string
  }
  chartOfAccount?: {
    id: number
    account_code: string
    account_name: string
  }
  journalEntry?: {
    id: number
    journal_number?: string
  }
  department?: {
    id: number
    code: string
    name: string
  }
  details?: Array<{
    id: number
    amount: number
    bank_account_id: number
    bank_account?: {
      id: number
      bank_name: string
      account_number: string
      account_name: string
    }
  }>
  created_by?: { id: number; name: string; email?: string }
  updated_by?: { id: number; name: string; email?: string }
}

export interface CashTransactionRequest {
  date: string
  transaction_date?: string
  type: CashTransactionType
  amount: number
  bank_account_id?: number
  /** cash_in / cash_out only: offsetting account. Omit to book against the outlet's petty cash. */
  chart_of_account_id?: number
  transfer_to_bank_account_id?: number
  description?: string
}

export const cashTransactionsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<CashTransaction>>>('/cash-transactions', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<CashTransaction>>(`/cash-transactions/${id}`, { params }),

  create: (data: CashTransactionRequest) =>
    api.post<ApiResponse<CashTransaction>>('/cash-transactions', data),

  /** No body: the API takes no reversal reason. */
  reverse: (id: number) =>
    api.patch<ApiResponse<CashTransaction>>(`/cash-transactions/${id}/reverse`),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/cash-transactions/${id}`),
}
