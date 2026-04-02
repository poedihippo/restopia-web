import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ReceiptRequest } from '@/types/api'

export const receiptsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/receipts', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/receipts/${id}`, { params }),

  create: (data: ReceiptRequest) =>
    api.post<ApiResponse<unknown>>('/receipts', data),

  update: (id: number, data: Partial<ReceiptRequest>) =>
    api.patch<ApiResponse<unknown>>(`/receipts/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/receipts/${id}`),
}
