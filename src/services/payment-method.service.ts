import api from '@/hooks/useApi'

const BASE = '/payment-methods'

const paymentMethodService = {
  list: (params?: Record<string, any>) => api.get(BASE, { params }),
  create: (data: { name: string }) => api.post(BASE, data),
  update: (id: number, data: { name: string }) => api.patch(`${BASE}/${id}`, data),
  delete: (id: number) => api.delete(`${BASE}/${id}`),
}

export default paymentMethodService
