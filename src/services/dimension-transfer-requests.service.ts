import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface DimensionTransferRequestPayload {
  branch_id: number
  product_uom_batch_id: number
  qty: number
  from: { owner_ref: string; stage: string; location_ref: string }
  to: { owner_ref: string; stage: string; location_ref: string }
  description?: string
}

export const dimensionTransferRequestsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/dimension-transfer-requests', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/dimension-transfer-requests/${id}`, { params }),

  create: (data: DimensionTransferRequestPayload) =>
    api.post<ApiResponse<unknown>>('/dimension-transfer-requests', data),

  approve: (id: number) =>
    api.post<ApiResponse<unknown>>(`/dimension-transfer-requests/${id}/approve`),

  reject: (id: number, reject_reason: string) =>
    api.post<ApiResponse<unknown>>(`/dimension-transfer-requests/${id}/reject`, { reject_reason }),
}
