import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, VoucherRequest } from '@/types/api'

export const vouchersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/vouchers', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/vouchers/${id}`, { params }),

  create: (data: VoucherRequest) =>
    api.post<ApiResponse<unknown>>('/vouchers', data),

  update: (id: number, data: Partial<VoucherRequest>) =>
    api.patch<ApiResponse<unknown>>(`/vouchers/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/vouchers/${id}`),
}
