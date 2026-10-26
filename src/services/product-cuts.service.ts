import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

/**
 * Cut table — one row says "one parent base unit gives `yield_qty` child base
 * units". This is what decides whether a product can be cut (the old
 * `is_deferred` / `is_cutable_source` product flags are gone).
 *
 * Rules enforced by the backend (all validation 422):
 *  - parent and child must be on their own base unit
 *  - a product cannot be cut into itself, and no cycles are allowed
 *  - yield must be a whole number >= 2
 *  - scrap_rate must be 0 (scrap is recorded on the portioning)
 *  - the parent -> child pair may exist only once (delete is soft, so the
 *    pair can be re-created after a delete)
 */
export interface ProductCutRequest {
  parent_product_uom_id: number
  child_product_uom_id: number
  yield_qty: number
  scrap_rate?: number
}

export interface ProductCut {
  id: number
  parent_product_uom_id: number
  child_product_uom_id: number
  yield_qty: number
  scrap_rate?: number | null
  created_at?: string
  parent_product_uom?: { id: number; product_id?: number; code?: string; name?: string }
  child_product_uom?: { id: number; product_id?: number; code?: string; name?: string }
}

export const productCutsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<ProductCut>>>('/product-cuts', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<ProductCut>>(`/product-cuts/${id}`, { params }),

  create: (data: ProductCutRequest) =>
    api.post<ApiResponse<unknown>>('/product-cuts', data),

  update: (id: number, data: Partial<ProductCutRequest>) =>
    api.patch<ApiResponse<unknown>>(`/product-cuts/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/product-cuts/${id}`),
}
