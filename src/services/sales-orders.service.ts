import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, SalesOrderRequest } from '@/types/api'

export const salesOrdersService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/sales-orders', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/sales-orders/${id}`, { params }),

  create: (data: SalesOrderRequest) =>
    api.post<ApiResponse<unknown>>('/sales-orders', data),

  update: (id: number, data: Partial<SalesOrderRequest>) =>
    api.patch<ApiResponse<unknown>>(`/sales-orders/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/sales-orders/${id}`),

  bulkUpdateSettlement: (data: any) =>
    api.post<ApiResponse<unknown>>('/sales-orders/bulk-update-settlement-status', data),

  applyVoucher: (data: any) =>
    api.post<ApiResponse<unknown>>('/sales-orders/apply-voucher', data),

  exportExcel: (params?: {
    'filter[search]'?: string
    'filter[status]'?: string
    'filter[type]'?: string
    'filter[settlement_status]'?: string
    'filter[payment_status]'?: string
  }) =>
    api.get('/sales-orders/exports/excel/all', {
      params,
      responseType: 'blob',
    }),
}
