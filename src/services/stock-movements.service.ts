import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, StockMovementRequest } from '@/types/api'

export const stockMovementsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/stock-movements', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/stock-movements/${id}`, { params }),

  create: (data: StockMovementRequest) =>
    api.post<ApiResponse<unknown>>('/stock-movements', data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/stock-movements/${id}`),
}
