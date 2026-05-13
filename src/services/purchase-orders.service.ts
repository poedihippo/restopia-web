import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, PurchaseOrderRequest } from '@/types/api'

export const purchaseOrdersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/purchase-orders', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/purchase-orders/${id}`, { params }),

  create: (data: PurchaseOrderRequest) =>
    api.post<ApiResponse<unknown>>('/purchase-orders', data),

  update: (id: number, data: Partial<PurchaseOrderRequest>) =>
    api.patch<ApiResponse<unknown>>(`/purchase-orders/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/purchase-orders/${id}`),

  accept: (id: number) =>
    api.post<ApiResponse<unknown>>(`/purchase-orders/${id}/accept`),

  reject: (id: number) =>
    api.post<ApiResponse<unknown>>(`/purchase-orders/${id}/reject`),
}
