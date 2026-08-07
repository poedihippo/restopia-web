import api from '@/hooks/useApi'
import type { ApiResponse } from '@/types/api'

export interface DimensionTransferRequest {
  branch_id: number
  product_uom_batch_id: number
  qty: number
  from: { owner_ref: string; stage: string; location_ref: string }
  to: { owner_ref: string; stage: string; location_ref: string }
  description?: string
}

export const dimensionTransfersService = {
  create: (data: DimensionTransferRequest) =>
    api.post<ApiResponse<unknown>>('/stock-movements/dimension-transfer', data),
}
