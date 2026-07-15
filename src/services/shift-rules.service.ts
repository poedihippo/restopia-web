import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export const shiftRulesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/shift-rules', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/shift-rules/${id}`, { params }),

  create: (data: any) =>
    api.post<ApiResponse<any>>('/shift-rules', data),

  update: (id: number, data: any) =>
    api.patch<ApiResponse<any>>(`/shift-rules/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/shift-rules/${id}`),
}
