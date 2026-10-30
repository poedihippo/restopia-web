import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface BuyerAccountSettingRequest {
  buyer_id: number
  account_setting_key_id: number
  chart_of_account_id: number
  description?: string
}

export interface BuyerAccountSettingUpdateRequest {
  buyer_id?: number
  account_setting_key_id?: number
  chart_of_account_id?: number
  description?: string
}

export const buyerAccountSettingsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/buyer-account-settings', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/buyer-account-settings/${id}`, { params }),

  create: (data: BuyerAccountSettingRequest) =>
    api.post<ApiResponse<any>>('/buyer-account-settings', data),

  update: (id: number, data: BuyerAccountSettingUpdateRequest) =>
    api.patch<ApiResponse<any>>(`/buyer-account-settings/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/buyer-account-settings/${id}`),
}
