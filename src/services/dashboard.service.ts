import api from '@/hooks/useApi'

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
}
