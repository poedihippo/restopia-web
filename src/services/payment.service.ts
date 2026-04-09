import api from '@/hooks/useApi'
import type { PaymentRequest } from '@/types/api'

const BASE = '/payments'

const paymentService = {
  list: (params?: Record<string, any>) => api.get(BASE, { params }),
  findById: (id: number, params?: Record<string, any>) => api.get(`${BASE}/${id}`, { params }),
  create: (data: PaymentRequest) => api.post(BASE, data),
  update: (id: number, data: PaymentRequest) => api.patch(`${BASE}/${id}`, data),
  delete: (id: number) => api.delete(`${BASE}/${id}`),
}

export default paymentService
