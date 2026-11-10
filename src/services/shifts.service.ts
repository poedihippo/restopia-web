import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export const shiftsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/shifts', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/shifts/${id}`, { params }),

  current: (params?: { include?: string }) =>
    api.get<ApiResponse<any>>('/shifts/current', { params }),

  start: (data: any) =>
    api.post<ApiResponse<any>>('/shifts/start', data),

  rollover: (data: any) =>
    api.post<ApiResponse<any>>('/shifts/rollover', data),

  close: (data?: any) =>
    api.post<ApiResponse<any>>('/shifts/close', data, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),
}
