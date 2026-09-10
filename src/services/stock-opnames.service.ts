import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface CreateStockOpnameRequest {
  date: string
  description?: string
  details?: Array<{ product_inventory_id: number; description?: string }> // optional legacy compatibility
}

export interface UpdateStockOpnameCountItem {
  id?: number
  uom_id: number
  counted_qty: number | string
}

export interface UpdateStockOpnameCountLine {
  product_inventory_id: number
  counted_qty?: number
  description?: string
  count_items?: UpdateStockOpnameCountItem[]
}

export interface UpdateStockOpnameProductGroup {
  product_uom_id: number
  count_lines: UpdateStockOpnameCountLine[]
}

// Backward compatibility for legacy flat details
export interface UpdateStockOpnameDetailItemRequest {
  product_inventory_id: number
  counted_qty?: number
  count_items?: UpdateStockOpnameCountItem[]
  description?: string
}

export interface UpdateStockOpnameRequest {
  date?: string
  description?: string
  products?: UpdateStockOpnameProductGroup[]
  details?: UpdateStockOpnameDetailItemRequest[]
}

export interface StockOpnameUom {
  id: number
  name: string
  code: string
  [key: string]: any
}

export interface StockOpnameProduct {
  id: number
  name: string
  code: string
  base_uom?: StockOpnameUom
  category?: { id: number; name: string; [key: string]: any }
  [key: string]: any
}

export interface StockOpnameProductUom {
  id: number
  product_id: number
  uom_id: number
  code?: string
  product?: StockOpnameProduct
  uom?: StockOpnameUom
  [key: string]: any
}

export interface StockOpnameBatch {
  id?: number
  batch_code?: string
  expiry_date?: string
  [key: string]: any
}

export interface StockOpnameProductInventory {
  id: number
  branch_id?: number
  product_uom_id?: number
  product_uom_batch_id?: number
  stock?: number
  qty?: number
  status?: string
  owner_ref?: string
  stage?: string
  location_ref?: string
  product_uom_batch?: StockOpnameBatch
  product_uom?: StockOpnameProductUom
  [key: string]: any
}

export interface StockOpnameCountItem {
  id: number
  stock_opname_detail_id?: number
  uom_id: number
  counted_qty: number | string
  uom?: StockOpnameUom
}

export interface StockOpnameDetailItem {
  id: number
  stock_opname_id?: number
  product_inventory_id: number
  system_qty: number
  counted_qty: number | null
  variance: number | null
  description?: string | null
  product_inventory?: StockOpnameProductInventory
  count_items?: StockOpnameCountItem[]
  [key: string]: any
}

export interface StockOpnameProductGroup {
  id?: number
  stock_opname_id?: number
  product_uom_id: number
  product_uom?: StockOpnameProductUom
  stock_opname_details: StockOpnameDetailItem[]
}

export interface StockOpnameResponse {
  id: number
  branch_id: number
  code: string
  date: string
  status: 'draft' | 'counting' | 'completed' | 'cancelled'
  description?: string | null
  created_by_id?: number
  updated_by_id?: number
  created_by?: { id: number; name: string; email?: string }
  updated_by?: { id: number; name: string; email?: string }
  created_at?: string
  updated_at?: string
  branch?: { id: number; name: string; code?: string }
  products?: StockOpnameProductGroup[]
  stock_opname_details?: StockOpnameDetailItem[]
  [key: string]: any
}

export const stockOpnamesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<StockOpnameResponse>>>('/stock-opnames', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<StockOpnameResponse>>(`/stock-opnames/${id}`, {
      params: {
        include: 'products,branch,created_by',
        ...params,
      },
    }),

  create: (data: CreateStockOpnameRequest) =>
    api.post<ApiResponse<StockOpnameResponse>>('/stock-opnames', data),

  update: (id: number, data: UpdateStockOpnameRequest) =>
    api.patch<ApiResponse<StockOpnameResponse>>(`/stock-opnames/${id}`, data),

  cancel: (id: number) =>
    api.post<ApiResponse<StockOpnameResponse>>(`/stock-opnames/${id}/cancel`),

  complete: (id: number) =>
    api.post<ApiResponse<StockOpnameResponse>>(`/stock-opnames/${id}/complete`),
}
