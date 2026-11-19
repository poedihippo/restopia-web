import api from '@/hooks/useApi'
import { sortBranchListResponse } from '@/utils/branchOrder'
import type { ApiResponse, PaginatedData, ListParams, BranchRequest, UpdateBranchRequest } from '@/types/api'

export const branchesService = {
  // Every branch picker reads this list, so the business order is applied here.
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/branches', { params }).then(sortBranchListResponse),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/branches/${id}`, { params }),

  create: (data: BranchRequest) =>
    api.post<ApiResponse<unknown>>('/branches', data),

  update: (id: number, data: UpdateBranchRequest) =>
    api.patch<ApiResponse<unknown>>(`/branches/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/branches/${id}`),
}
