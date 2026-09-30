import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface BranchAccountSettingRequest {
  branch_id: number
  account_setting_key_id: number
  chart_of_account_id: number
  description?: string
}

export interface BranchAccountSettingUpdateRequest {
  branch_id?: number
  account_setting_key_id?: number
  chart_of_account_id?: number
  description?: string
}

export const BRANCH_ACCOUNT_SETTING_KEYS = [
  { id: 1, key: 'ar_trade', label: 'AR Trade (Counter Sales)', expected_normal_balance: 'debit', module: 'ar', pickup_point_disabled: true },
  { id: 2, key: 'ar_trade_customer', label: 'AR Trade Customer (Credit Sales)', expected_normal_balance: 'debit', module: 'ar', pickup_point_disabled: true },
  { id: 3, key: 'ap_trade', label: 'AP Trade (Purchases)', expected_normal_balance: 'credit', module: 'ap', pickup_point_disabled: true },
  { id: 4, key: 'sales_revenue', label: 'Sales Revenue', expected_normal_balance: 'credit', module: 'sales', pickup_point_disabled: false },
  { id: 5, key: 'cogs', label: 'Cost of Goods Sold', expected_normal_balance: 'debit', module: 'inventory', pickup_point_disabled: false },
  { id: 6, key: 'sales_discount', label: 'Sales Discount', expected_normal_balance: 'debit', module: 'sales', pickup_point_disabled: false },
] as const

export type BranchAccountSettingKey = typeof BRANCH_ACCOUNT_SETTING_KEYS[number]

export const branchAccountSettingsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/branch-account-settings', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/branch-account-settings/${id}`, { params }),

  create: (data: BranchAccountSettingRequest) =>
    api.post<ApiResponse<any>>('/branch-account-settings', data),

  update: (id: number, data: BranchAccountSettingUpdateRequest) =>
    api.patch<ApiResponse<any>>(`/branch-account-settings/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/branch-account-settings/${id}`),
}
