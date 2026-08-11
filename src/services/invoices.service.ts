import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface InvoiceLineRequest {
  delivery_detail_id: number
  qty?: number
  price?: number
}

export interface CreateInvoiceFromReceiptsRequest {
  receipt_ids: number[]
  date?: string
  description?: string
}

export const invoicesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/invoices', { params }),

  get: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/invoices/${id}`, { params }),

  createFromReceipts: (data: CreateInvoiceFromReceiptsRequest) =>
    api.post<ApiResponse<unknown>>('/invoices', data),
}
