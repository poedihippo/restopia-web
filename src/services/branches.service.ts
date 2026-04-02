import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, BranchRequest } from '@/types/api'

export const branchesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/branches', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/branches/${id}`, { params }),

  create: (data: BranchRequest) =>
    api.post<ApiResponse<unknown>>('/branches', data),

  update: (id: number, data: Partial<BranchRequest>) =>
    api.patch<ApiResponse<unknown>>(`/branches/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/branches/${id}`),
}
