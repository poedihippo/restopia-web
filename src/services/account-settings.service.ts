import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export const accountSettingsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/account-settings', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/account-settings/${id}`, { params }),

  update: (id: number, data: any) =>
    api.patch<ApiResponse<any>>(`/account-settings/${id}`, data),
}
