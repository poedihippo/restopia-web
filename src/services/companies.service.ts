import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, CompanyRequest } from '@/types/api'

export const companiesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/companies', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/companies/${id}`, { params }),

  create: (data: CompanyRequest) =>
    api.post<ApiResponse<unknown>>('/companies', data),

  update: (id: number, data: Partial<CompanyRequest>) =>
    api.patch<ApiResponse<unknown>>(`/companies/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/companies/${id}`),
}
