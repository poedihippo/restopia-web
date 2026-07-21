import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, ProductInventoryRequest } from '@/types/api'

export const productInventoriesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/product-inventories', { params }).then((res) => {
      if (res.data?.data && Array.isArray(res.data.data.data)) {
        res.data.data.data = res.data.data.data.map((item: any) => ({
          ...item,
          qty: item.stock ?? item.qty ?? 0,
        }))
      }
      return res
    }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/product-inventories/${id}`, { params }).then((res) => {
      const item = res.data?.data as any
      if (item) {
        item.qty = item.stock ?? item.qty ?? 0
      }
      return res
    }),

  create: (data: ProductInventoryRequest) =>
    api.post<ApiResponse<unknown>>('/product-inventories', data),

  update: (id: number, data: Partial<ProductInventoryRequest>) =>
    api.patch<ApiResponse<unknown>>(`/product-inventories/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/product-inventories/${id}`),

  exportExcel: (params?: {
    'filter[search]'?: string
    'filter[branch_id]'?: number
  }) =>
    api.get('/product-inventories/exports/excel/all', {
      params,
      responseType: 'blob',
    }),
}
