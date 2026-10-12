import api from '@/hooks/useApi'
import type { ApiResponse, PortioningRequest } from '@/types/api'

// Create + preview only: the list/detail GET endpoints are not live yet.
export const portioningsService = {
  create: (data: PortioningRequest) =>
    api.post<ApiResponse<unknown>>('/portionings', data),

  preview: (data: PortioningRequest) =>
    api.post<ApiResponse<unknown>>('/portionings/preview', data),
}
