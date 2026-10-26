import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, Sellable, SellableSummary } from '@/types/api'

/**
 * Sellable lots — portioned output lots trackable per SKU/inventory row.
 * Read-only per OpenAPI (GET /sellables, /sellables/summary, /sellables/{id}).
 */
export const sellablesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<Sellable>>>('/sellables', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<Sellable>>(`/sellables/${id}`, {
      params: {
        include: 'product_uom,product_uom.product,product_uom.uom,product_inventory,usages,created_by,updated_by',
        ...params,
      },
    }),

  /** Active lots with stock, grouped by the SKU's anchor inventory row. */
  summary: () => api.get<ApiResponse<SellableSummary[] | SellableSummary>>('/sellables/summary'),
}
