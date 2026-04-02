import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, CustomerRequest } from '@/types/api'

export const customersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/customers', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/customers/${id}`, { params }),

  create: (data: CustomerRequest) =>
    api.post<ApiResponse<unknown>>('/customers', data),

  update: (id: number, data: Partial<CustomerRequest>) =>
    api.patch<ApiResponse<unknown>>(`/customers/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/customers/${id}`),
}
