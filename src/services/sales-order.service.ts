import api from '@/hooks/useApi'
import type { SalesOrderRequest } from '@/types/api'

const BASE = '/sales-orders'

const salesOrderService = {
  list: (params?: Record<string, any>) => api.get(BASE, { params }),
  findById: (id: number, params?: Record<string, any>) => api.get(`${BASE}/${id}`, { params }),
  create: (data: SalesOrderRequest) => api.post(BASE, data),
  update: (id: number, data: SalesOrderRequest) => api.patch(`${BASE}/${id}`, data),
  delete: (id: number) => api.delete(`${BASE}/${id}`),
}

export default salesOrderService
