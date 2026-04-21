import api from '@/hooks/useApi'

export const paymentsService = {
  list: (params?: any) =>
    api.get('/payments', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/payments/${id}`, { params }),
  create: (data: any) =>
    api.post('/payments', data),
  update: (id: number, data: any) =>
    api.patch(`/payments/${id}`, data),
  delete: (id: number) =>
    api.delete(`/payments/${id}`),
}
