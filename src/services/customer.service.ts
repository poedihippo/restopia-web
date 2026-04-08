import api from '@/hooks/useApi'
import type { CustomerRequest } from '@/types/api'

const BASE = '/customers'

const customerService = {
  list: (params?: Record<string, any>) => api.get(BASE, { params }),
  findById: (id: number, params?: Record<string, any>) => api.get(`${BASE}/${id}`, { params }),
  create: (data: CustomerRequest) => api.post(BASE, data),
  update: (id: number, data: CustomerRequest) => api.patch(`${BASE}/${id}`, data),
  delete: (id: number) => api.delete(`${BASE}/${id}`),
}

export default customerService
