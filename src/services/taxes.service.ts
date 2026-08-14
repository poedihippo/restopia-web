import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface TaxRequest {
  code: string
  name: string
  rate: number
  inclusive: boolean
  is_active: boolean
  description?: string
}

export const taxesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/taxes', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/taxes/${id}`, { params }),

  create: (data: TaxRequest) =>
    api.post<ApiResponse<unknown>>('/taxes', data),

  update: (id: number, data: Partial<TaxRequest>) =>
    api.patch<ApiResponse<unknown>>(`/taxes/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/taxes/${id}`),
}
