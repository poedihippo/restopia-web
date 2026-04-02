import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductInventoryRequest } from '@/types/api'

export const productInventoriesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/product-inventories', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/product-inventories/${id}`, { params }),

  create: (data: ProductInventoryRequest) =>
    api.post<ApiResponse<unknown>>('/product-inventories', data),

  update: (id: number, data: Partial<ProductInventoryRequest>) =>
    api.patch<ApiResponse<unknown>>(`/product-inventories/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/product-inventories/${id}`),
}
