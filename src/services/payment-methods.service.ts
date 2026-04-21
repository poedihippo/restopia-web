import api from '@/hooks/useApi'

export const paymentMethodsService = {
  list: (params?: any) =>
    api.get('/payment-methods', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/payment-methods/${id}`, { params }),
  create: (data: any) =>
    api.post('/payment-methods', data),
  update: (id: number, data: any) =>
    api.patch(`/payment-methods/${id}`, data),
  delete: (id: number) =>
    api.delete(`/payment-methods/${id}`),
}
