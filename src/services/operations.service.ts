import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export const operationsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/operations', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/operations/${id}`, { params }),

  current: (params?: { include?: string }) =>
    api.get<ApiResponse<any>>('/operations/current', { params }),

  open: (data: any) =>
    api.post<ApiResponse<any>>('/operations/open', data),

  rollover: (data: any) =>
    api.post<ApiResponse<any>>('/operations/rollover', data),
    
  create: (data: any) =>
    api.post<ApiResponse<any>>('/operations', data),

  update: (id: number, data: any) =>
    api.patch<ApiResponse<any>>(`/operations/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/operations/${id}`),
}
