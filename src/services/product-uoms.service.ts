import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductUomRequest } from '@/types/api'

export const productUomsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/product-uoms', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/product-uoms/${id}`, { params }),

  create: (data: ProductUomRequest) =>
    api.post<ApiResponse<unknown>>('/product-uoms', data),

  update: (id: number, data: Partial<ProductUomRequest>) =>
    api.patch<ApiResponse<unknown>>(`/product-uoms/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/product-uoms/${id}`),
}
