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

  // Settlement of receive payments whose method has requires_settlement:
  // one outlet (the active branch) + one method, either a period
  // (date_gte/date_lte: every pending payment in it) or explicit payment_ids.
  // D bank (received) + D each fee row / K Piutang; received + Σfees = total.
  listSettlements: (params?: any) =>
    api.get('/payments/settlements', { params }),
  findSettlement: (id: number, params?: any) =>
    api.get(`/payments/settlements/${id}`, { params }),
  // { count, total_amount, earliest_date, latest_date } of what a period settles.
  previewSettlement: (params: {
    branch_id: number
    payment_method_id: number
    date_gte: string
    date_lte: string
  }) => api.get('/payments/settlements/preview', { params }),
  createSettlement: (data: {
    branch_id: number
    payment_method_id: number
    payment_ids?: number[]
    date_gte?: string
    date_lte?: string
    bank_account_id: number
    received_amount: number
    fees?: { chart_of_account_id: number; amount: number; description?: string }[]
    date: string
    description?: string
  }) => api.post('/payments/settlements', data),
  // Undo: reversing journal, payments back to pending.
  undoSettlement: (id: number) =>
    api.delete(`/payments/settlements/${id}`),
}
