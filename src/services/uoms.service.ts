import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, UomRequest } from '@/types/api'

export const uomsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/uoms', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/uoms/${id}`, { params }),

  create: (data: UomRequest) =>
    api.post<ApiResponse<unknown>>('/uoms', data),

  update: (id: number, data: Partial<UomRequest>) =>
    api.patch<ApiResponse<unknown>>(`/uoms/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/uoms/${id}`),
}
