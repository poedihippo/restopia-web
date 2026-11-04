import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, SalesOrderRequest } from '@/types/api'

export interface BulkSettlementItem {
  sales_order_id: number
  settlement_status: 'pending' | 'credit' | 'settled' | 'cancelled' | string
}

export interface SettlementPayout {
  sales_order_ids: number[]
  payment_method_id: number
  received_amount: number
  /** YYYY-MM-DD, not earlier than any order's date. */
  date: string
  description?: string
}

export interface BulkSettlementRequest {
  items?: BulkSettlementItem[]
  payouts?: SettlementPayout[]
}

export interface ReturnSalesOrderRequest {
  lines?: { sales_order_detail_id: number; qty: number }[]
  refund_payment_method_id?: number
}

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

  checkout: (data: {
    type: string
    sales_channel_id: number
    date: string
    fulfillment_date: string
    status: string
    settlement_status: string
    credit_type?: 'user' | 'customer' | null
    customer_id?: number | null
    customer_name?: string
    customer_phone?: string
    credit_by_id?: number | null
    voucher_id?: number
    description?: string
    details: {
      product_inventory_id?: number
      bundle_id?: number
      qty: number
      price: number
      status: string
      bundle_details?: { product_inventory_id: number; bundle_detail_item_id: number }[]
    }[]
    payments: {
      payment_method_id: number
      amount: number
      description?: string
      allocations?: { sales_order_id?: number; amount: number }[]
    }[]
  }, idempotencyKey: string = crypto.randomUUID()) =>
    api.post<ApiResponse<unknown>>('/sales-orders/checkout', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  // Without a body the whole order is returned. With `lines` only those
  // quantities; a paid order then needs refund_payment_method_id (never Credit).
  returnOrder: (id: number, data?: ReturnSalesOrderRequest) =>
    api.post<ApiResponse<unknown>>(`/sales-orders/${id}/return`, data, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),

  // At least one of items / payouts; an order may appear only once across both.
  // payouts[]: one marketplace transfer settling unpaid ONLINE orders of one
  // channel + one outlet (fee = outstanding total − received_amount).
  bulkUpdateSettlement: (data: BulkSettlementRequest) =>
    api.post<ApiResponse<unknown>>('/sales-orders/bulk-update-settlement-status', data),

  applyVoucher: (data: any) =>
    api.post<ApiResponse<unknown>>('/sales-orders/apply-voucher', data),

  exportExcel: (params?: {
    'filter[search]'?: string
    'filter[status]'?: string
    'filter[type]'?: string
    'filter[settlement_status]'?: string
    'filter[payment_status]'?: string
    'filter[credit_type]'?: string
    'filter[is_credit]'?: string
  }) =>
    api.get('/sales-orders/exports/excel/all', {
      params,
      responseType: 'blob',
    }),
}
