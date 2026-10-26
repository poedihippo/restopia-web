import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, PortioningRequest } from '@/types/api'

/**
 * A stock row that can be cut (a product that is the parent of at least one
 * product cut). This is the source picker of the portioning form.
 */
export interface PortioningSource {
  product_inventory_id: number
  product_id: number
  product_code?: string
  product_name?: string
  product_uom_id: number
  batch_id?: number
  batch_code?: string
  expiry_date?: string | null
  /** The only quantity — the old sellable/cutable figures are gone. */
  stock: number
  owner_ref?: string
  stage?: string
  location_ref?: string
}

/** One thing a source row can be cut into, with the cut table's yield. */
export interface PortioningSourceOutput {
  product_cut_id: number
  product_id: number
  product_code?: string
  product_name?: string
  /** The value a detail's `product_uom_id` takes (the output's base unit). */
  product_uom_id: number
  /** One source unit gives this many of the output. */
  yield_qty: number
}

export const portioningsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/portionings', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/portionings/${id}`, { params }),

  create: (data: PortioningRequest) =>
    api.post<ApiResponse<unknown>>('/portionings', data),

  preview: (data: PortioningRequest) =>
    api.post<ApiResponse<unknown>>('/portionings/preview', data),

  update: (id: number, data: PortioningRequest) =>
    api.patch<ApiResponse<unknown>>(`/portionings/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/portionings/${id}`),

  /**
   * Stock rows of this branch that can be cut. Not paged; ordered by product
   * name then first-expiring first. Needs `portioning.read`.
   */
  sources: (params?: { product_id?: number; include_empty?: boolean }) =>
    api.get<ApiResponse<PortioningSource[]>>('/portionings/sources', { params }),

  /**
   * What the product on one source stock row can be cut into.
   * `id` is the STOCK ROW id (`product_inventory_id`) from `sources`.
   * Needs `portioning.read`.
   */
  sourceOutputs: (id: number) =>
    api.get<ApiResponse<PortioningSourceOutput[]>>(`/portionings/sources/${id}/outputs`),
}
