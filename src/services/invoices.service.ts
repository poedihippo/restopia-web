import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface InvoiceDetailRequest {
  sales_order_detail_id: number
  qty: number
  description?: string
}

export interface InvoiceAdditionalChargeRequest {
  sales_order_component_id?: number
  name: string
  amount?: number
  description?: string
}

export interface CreateInvoiceRequest {
  sales_order_ids: number[]
  details: InvoiceDetailRequest[]
  additional_charges?: InvoiceAdditionalChargeRequest[]
  date?: string
  due_date?: string
  description?: string
}

export const invoicesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/invoices', { params }),

  get: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/invoices/${id}`, { params }),

  create: (data: CreateInvoiceRequest) =>
    api.post<ApiResponse<unknown>>('/invoices', data),
}
