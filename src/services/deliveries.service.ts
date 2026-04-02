import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, DeliveryRequest } from '@/types/api'

export const deliveriesService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/deliveries', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<unknown>>(`/deliveries/${id}`, { params }),

  create: (data: DeliveryRequest) =>
    api.post<ApiResponse<unknown>>('/deliveries', data),

  update: (id: number, data: Partial<DeliveryRequest>) =>
    api.patch<ApiResponse<unknown>>(`/deliveries/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/deliveries/${id}`),
}
