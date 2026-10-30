import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface BuyerRequest {
  code: string
  name: string
  pic?: string
  phone?: string
  email?: string
}

export const buyersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/buyers', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/buyers/${id}`, { params }),

  create: (data: BuyerRequest) =>
    api.post<ApiResponse<any>>('/buyers', data),

  update: (id: number, data: Partial<BuyerRequest>) =>
    api.patch<ApiResponse<any>>(`/buyers/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/buyers/${id}`),
}
