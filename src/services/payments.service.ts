import api from '@/hooks/useApi'

export const paymentsService = {
  list: (params?: any) =>
    api.get('/payments', { params }),
  listAllocations: (params?: any) =>
    api.get('/payments/allocations', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/payments/${id}`, { params }),
  create: (data: any, idempotencyKey: string = crypto.randomUUID()) =>
    api.post('/payments', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  update: (id: number, data: any) =>
    api.patch(`/payments/${id}`, data),
  allocate: (id: number, data: any) =>
    api.post(`/payments/${id}/allocate`, data),
  void: (id: number, payload?: any) =>
    api.post(`/payments/${id}/void`, payload),
  delete: (id: number) =>
    api.delete(`/payments/${id}`),
}
