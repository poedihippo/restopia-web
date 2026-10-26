import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, PortioningRequest } from '@/types/api'

export const portioningsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/portionings', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/portionings/${id}`, { params }),

  create: (data: PortioningRequest) =>
    api.post<ApiResponse<unknown>>('/portionings', data),

  preview: (data: PortioningRequest) =>
    api.post<ApiResponse<unknown>>('/portionings/preview', data),

  update: (id: number, data: PortioningRequest) =>
    api.patch<ApiResponse<unknown>>(`/portionings/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/portionings/${id}`),
}
