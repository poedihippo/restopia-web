import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export const operationRulesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/operation-rules', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/operation-rules/${id}`, { params }),

  create: (data: any) =>
    api.post<ApiResponse<any>>('/operation-rules', data),

  update: (id: number, data: any) =>
    api.patch<ApiResponse<any>>(`/operation-rules/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/operation-rules/${id}`),
}
