import api from '@/hooks/useApi'
import type { ApiResponse, DashboardChartInterval, DashboardChartsResponse } from '@/types/api'

export const dashboardService = {
  metrics: (params?: {
    'filter[company_id]'?: number
    'filter[branch_id]'?: number
    'filter[created_at_gte]'?: string
    'filter[created_at_lte]'?: string
  }) =>
    api.get('/dashboard/metrics', { params }),

  insights: (params?: {
    'filter[company_id]'?: number
    'filter[branch_id]'?: number
  }) =>
    api.get('/dashboard/insights', { params }),

  charts: (params?: {
    date_from?: string
    date_to?: string
    interval?: DashboardChartInterval
    branch_id?: number
  }) =>
    api.get<ApiResponse<DashboardChartsResponse>>('/dashboard/charts', { params }),
}
