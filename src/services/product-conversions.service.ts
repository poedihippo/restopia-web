import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductConversionRequest } from '@/types/api'

export const productConversionsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/product-conversions', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/product-conversions/${id}`, { params }),

  create: (data: ProductConversionRequest) =>
    api.post<ApiResponse<unknown>>('/product-conversions', data),

  update: (id: number, data: Partial<ProductConversionRequest>) =>
    api.patch<ApiResponse<unknown>>(`/product-conversions/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/product-conversions/${id}`),
}
