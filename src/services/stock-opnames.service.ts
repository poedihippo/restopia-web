import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface CreateStockOpnameDetailItemRequest {
  product_inventory_id: number
  description?: string
}

export interface CreateStockOpnameRequest {
  date: string
  description?: string
  details: CreateStockOpnameDetailItemRequest[]
}

export interface UpdateStockOpnameDetailItemRequest {
  product_inventory_id: number
  counted_qty?: number
  count_items?: { uom_id: number; counted_qty: number }[]
  description?: string
}

export interface UpdateStockOpnameRequest {
  date?: string
  description?: string
  details?: UpdateStockOpnameDetailItemRequest[]
}

export const stockOpnamesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/stock-opnames', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/stock-opnames/${id}`, { params }),

  create: (data: CreateStockOpnameRequest) =>
    api.post<ApiResponse<unknown>>('/stock-opnames', data),

  update: (id: number, data: UpdateStockOpnameRequest) =>
    api.patch<ApiResponse<unknown>>(`/stock-opnames/${id}`, data),

  cancel: (id: number) =>
    api.post<ApiResponse<unknown>>(`/stock-opnames/${id}/cancel`),

  complete: (id: number) =>
    api.post<ApiResponse<unknown>>(`/stock-opnames/${id}/complete`),
}
