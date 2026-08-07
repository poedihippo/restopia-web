import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface StageRequest {
  code: string
  name: string
  is_active?: boolean
}

export const stagesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/stages', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/stages/${id}`, { params }),

  create: (data: StageRequest) =>
    api.post<ApiResponse<unknown>>('/stages', data),

  update: (id: number, data: Partial<StageRequest>) =>
    api.patch<ApiResponse<unknown>>(`/stages/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/stages/${id}`),
}
