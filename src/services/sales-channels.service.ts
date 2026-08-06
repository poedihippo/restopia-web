import api from '@/hooks/useApi'

export const salesChannelsService = {
  list: (params?: any) =>
    api.get('/sales-channels', { params }),
  findById: (id: string, params?: any) =>
    api.get(`/sales-channels/${id}`, { params }),
  create: (data: any) =>
    api.post('/sales-channels', data),
  update: (id: string, data: any) =>
    api.patch(`/sales-channels/${id}`, data),
  delete: (id: string) =>
    api.delete(`/sales-channels/${id}`),
}
