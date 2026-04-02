import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, BundleRequest } from '@/types/api'

export const bundlesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/bundles', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/bundles/${id}`, { params }),

  create: (data: BundleRequest) =>
    api.post<ApiResponse<unknown>>('/bundles', data),

  update: (id: number, data: Partial<BundleRequest>) =>
    api.patch<ApiResponse<unknown>>(`/bundles/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/bundles/${id}`),
}
