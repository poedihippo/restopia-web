import api from '@/hooks/useApi'

export const auditLogsService = {
  list: (params?: any) => api.get('/audit-logs', { params }),
  findById: (id: string, params?: any) => api.get(`/audit-logs/${id}`, { params }),
}
