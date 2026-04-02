import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, RecipeRequest } from '@/types/api'

export const recipesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/recipes', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/recipes/${id}`, { params }),

  create: (data: RecipeRequest) =>
    api.post<ApiResponse<unknown>>('/recipes', data),

  update: (id: number, data: Partial<RecipeRequest>) =>
    api.patch<ApiResponse<unknown>>(`/recipes/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/recipes/${id}`),
}
