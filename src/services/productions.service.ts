import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductionRequest } from '@/types/api'

export const productionsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/productions', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/productions/${id}`, { params }),

  create: (data: ProductionRequest) =>
    api.post<ApiResponse<unknown>>('/productions', data),

  update: (id: number, data: Partial<ProductionRequest>) =>
    api.patch<ApiResponse<unknown>>(`/productions/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/productions/${id}`),
}
