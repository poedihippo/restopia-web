import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export type StockOpnameStatus = 'draft' | 'counting' | 'completed' | 'cancelled'
export type StockOpnameProductType = 'raw' | 'wip' | 'final' | 'supply'

export interface CreateStockOpnameRequest {
  date: string
  description?: string
  product_category_id?: number
  product_type?: StockOpnameProductType | string
}

export interface StockOpnameCountItemRequest {
  uom_id: number
  counted_qty: number
}

export interface UpdateStockOpnameCountItemRequest {
  id?: number
  uom_id: number
  counted_qty: number
}

export interface UpdateStockOpnameDetailLineRequest {
  product_inventory_id?: number
  product_uom_id?: number
  counted_qty?: number
  description?: string
  count_items?: StockOpnameCountItemRequest[]
}

export interface UpdateStockOpnameProductRequest {
  product_uom_id: number
  count_lines: UpdateStockOpnameDetailLineRequest[]
}

export interface UpdateStockOpnameDetailItemRequest {
  product_inventory_id?: number
  product_uom_id?: number
  counted_qty?: number
  description?: string
  count_items?: UpdateStockOpnameCountItemRequest[]
}

export interface UpdateStockOpnameRequest {
  date?: string
  description?: string
  products?: UpdateStockOpnameProductRequest[]
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
  name?: string
  code?: string
  product?: StockOpnameProduct
  uom?: StockOpnameUom
  [key: string]: any
}

export interface StockOpnameBatch {
  id?: number
  batch_code?: string
  expiry_date?: string
  product_uom?: StockOpnameProductUom
  product_uom_id?: number
  [key: string]: any
}

export interface StockOpnameProductInventory {
  id: number
  branch_id?: number
  product_uom_id?: number
  product_uom_batch_id?: number
  stock?: number
  qty?: number
  display_qty?: number
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
  counted_qty: number
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
  isNewBatch?: boolean
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
  status: StockOpnameStatus
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
        include: 'products,stock_opname_details,branch,created_by,updated_by',
        ...params,
      },
    }),

  create: (data: CreateStockOpnameRequest) =>
    api.post<ApiResponse<StockOpnameResponse | { message: string }>>('/stock-opnames', data),

  update: (id: number, data: UpdateStockOpnameRequest) =>
    api.patch<ApiResponse<{ message: string }>>(`/stock-opnames/${id}`, data),

  cancel: (id: number) =>
    api.post<ApiResponse<{ message: string }>>(`/stock-opnames/${id}/cancel`),

  complete: (id: number) =>
    api.post<ApiResponse<{ message: string }>>(`/stock-opnames/${id}/complete`),
}
