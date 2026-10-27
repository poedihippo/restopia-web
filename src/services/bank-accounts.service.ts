import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export type BankAccountType = 'checking' | 'savings' | 'deposit'

export interface BankAccount {
  id: number
  company_id: number
  chart_of_account_id: number
  bank_name: string
  account_number: string
  account_name: string
  account_type: BankAccountType
  opening_balance: number
  current_balance: number
  swift_code?: string | null
  branch?: string | null
  branch_name?: string | null
  description?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  chart_of_account?: {
    id: number
    code: string
    name: string
  }
  created_by?: { id: number; name: string; email?: string }
  updated_by?: { id: number; name: string; email?: string }
}

export interface BankAccountRequest {
  company_id?: number
  chart_of_account_id?: number
  bank_name: string
  account_number: string
  account_name: string
  account_type: BankAccountType
  opening_balance?: number
  swift_code?: string
  branch?: string
  branch_name?: string
  description?: string
  is_active?: boolean
}

export const bankAccountsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<BankAccount>>>('/bank-accounts', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<BankAccount>>(`/bank-accounts/${id}`, { params }),

  create: (data: BankAccountRequest) =>
    api.post<ApiResponse<BankAccount>>('/bank-accounts', data),

  update: (id: number, data: Partial<BankAccountRequest>) =>
    api.patch<ApiResponse<BankAccount>>(`/bank-accounts/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/bank-accounts/${id}`),
}
