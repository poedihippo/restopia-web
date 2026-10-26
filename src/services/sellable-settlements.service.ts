import api from '@/hooks/useApi'
import type {
  ApiResponse,
  PaginatedData,
  ListParams,
  RunSellableSettlementRequest,
  SellableSettlement,
  SellableSettlementRunResult,
} from '@/types/api'

export const sellableSettlementsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<SellableSettlement>>>('/sellable-settlements', {
      params,
    }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<SellableSettlement>>(`/sellable-settlements/${id}`, {
      params: {
        include: 'lines,lines.product_inventory,created_by,updated_by',
        ...params,
      },
    }),

  /** dry_run: true previews without persisting anything */
  run: (data: RunSellableSettlementRequest) =>
    api.post<ApiResponse<SellableSettlementRunResult>>('/sellable-settlements', data),
}
