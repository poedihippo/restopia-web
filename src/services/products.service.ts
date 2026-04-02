import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductRequest } from '@/types/api'

export const productsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/products', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/products/${id}`, { params }),

  create: (data: ProductRequest) =>
    api.post<ApiResponse<unknown>>('/products', data),

  update: (id: number, data: Partial<ProductRequest>) =>
    api.patch<ApiResponse<unknown>>(`/products/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/products/${id}`),
}
