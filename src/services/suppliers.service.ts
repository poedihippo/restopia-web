import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, SupplierRequest } from '@/types/api'

export const suppliersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/suppliers', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/suppliers/${id}`, { params }),

  create: (data: SupplierRequest) =>
    api.post<ApiResponse<unknown>>('/suppliers', data),

  update: (id: number, data: Partial<SupplierRequest>) =>
    api.patch<ApiResponse<unknown>>(`/suppliers/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/suppliers/${id}`),
}
