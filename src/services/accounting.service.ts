import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

// ─── Account Categories ────────────────────────────────────────────────────

export interface AccountCategoryRequest {
  code: string
  name: string
  normal_balance: 'debit' | 'credit'
}

export const accountCategoriesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/account-categories', { params }),
  findById: (id: number) =>
    api.get<ApiResponse<unknown>>(`/account-categories/${id}`),
  create: (data: AccountCategoryRequest) =>
    api.post<ApiResponse<unknown>>('/account-categories', data),
  update: (id: number, data: Partial<AccountCategoryRequest>) =>
    api.patch<ApiResponse<unknown>>(`/account-categories/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/account-categories/${id}`),
}

// ─── Account Types ────────────────────────────────────────────────────────

export interface AccountTypeRequest {
  account_category_id: number
  code: string
  name: string
}

export const accountTypesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/account-types', { params }),
  findById: (id: number) =>
    api.get<ApiResponse<unknown>>(`/account-types/${id}`),
  create: (data: AccountTypeRequest) =>
    api.post<ApiResponse<unknown>>('/account-types', data),
  update: (id: number, data: Partial<AccountTypeRequest>) =>
    api.patch<ApiResponse<unknown>>(`/account-types/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/account-types/${id}`),
}

// ─── Chart of Accounts ────────────────────────────────────────────────────

export interface ChartOfAccountRequest {
  account_type_id: number
  code: string
  name: string
  description?: string
  is_active?: boolean
  is_header?: boolean
  normal_balance?: 'debit' | 'credit'
  parent_id?: number | null
  use_as_payment_method?: boolean
}

export const chartOfAccountsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/chart-of-accounts', { params }),
  findById: (id: number) =>
    api.get<ApiResponse<unknown>>(`/chart-of-accounts/${id}`),
  create: (data: ChartOfAccountRequest) =>
    api.post<ApiResponse<unknown>>('/chart-of-accounts', data),
  update: (id: number, data: Partial<ChartOfAccountRequest>) =>
    api.patch<ApiResponse<unknown>>(`/chart-of-accounts/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/chart-of-accounts/${id}`),
}

// ─── Fiscal Years ────────────────────────────────────────────────────────

export interface FiscalYearRequest {
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  is_closed: boolean
}

export const fiscalYearsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/fiscal-years', { params }),
  findById: (id: number) =>
    api.get<ApiResponse<unknown>>(`/fiscal-years/${id}`),
  create: (data: FiscalYearRequest) =>
    api.post<ApiResponse<unknown>>('/fiscal-years', data),
  update: (id: number, data: Partial<FiscalYearRequest>) =>
    api.patch<ApiResponse<unknown>>(`/fiscal-years/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/fiscal-years/${id}`),
  /** Close a fiscal year: all periods must be closed; posts closing entries to retained earnings. Irreversible. */
  close: (id: number) =>
    api.post<ApiResponse<unknown>>(`/fiscal-years/${id}/close`),
}

// ─── Periods ──────────────────────────────────────────────────────────────

export interface PeriodRequest {
  fiscal_year_id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  is_closed: boolean
}

export const periodsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/periods', { params }),
  findById: (id: number) =>
    api.get<ApiResponse<unknown>>(`/periods/${id}`),
  create: (data: PeriodRequest) =>
    api.post<ApiResponse<unknown>>('/periods', data),
  update: (id: number, data: Partial<PeriodRequest>) =>
    api.patch<ApiResponse<unknown>>(`/periods/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/periods/${id}`),
  /** Close a period; the backend refuses while it still has unposted journals. */
  close: (id: number) =>
    api.post<ApiResponse<unknown>>(`/periods/${id}/close`),
  /** Reopen a closed period (closing only goes through `close`). */
  reopen: (id: number) =>
    api.patch<ApiResponse<unknown>>(`/periods/${id}`, { is_closed: false }),
}

// ─── Journals ─────────────────────────────────────────────────────────────

export interface JournalDetailRequest {
  id?: number
  chart_of_account_id: number
  debit: number
  credit: number
  description?: string
}

export interface JournalRequest {
  period_id: number
  date: string
  type: 'manual' | 'sales' | 'closing' | 'purchase' | 'receipt' | 'payment' | 'adjustment' | 'stock_opname' | 'production'
  description?: string
  reference_type?: string
  reference_id?: number
  details: JournalDetailRequest[]
}

export const journalsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/journals', { params }),
  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/journals/${id}`, { params }),
  create: (data: JournalRequest) =>
    api.post<ApiResponse<unknown>>('/journals', data),
  update: (id: number, data: Partial<JournalRequest>) =>
    api.patch<ApiResponse<unknown>>(`/journals/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/journals/${id}`),
  post: (id: number) =>
    api.post<ApiResponse<unknown>>(`/journals/${id}/post`),
  reverse: (id: number) =>
    api.post<ApiResponse<unknown>>(`/journals/${id}/reverse`),
  /** account_balances[] rows carry opening_balance / closing_balance (debit − credit, signed). */
  trialBalance: (periodId: number, params?: { branch_id?: string }) =>
    api.get<ApiResponse<unknown>>(`/journals/trial-balance/${periodId}`, { params }),
}

// ─── Budgets ──────────────────────────────────────────────────────────────

export interface BudgetRequest {
  chart_of_account_id: number
  period_id: number
  amount: number
}

export const budgetsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/budgets', { params }),
  findById: (id: number) =>
    api.get<ApiResponse<unknown>>(`/budgets/${id}`),
  create: (data: BudgetRequest) =>
    api.post<ApiResponse<unknown>>('/budgets', data),
  update: (id: number, data: Partial<BudgetRequest>) =>
    api.patch<ApiResponse<unknown>>(`/budgets/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/budgets/${id}`),
}
