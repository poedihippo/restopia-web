import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, RoleRequest } from '@/types/api'

export const rolesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/roles', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/roles/${id}`, { params }),

  create: (data: RoleRequest) =>
    api.post<ApiResponse<unknown>>('/roles', data),

  update: (id: number, data: Partial<RoleRequest>) =>
    api.patch<ApiResponse<unknown>>(`/roles/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/roles/${id}`),
}
