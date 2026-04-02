import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, UserRequest } from '@/types/api'

export const usersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/users', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/users/${id}`, { params }),

  create: (data: UserRequest) =>
    api.post<ApiResponse<unknown>>('/users', data),

  update: (id: number, data: Partial<UserRequest>) =>
    api.patch<ApiResponse<unknown>>(`/users/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/users/${id}`),
}
