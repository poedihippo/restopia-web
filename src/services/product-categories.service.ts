import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductCategoryRequest } from '@/types/api'

export const productCategoriesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/product-categories', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/product-categories/${id}`, { params }),

  create: (data: ProductCategoryRequest) =>
    api.post<ApiResponse<unknown>>('/product-categories', data),

  update: (id: number, data: Partial<ProductCategoryRequest>) =>
    api.patch<ApiResponse<unknown>>(`/product-categories/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/product-categories/${id}`),
}
